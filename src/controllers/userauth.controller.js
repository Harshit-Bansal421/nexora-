import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/User.model.js";
import {
  uploadUserImage_cloud,
  getOptimizedImage,
} from "../utils/Cloudinary.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  accessTokenGenerator,
  refreshTokenGenerator,
  OTPgenerator,
} from "../utils/verificationGenerator.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/Email.js";
import {
  getVerificationEmailHTML,
  getPasswordResetEmailHTML,
} from "../utils/Html.js";
import { OTP } from "../models/Otp.model.js";
import bcrypt from "bcryptjs";
import { OPTIONS } from "../constants.js";
import mongoose from "mongoose";
import { getIO } from "../socket.js";
import { createNotification } from "../utils/createNotification.js";
import { parsePagination } from "../utils/pagination.js";
import { rollbackOtpAfterEmailFailure } from "../utils/rollbackOtpAfterEmailFailure.js";

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";
const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const searchUsers = asyncHandler(async (req, res) => {
  const query =
    typeof req.query.q === "string"
      ? req.query.q.trim().replace(/^@/, "")
      : "";
  if (!query || query.length > 50) {
    return res.status(200).json(new ApiResponse(200, { users: [] }, "Users retrieved successfully"));
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const users = await User.find({ username: { $regex: escaped, $options: "i" } })
    .select("username profileImage title bio")
    .sort({ username: 1 })
    .limit(6)
    .lean();
  return res.status(200).json(new ApiResponse(200, { users }, "Users retrieved successfully"));
});

const SignupUser = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const username =
    typeof req.body?.username === "string"
      ? req.body.username.trim().toLowerCase()
      : "";
  const { password } = req.body || {};

  if (!email || !username || typeof password !== "string") {
    throw new ApiError(400, "Email, username, and password are required");
  }
  if (!isValidEmail(email)) throw new ApiError(400, "Enter a valid email address");
  if (username.length < 4 || username.length > 20) {
    throw new ApiError(400, "Username must be between 4 and 20 characters");
  }
  if (password.length < 5 || Buffer.byteLength(password, "utf8") > 72) {
    throw new ApiError(400, "Password must be between 5 and 72 bytes");
  }
  if (!req.file?.path) throw new ApiError(400, "Profile image is required");

  if (await User.exists({ email })) {
    throw new ApiError(409, "An account with this email already exists");
  }
  if (await User.exists({ username })) {
    throw new ApiError(409, "User with this username already exists");
  }

  const existingOtp = await OTP.findOne({ email, type: "email_verify" });
  if (existingOtp) {
    if (existingOtp.expiry <= new Date()) {
      await OTP.deleteOne({ _id: existingOtp._id });
    } else {
      throw new ApiError(
        409,
        "Email verification is already pending; use the resend code option",
      );
    }
  }

  if (
    await OTP.exists({
      pendingUsername: username,
      type: "email_verify",
    })
  ) {
    throw new ApiError(409, "Username is reserved by a pending registration");
  }

  const cloudinaryResponse = await uploadUserImage_cloud(
    req.file.path,
    "nexora_userImage",
    "image",
  );
  if (!cloudinaryResponse?.public_id) {
    throw new ApiError(500, "Failed to upload profile image securely");
  }

  const { plainOTP, hashedOTP, expiry } = await OTPgenerator();
  const pendingPasswordHash = await bcrypt.hash(password, 12);
  let pendingOtp;
  try {
    pendingOtp = await OTP.create({
      email,
      type: "email_verify",
      pendingUsername: username,
      pendingUserImageID: cloudinaryResponse.public_id,
      pendingPasswordHash,
      hashedOTP,
      expiry,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "Email or username is already registered");
    }
    throw error;
  }

  const html = getVerificationEmailHTML(username, plainOTP);
  try {
    await sendEmail({ to: email, html });
  } catch (error) {
    await rollbackOtpAfterEmailFailure(OTP, {
      otpId: pendingOtp._id,
      failedHashedOTP: hashedOTP,
    });
    throw error;
  }

  return res
    .status(201)
    .json(new ApiResponse(201, null, "Verification code sent to your email"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  if (req.user && req.user.profileImage) {
    req.user.profileImage = getOptimizedImage(req.user.profileImage);
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, req.user, "User information retrieved successfully"),
    );
});

const getSocketToken = asyncHandler(async (req, res) => {
  const token = jwt.sign(
    { _id: req.user._id, tokenUse: "socket" },
    process.env.ACCESS_TOKEN_SECRET,
    { algorithm: "HS256", expiresIn: "2m" },
  );

  return res
    .status(200)
    .set("Cache-Control", "no-store, private")
    .json(new ApiResponse(200, { token }, "Socket authentication ready"));
});

const getNewAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.RefreshToken;
  if (!refreshToken) throw new ApiError(401, "Unauthorized - Session expired");
  let decodedToken;
  try {
    decodedToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, "Unauthorized - Invalid or expired token");
  }
  const user = await User.findOne({
    _id: decodedToken._id,
    refreshToken,
  }).select("-password -refreshToken");
  if (!user) throw new ApiError(401, "Unauthorized - Refresh token revoked");

  const accessToken = await accessTokenGenerator(decodedToken._id);
  if (user.profileImage) user.profileImage = getOptimizedImage(user.profileImage);

  return res
    .status(200)
    .cookie("AccessToken", accessToken, OPTIONS)
    .json(new ApiResponse(200, user, "Access token successfully refreshed"));
});

const loginUser = asyncHandler(async (req, res) => {
  //get req body data
  const username =
    typeof req.body?.username === "string"
      ? req.body.username.trim().toLowerCase()
      : "";
  const { password } = req.body || {};
  //validate data
  if (!username || typeof password !== "string" || !password) {
    throw new ApiError(400, "Username and password are required");
  }
  //check if user exist or not
  const user = await User.findOne({ username });
  if (!user?.password) {
    throw new ApiError(401, "Invalid credentials");
  }

  //check if password is correct or not
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }
  //generate accesstoken and refresh token
  //generate refresh token and acesstoken
  const accessToken = await accessTokenGenerator(user._id);
  const refreshToken = await refreshTokenGenerator(user._id);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  if (loggedInUser && loggedInUser.profileImage) {
    loggedInUser.profileImage = getOptimizedImage(loggedInUser.profileImage);
  }

  //return these tokens with user info
  return res
    .status(200)
    .cookie("AccessToken", accessToken, OPTIONS)
    .cookie("RefreshToken", refreshToken, OPTIONS)
    .json(new ApiResponse(200, loggedInUser, "User logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.RefreshToken;
  if (refreshToken) {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { refreshToken } },
    );
  }
  return res
    .status(200)
    .clearCookie("AccessToken", OPTIONS)
    .clearCookie("RefreshToken", OPTIONS)
    .json(new ApiResponse(200, "Logged out successfully"));
});

const logoutUserAllDevice = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { refreshToken: [] } });
  return res
    .status(200)
    .clearCookie("AccessToken", OPTIONS)
    .clearCookie("RefreshToken", OPTIONS)
    .json(new ApiResponse(200, "Logged out from all devices successfully"));
});

const verifyEmailandLogin = asyncHandler(async (req, res) => {
  //user will get email and otp
  const email = normalizeEmail(req.body?.email);
  const otp = req.body?.otp || req.body?.OTP;

  if (!email || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    throw new ApiError(400, "A valid email and 6-digit OTP are required");
  }
  if (!isValidEmail(email)) throw new ApiError(400, "Enter a valid email address");

  //check if this user with this email and type exist or not
  const existedOTP = await OTP.findOne({ email: email, type: "email_verify" });
  if (!existedOTP)
    throw new ApiError(
      404,
      "No pending verification found — please register again",
    );

  //check for expiry
  if (existedOTP.expiry <= new Date()) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(410, "OTP expired — please register again");
  }
  //check for failed attemmpt so to ensure user is not doing brute force
  if (existedOTP.failedAttempts >= 5) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(429, "Too many wrong attempts — please register again");
  }
  //we will verify otp and increase the failed Attempts
  const OTPrespone = await bcrypt.compare(otp, existedOTP.hashedOTP);
  if (!OTPrespone) {
    await OTP.findByIdAndUpdate(existedOTP._id, {
      $inc: { failedAttempts: 1 },
    });
    const remaining = Math.max(0, 4 - existedOTP.failedAttempts);
    throw new ApiError(401, `Invalid OTP — ${remaining} attempts remaining`);
  }

  //check if the username still exist in the db or not
  const checkUsername = await User.findOne({
    username: existedOTP.pendingUsername,
  });
  if (checkUsername) throw new ApiError(409, "Username is already taken");

  //create user in database
  const consumedOtp = await OTP.findOneAndDelete({
    _id: existedOTP._id,
    hashedOTP: existedOTP.hashedOTP,
    expiry: { $gt: new Date() },
  });
  if (!consumedOtp) {
    throw new ApiError(410, "Verification code expired or was already used");
  }

  let user;
  try {
    user = await User.create({
      username: existedOTP.pendingUsername,
      email,
      password: existedOTP.pendingPasswordHash,
      profileImage: existedOTP.pendingUserImageID,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "Email or username is already registered");
    }
    throw error;
  }
  if (!user) {
    throw new ApiError(500, "Failed to create user account");
  }

  //generate accesstoken and refreshToken and set cookie
  const accessToken = await accessTokenGenerator(user._id);
  const newRefreshToken = await refreshTokenGenerator(user._id);

  const newUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  if (newUser && newUser.profileImage) {
    newUser.profileImage = getOptimizedImage(newUser.profileImage);
  }

  //send response
  res
    .status(201)
    .cookie("AccessToken", accessToken, OPTIONS)
    .cookie("RefreshToken", newRefreshToken, OPTIONS)
    .json(
      new ApiResponse(
        201,
        newUser,
        "Email verified. Welcome to Nexora!",
      ),
    );
});

const updateUsername = asyncHandler(async (req, res) => {
  const username =
    typeof req.body?.username === "string"
      ? req.body.username.trim().toLowerCase()
      : "";
  if (!username) throw new ApiError(400, "Username is required");
  if (username.length < 4 || username.length > 20) {
    throw new ApiError(400, "Username must be between 4 and 20 characters");
  }

  const existingUser = await User.findOne({ username }).select("_id");
  if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
    throw new ApiError(409, "User with this username already exists");
  }

  await User.findByIdAndUpdate(req.user._id, { $set: { username } });
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Username updated successfully"));
});

// New profile update handler for bio (and future fields)
const updateProfile = asyncHandler(async (req, res) => {
  const { bio } = req.body || {};
  if (bio !== undefined) {
    if (typeof bio !== "string") {
      throw new ApiError(400, "Bio must be a string");
    }
    if (bio.length > 150) {
      throw new ApiError(400, "Bio cannot exceed 150 characters");
    }
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { bio: bio.trim() } },
      { new: true, runValidators: true },
    ).select("bio");
    return res.status(200).json(
      new ApiResponse(200, { bio: updatedUser.bio }, "Profile updated successfully"),
    );
  }
  // Could handle other profile fields here
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Profile updated successfully"));
});

const getFollowList = asyncHandler(async (req, res) => {
  const { user_id: userId, listType } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) throw new ApiError(400, "Invalid user ID");
  if (!["followers", "following"].includes(listType)) throw new ApiError(400, "List type must be followers or following");
  const { page, limit, skip } = parsePagination(req.query);
  const user = await User.findById(userId).select(listType);
  if (!user) throw new ApiError(404, "User not found");
  const ids = user[listType] || [];
  const pageIds = ids.slice(skip, skip + limit);
  const users = await User.find({ _id: { $in: pageIds } })
    .select("username profileImage title badge")
    .lean();
  const byId = new Map(users.map((person) => [String(person._id), person]));
  const people = pageIds.map((id) => byId.get(String(id))).filter(Boolean).map((person) => ({
    ...person,
    profileImage: getOptimizedImage(person.profileImage),
  }));
  const total = ids.length;
  const totalPages = Math.ceil(total / limit);
  return res.status(200).json(new ApiResponse(200, {
    users: people,
    pagination: { total, page, limit, totalPages, hasNextPage: page < totalPages },
  }, `${listType} retrieved successfully`));
});

const UpdatePassword = asyncHandler(async (req, res) => {
  const { oldpassword, newpassword, confirmpassword } = req.body || {};
  if (
    typeof oldpassword !== "string" ||
    typeof newpassword !== "string" ||
    typeof confirmpassword !== "string" ||
    !oldpassword ||
    !newpassword ||
    !confirmpassword
  )
    throw new ApiError(400, "All fields are required");
  if (newpassword.length < 5 || Buffer.byteLength(newpassword, "utf8") > 72)
    throw new ApiError(400, "Password must be between 5 and 72 bytes");
  if (oldpassword === newpassword)
    throw new ApiError(400, "New password must be different from old password");
  if (newpassword !== confirmpassword)
    throw new ApiError(400, "New password and confirm password do not match");

  //check if the oldpassword is correct or not
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "User not found");
  const iscorrect = await user.isPasswordCorrect(oldpassword);
  if (!iscorrect) throw new ApiError(401, "Incorrect old password");

  user.password = await bcrypt.hash(newpassword, 12);
  user.passwordResetVersion += 1;
  const activeRefreshToken = req.cookies?.RefreshToken;
  user.refreshToken =
    activeRefreshToken && user.refreshToken.includes(activeRefreshToken)
      ? [activeRefreshToken]
      : [];
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "Password updated successfully; other sessions have been signed out",
      ),
    );
});

const resendEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { type } = req.body || {};
  if (!isValidEmail(email)) throw new ApiError(400, "Enter a valid email address");
  if (!["email_verify", "password_reset"].includes(type)) {
    throw new ApiError(400, "Invalid verification type");
  }

  const existedOTP = await OTP.findOne({ email, type });
  if (!existedOTP)
    throw new ApiError(
      404,
      "No pending verification found — please register again",
    );

  if (existedOTP.expiry <= new Date()) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(410, "OTP expired — please restart process");
  }

  if (existedOTP.lastResend) {
    const secondSlice = (new Date() - existedOTP.lastResend) / 1000;
    if (secondSlice < 60) {
      const waitSeconds = Math.ceil(60 - secondSlice);
      throw new ApiError(
        429,
        `Please wait ${waitSeconds} seconds before resending`,
      );
    }
  }

  if (existedOTP.resendCount >= 5) {
    throw new ApiError(429, "Maximum resend limit reached — please restart process");
  }

  let username = existedOTP.pendingUsername;
  if (type === "email_verify") {
    if (!username) throw new ApiError(404, "Pending registration not found");
  } else {
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, "User not found");
    username = user.username;
  }

  const { plainOTP, hashedOTP, expiry } = await OTPgenerator();
  const previousOtp = {
    hashedOTP: existedOTP.hashedOTP,
    expiry: existedOTP.expiry,
    lastResend: existedOTP.lastResend,
    failedAttempts: existedOTP.failedAttempts,
    resendCount: existedOTP.resendCount,
  };
  await OTP.findByIdAndUpdate(existedOTP._id, {
    $set: {
      hashedOTP,
      expiry,
      lastResend: new Date(),
      failedAttempts: 0,
    },
    $inc: {
      resendCount: 1,
    },
  });

  const html =
    type === "email_verify"
      ? getVerificationEmailHTML(username, plainOTP)
      : getPasswordResetEmailHTML(username, plainOTP);

  try {
    await sendEmail({ to: email, html });
  } catch (error) {
    await rollbackOtpAfterEmailFailure(OTP, {
      otpId: existedOTP._id,
      failedHashedOTP: hashedOTP,
      previous: previousOtp,
    });
    throw error;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Verification code sent to your email"));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) throw new ApiError(400, "Enter a valid email address");

  const genericResponse = () =>
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "If this email is registered, you will receive a reset code",
        ),
      );
  const user = await User.findOne({ email });
  if (!user) return genericResponse();

  let existedOTP = await OTP.findOne({ email, type: "password_reset" });
  if (existedOTP && existedOTP.expiry <= new Date()) {
    await OTP.findByIdAndDelete(existedOTP._id);
    existedOTP = null;
  }
  if (existedOTP) {
    const secondsSince = existedOTP.lastResend
      ? (Date.now() - existedOTP.lastResend.getTime()) / 1000
      : Number.POSITIVE_INFINITY;
    if (secondsSince < 60 || existedOTP.resendCount >= 5) {
      return genericResponse();
    }
  }

  const { plainOTP, hashedOTP, expiry } = await OTPgenerator();
  let otpRollback;
  if (existedOTP) {
    const previousOtp = {
      hashedOTP: existedOTP.hashedOTP,
      expiry: existedOTP.expiry,
      failedAttempts: existedOTP.failedAttempts,
      lastResend: existedOTP.lastResend,
      resendCount: existedOTP.resendCount,
    };
    await OTP.findByIdAndUpdate(existedOTP._id, {
      $set: {
        hashedOTP,
        expiry,
        failedAttempts: 0,
        lastResend: new Date(),
      },
      $inc: { resendCount: 1 },
    });
    otpRollback = { otpId: existedOTP._id, previous: previousOtp };
  } else {
    const pendingOtp = await OTP.create({
      email,
      type: "password_reset",
      hashedOTP,
      expiry,
      lastResend: new Date(),
    });
    otpRollback = { otpId: pendingOtp._id };
  }

  const html = getPasswordResetEmailHTML(user.username, plainOTP);
  try {
    await sendEmail({ to: email, html });
  } catch (error) {
    await rollbackOtpAfterEmailFailure(OTP, {
      ...otpRollback,
      failedHashedOTP: hashedOTP,
    });
    throw error;
  }
  return genericResponse();
});

const verifyResetOTP = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { otp } = req.body || {};
  if (!isValidEmail(email) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    throw new ApiError(400, "A valid email and 6-digit OTP are required");
  }

  const existedOTP = await OTP.findOne({ email, type: "password_reset" });
  if (!existedOTP)
    throw new ApiError(404, "No reset request found — please request again");

  //validate the otp
  if (existedOTP.expiry <= new Date()) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(410, "OTP expired — please request a new one");
  }

  if (existedOTP.failedAttempts >= 5) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(429, "Too many wrong attempts — please request again");
  }

  const isvalid = await bcrypt.compare(otp, existedOTP.hashedOTP);
  if (!isvalid) {
    await OTP.findByIdAndUpdate(existedOTP._id, {
      $inc: { failedAttempts: 1 },
    });
    const remaining = Math.max(0, 4 - existedOTP.failedAttempts);
    throw new ApiError(401, `Invalid OTP — ${remaining} attempts remaining`);
  }

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found");

  const consumedOtp = await OTP.findOneAndDelete({
    _id: existedOTP._id,
    hashedOTP: existedOTP.hashedOTP,
    expiry: { $gt: new Date() },
  });
  if (!consumedOtp) throw new ApiError(410, "OTP expired or was already used");

  //generate a resettoken
  const resetToken = jwt.sign(
    {
      _id: user._id,
      purpose: "password_reset",
      version: user.passwordResetVersion,
    },
    process.env.RESET_SECRETKEY,
    {
      expiresIn: process.env.RESET_SECRETKEY_EXPIRY,
    },
  );

  //send response
  return res
    .status(200)
    .cookie("ResetToken", resetToken, OPTIONS)
    .json(
      new ApiResponse(
        200,
        null,
        "OTP verified successfully. Please enter your new password",
      ),
    );
});

const resetPassword = asyncHandler(async (req, res) => {
  const { newpassword } = req.body || {};
  const confirmNewPassword =
    req.body?.confirmNewPassword ?? req.body?.confirmpassword;
  const resetToken = req.cookies?.ResetToken;

  if (
    typeof newpassword !== "string" ||
    typeof confirmNewPassword !== "string" ||
    !newpassword ||
    !confirmNewPassword ||
    !resetToken
  )
    throw new ApiError(400, "All fields are required");
  if (
    newpassword.length < 5 ||
    Buffer.byteLength(newpassword, "utf8") > 72
  ) {
    throw new ApiError(400, "Password must be between 5 and 72 bytes");
  }
  if (newpassword !== confirmNewPassword)
    throw new ApiError(400, "Passwords do not match");

  let decoded;
  try {
    decoded = jwt.verify(resetToken, process.env.RESET_SECRETKEY);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Reset session expired — please start again");
    }
    throw new ApiError(401, "Invalid reset token");
  }

  const user = await User.findById(decoded._id);
  if (!user) throw new ApiError(404, "User not found");
  if (
    decoded.purpose !== "password_reset" ||
    decoded.version !== user.passwordResetVersion
  ) {
    throw new ApiError(401, "Invalid reset token purpose");
  }

  const hashedPassword = await bcrypt.hash(newpassword, 12);
  user.password = hashedPassword;
  user.passwordResetVersion += 1;
  user.refreshToken = []; // logout all devices
  await user.save({ validateBeforeSave: false });

  //send reponse
  res.clearCookie("ResetToken", OPTIONS);
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Password changed successfully"));
});

const followUser = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    throw new ApiError(400, "User ID is required");
  }

  if (user_id.toString() === req.user._id.toString()) {
    throw new ApiError(400, "You cannot follow yourself");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userToFollow = await User.findById(user_id).session(session);
    if (!userToFollow) {
      throw new ApiError(404, "User does not exist");
    }

    // check already following
    const alreadyFollowing = userToFollow.followers?.some(
      (followerId) => String(followerId) === String(req.user._id),
    );

    if (alreadyFollowing) {
      await session.abortTransaction();
      return res
        .status(200)
        .json(new ApiResponse(200, {
          isFollowing: true,
          followersCount: userToFollow.followers.length,
          followingCount: req.user.following?.length || 0,
        }, "Already following"));
    }

    const followedUser = await User.findByIdAndUpdate(
      user_id,
      {
        $addToSet: { followers: req.user._id },
      },
      { session, new: true },
    );

    const followingUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $addToSet: { following: user_id },
      },
      { session, new: true },
    );

    await session.commitTransaction();

    //send live notification and update
    const io = getIO.get();
    const room1 = `user:${String(user_id).trim()}`;
    const room2 = `user:${String(req.user._id).trim()}`;
    io.to(room1).emit("followed-user", followedUser);
    io.to(room2).emit("following-user", followingUser);

    await createNotification(
      user_id,
      req.user._id,
      "follow",
      `${req.user.username} followed u`,
    );

    //send response
    res.status(200).json(new ApiResponse(200, {
      isFollowing: true,
      followersCount: followedUser.followers.length,
      followingCount: followingUser.following.length,
    }, "Followed successfully"));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

const unfollowUser = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    throw new ApiError(400, "User ID is required");
  }

  if (user_id.toString() === req.user._id.toString()) {
    throw new ApiError(400, "You cannot unfollow yourself");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userToUnfollow = await User.findById(user_id).session(session);

    if (!userToUnfollow) {
      throw new ApiError(404, "User does not exist");
    }

    // check if actually following
    const isFollowing = userToUnfollow.followers?.some(
      (followerId) => String(followerId) === String(req.user._id),
    );

    if (!isFollowing) {
      await session.abortTransaction();
      return res
        .status(200)
        .json(new ApiResponse(200, {
          isFollowing: false,
          followersCount: userToUnfollow.followers.length,
          followingCount: req.user.following?.length || 0,
        }, "You are not following this user"));
    }

    // remove follower
    const followedUser=await User.findByIdAndUpdate(
      user_id,
      {
        $pull: { followers: req.user._id },
      },
      { session, new: true },
    );

    // remove following
    const followingUser=await User.findByIdAndUpdate(
      req.user._id,
      {
        $pull: { following: user_id },
      },
      { session, new: true },
    );

    await session.commitTransaction();

    const io = getIO.get();
    const room1 = `user:${String(user_id).trim()}`;
    const room2 = `user:${String(req.user._id).trim()}`;
    io.to(room1).emit("unfollowed-user", followedUser);
    io.to(room2).emit("following-user", followingUser);

    res.status(200).json(new ApiResponse(200, {
      isFollowing: false,
      followersCount: followedUser.followers.length,
      followingCount: followingUser.following.length,
    }, "Unfollowed successfully"));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export {
  SignupUser,
  getCurrentUser,
  getSocketToken,
  getNewAccessToken,
  loginUser,
  logoutUser,
  logoutUserAllDevice,
  verifyEmailandLogin,
  updateUsername,
  UpdatePassword,
  updateProfile,
  resendEmail,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  followUser,
  unfollowUser,
  getFollowList,
  searchUsers,
};
