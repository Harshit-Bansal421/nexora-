import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/User.model.js";
import { uploadUserImage_cloud } from "../utils/Cloudinary.js";
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
import { v2 as cloudinary } from "cloudinary";
import { OPTIONS } from "../constants.js";

const SignupUser = asyncHandler(async (req, res) => {
  //in signin we save data in otpschema which is a temporary database which exist only for 10 min after that it will vanish and user have to verify within that minute and after verify we save the info actually
  //get data from request
  const { email, username, password } = req.body;

  //validate data
  if (!email || !username || !password) {
    throw new ApiError(400, "All fields are required");
  }

  //check if user already exist:username , email
  const existeduser = await User.findOne({ username: username });
  if (existeduser) {
    throw new ApiError(409, "User with this username already exist");
  }

  //check if localfile exist
  const localfilepath = req.file?.path;
  if (!localfilepath) {
    throw new ApiError(400, "issue in uploading file in multer");
  }

  //upload file into cloudinary
  const cloudinaryResponse = await uploadUserImage_cloud(
    localfilepath,
    "nexora_userImage",
    "image"
  );
  if (!cloudinaryResponse?.public_id) {
    throw new ApiError(500, "error in uploading file on cloudinary");
  }

  //get the file url from cloudinary
  const userProfileUrl = cloudinaryResponse?.public_id;

  //generate otp related stuff
  const { plainOTP, hashedOTP, expiry } = await OTPgenerator();
  const existingOtp = await OTP.findOne({ email, type: "email_verify" });
  if (existingOtp) {
    //if that user exist in otpschema then just update the resend
    await OTP.findByIdAndUpdate(existingOtp._id, {
      $set: {
        hashedOTP: hashedOTP,
        expiry: expiry,
      },
      $inc: { resendCount: 1 },
    });
  } else {
    //save the data temporarily in otpschema
    const hashedPassword = await bcrypt.hash(password, 12);
    const tempsaved = await OTP.create({
      email: email,
      type: "email_verify",
      pendingUsername: username,
      pendingUserImageID: userProfileUrl,
      pendingPasswordHash: hashedPassword,
      hashedOTP: hashedOTP,
      expiry: expiry,
      failedAttempts: 0, // reset failed attempts on resend
      lastResend: new Date(),
      resendCount: 0,
    });
    if (!tempsaved)
      throw new ApiError(400, "error in saving the temporary data");
  }

  //send an email and response
  const html = getVerificationEmailHTML(username, plainOTP);
  const emailResponse = await sendEmail({ to:email,html: html });
  if (!emailResponse) throw new ApiError(400, "error in sending the email");
  return res
    .status(201)
    .json(new ApiResponse(201, "Verification code sent to your email"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const publc_id=req.user.profileImage;
   const secure_url = cloudinary.url(publc_id, {
    secure: true,
  });
  req.user.profileImage=secure_url;
  return res
    .status(201)
    .json(new ApiResponse(201, req.user, "user info fetched successfully"));
});

const getNewAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.RefreshToken;
  if (!refreshToken) throw new ApiError(401, "session expired");
  let decodedToken;
  try {
    decodedToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(401, "session expired");
  }
  const accessToken = await accessTokenGenerator(decodedToken._id);

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  };

  const user = await User.findById(decodedToken._id).select(
    "-password -refreshToken",
  );
  return res
    .status(201)
    .cookie("AccessToken", accessToken, options)
    .json(new ApiResponse(201, user, "accessToken is generated successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //get req body data
  const { username, password } = req.body;
  //validate data
  if (!username || !password) {
    throw new ApiError(400, "username and password are required");
  }
  //check if user exist or not
  const user = await User.findOne({ username });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  //check if password is correct or not
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }
  //generate accesstoken and refresh token
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  };

  //generate refresh token and acesstoken
  const accessToken = await accessTokenGenerator(user._id);
  const refreshToken = await refreshTokenGenerator(user._id);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  //return these tokens with user info
  return res
    .status(200)
    .cookie("AccessToken", accessToken, options)
    .cookie("RefreshToken", refreshToken, options)
    .json(new ApiResponse(200, loggedInUser, "user is logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
  //get refresh token
  const refrehTokenCookie = req.cookies?.RefreshToken;
  if (!refrehTokenCookie) throw new ApiError(400, "No refresh token found");

  //remove that refreshToken from userdb
  // Since refrehTokenCookie is a string, it doesn't have ._id
  // We can just find the user who has this token in their array and remove it.
  await User.findOneAndUpdate(
    { refreshToken: refrehTokenCookie },
    { $pull: { refreshToken: refrehTokenCookie } },
  );
  //clearcookie
  return res
    .status(200)
    .clearCookie("AccessToken")
    .clearCookie("RefreshToken")
    .json(new ApiResponse(200, "logout successfully"));
});

const logoutUserAllDevice = asyncHandler(async (req, res) => {
  //get refresh token--no need for this because we are ac
  const refrehTokenCookie = req.cookies?.RefreshToken;
  if (!refrehTokenCookie) throw new ApiError(400, "No refresh token found");

  //remove that refreshToken from userdb
  // Since refrehTokenCookie is a string, it doesn't have ._id
  // We can just find the user who has this token in their array and remove it.
  await User.findOneAndUpdate(
    { refreshToken: refrehTokenCookie },
    { $set: { refreshToken: [] } },
  );
  //clearcookie
  return res
    .status(200)
    .clearCookie("AccessToken")
    .clearCookie("RefreshToken")
    .json(new ApiResponse(200, "logout from all devices successfully"));
});

const verifyEmailandLogin = asyncHandler(async (req, res) => {
  //user will get email and otp
  const email = req.body.email;
  const otp = req.body.otp || req.body.OTP;

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  //check if this user with this email and type exist or not
  const existedOTP = await OTP.findOne({ email: email, type: "email_verify" });
  if (!existedOTP)
    throw new ApiError(
      400,
      "No pending verification found — please register again",
    );

  //check for expiry
  if (existedOTP.expiry < new Date()) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(400, "OTP expired — please register again");
  }
  //check for failed attemmpt so to ensure user is not doing brute force
  if (existedOTP.failedAttempts > 5) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(400, "Too many wrong attempts — please register again");
  }
  //we will verify otp and increase the failed Attempts
  const OTPrespone = await bcrypt.compare(otp, existedOTP.hashedOTP);
  if (!OTPrespone) {
    OTP.findByIdAndUpdate(existedOTP._id, {
      $inc: { failedAttempts: 1 },
    });
    const remaining = 4 - existedOTP.failedAttempts;
    throw new ApiError(400, `Invalid OTP — ${remaining} attempts remaining`);
  }

  //check if the username still exist in the db or not
  const checkUsername = await User.findOne({
    username: existedOTP.pendingUsername,
  });
  if (checkUsername) throw new ApiError(400, "user with this username exist");

  //create user in database
  const user = await User.create({
    username: existedOTP.pendingUsername,
    email,
    password: existedOTP.pendingPasswordHash,
    profileImage: existedOTP.pendingUserImageID,//saving public_id instead of secure_url
  });
  if (!user) {
    throw new ApiError(500, "error in created new user");
  }

  //generate accesstoken and refreshToken and set cookie
  const accessToken = await accessTokenGenerator(user._id);
  const newRefreshToken = await refreshTokenGenerator(user._id);

  await User.findByIdAndUpdate(user._id, {
    $push: { refreshToken: newRefreshToken },
  });

  const newUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  //otp delete
  await OTP.deleteOne({ _id: existedOTP._id });

  //send response
  res
    .status(201)
    .cookie("AccessToken", accessToken, OPTIONS)
    .cookie("RefreshToken", newRefreshToken, OPTIONS)
    .json(
      new ApiResponse(
        201,
        { user: newUser },
        "Email verified. Welcome to Nexora!",
      ),
    );
});

const updateUsername = asyncHandler(async (req, res) => {
  //retrive the username from request body
  const { username } = req.body;
  if (!username) {
    throw new ApiError(400, "Username is required");
  }

  //check if the username avaiable or not
  const isExist = await User.findOne({ username });
  if (isExist) throw new ApiError(400, "user with this username already exist");
  if (!username) {
    throw new ApiError(400, "Username is required");
  }

  //update the username
  await User.findByIdAndUpdate(req.user._id, {
    $set: { username: username },
  });

  //send response
  return res
    .status(200)
    .json(new ApiResponse(201, "username updated successfully"));
});

const UpdatePassword = asyncHandler(async (req, res) => {
  //retrive oldpassword,newpassword,re-newPassword
  const { oldpassword, newpassword, confirmpassword } = req.body;

  //validation whether the feilds are empty or not,repassword and newpassword is same or not
  if (!oldpassword || !newpassword || !confirmpassword)
    throw new ApiError(400, "all field are required");
  if (oldpassword === newpassword)
    throw new ApiError(400, "new password must be different from old password");
  if (newpassword !== confirmpassword)
    throw new ApiError(400, "newpassword and confirmpassword doesnot match");

  //check if the oldpassword is correct or not
  const user = await User.findById(req.user._id);
  const iscorrect = await user.isPasswordCorrect(oldpassword);
  if (!iscorrect) throw new ApiError(400, "your password is not correct");

  //hash new password
  const hashedPassword = await bcrypt.hash(newpassword, 12);
  //update the hashpassword
  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      password: hashedPassword,
    },
  });

  //send response
  return res
    .status(201)
    .json(new ApiResponse(201, "password is updated successfully"));
});

const resendEmail = asyncHandler(async (req, res) => {
  //get email from request and validate email
  const { email, type } = req.body;
  if (!email) throw new ApiError(400, "Email is required");

  //check if such email exist in otp schema
  const existedOTP = await OTP.findOne({ email, type: type });
  if (!existedOTP)
    throw new ApiError(
      400,
      "No pending verification found — please register again",
    );

  //check for expiry
  //check for lastResend
  if (existedOTP.lastResend) {
    const secondSlice = (new Date() - existedOTP.lastResend) / 1000;
    if (secondSlice <= 60) {
      const waitSeconds = Math.ceil(60 - secondSlice);
      throw new ApiError(
        429,
        `Please wait ${waitSeconds} seconds before resending`,
      );
    }
  }

  //check for resendCount
  if (existedOTP.resendCount >= 5) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(
      429,
      existedOTP,
      "Maximum resend limit reached — please register again",
    );
  }

  if (existedOTP.expiry < new Date()) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(400, "OTP expired — please restart process");
  }

  //generate otp and update them into otpschema
  const { plainOTP, hashedOTP, expiry } = await OTPgenerator();
  await OTP.findByIdAndUpdate(existedOTP._id, {
    $set: {
      hashedOTP: hashedOTP,
      expiry: expiry,
      lastResend: new Date(),
    },
    $inc: {
      resendCount: 1,
    },
  });

  //send an email
  let username;

  if (type === "email_verify") {
    username = existedOTP.pendingUsername;
  } else {
    const user = await User.findOne({ email });
    username = user.username;
  }

  const html =
    type === "email_verify"
      ? getVerificationEmailHTML(username, plainOTP)
      : getPasswordResetEmailHTML(username, plainOTP);

  const emailResponse = await sendEmail({ to:email,html: html });
  if (!emailResponse) throw new ApiError(400, "error in sending the email");

  //send some response
  return res
    .status(201)
    .json(new ApiResponse(201,existedOTP, "Verification code sent to your email"));
});

const forgotPassword = asyncHandler(async (req, res) => {
  //get email and validate the feild
  const { email } = req.body;
  if (!email) throw new ApiError(400, "email feild is missing");

  //check whether the user even exist or not in user db
  const user = await User.findOne({ email });
  if (!user)
    throw new ApiError(
      400,
      "user with this email doesnot exist|| please register",
    );

  //check for spaming forgot password
  const existedOTP = await OTP.findOne({ email, type: "password_reset" });
  if (existedOTP) {
    const secondsSince = (new Date() - existedOTP.lastResend) / 1000;
    if (secondsSince < 60) {
      const waitSeconds = Math.ceil(60 - secondsSince);
      throw new ApiError(
        200,
        {},
        "If this email is registered you will receive a reset code",
      );
    }
    if (existedOTP.resendCount > 5) {
      throw new ApiError(
        200,
        {},
        "If this email is registered you will receive a reset code",
      );
    }
  }

  //if exist then generate a otp
  const { plainOTP, hashedOTP, expiry } = await OTPgenerator();

  //then create a otp schema with type 'password_reset
  await OTP.findOneAndUpdate(
    { email, type: "password_reset" },
    {
      $set: {
        email,
        type: "password_reset",
        hashedOTP: hashedOTP,
        expiry: expiry,
        failedAttempts: 0,
        lastResend: new Date(),
      },
      $inc: { resendCount: 1 },
    },
    { upsert: true, returnDocument: 'after' },
  );

  // send email and response
  const html = getPasswordResetEmailHTML(user.username, plainOTP);
  const emailresponse=await sendEmail({to:email,html: html });
  console.log("emailresponse = ",emailresponse)
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "If this email is registered you will receive a reset code yes u will",
      ),
    );
});

const verifyResetOTP = asyncHandler(async (req, res) => {
  //retrive otp and email from request body
  const { email, otp } = req.body;
  if (!email || !otp) throw new ApiError(400, "feild are empty");

  //check if otpschema even exist now or not
  const existedOTP = await OTP.findOne({ email, type: "password_reset" });
  if (!existedOTP)
    throw new ApiError(400, "No reset request found — please request again");

  //validate the otp
  if (existedOTP.expiry < new Date()) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(400, "OTP expired — please request a new one");
  }

  if (existedOTP.failedAttempts >= 5) {
    await OTP.findByIdAndDelete(existedOTP._id);
    throw new ApiError(400, "Too many wrong attempts — please request again");
  }

  const isvalid = await bcrypt.compare(otp, existedOTP.hashedOTP);
  if (!isvalid) {
    await OTP.findByIdAndUpdate(existedOTP._id, {
      $inc: { failedAttempts: 1 },
    });
    const remaining = 4 - existedOTP.failedAttempts;
    throw new ApiError(400, `Invalid OTP — ${remaining} attempts remaining`);
  }

  //otp is valid now find the user
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found");

  await OTP.findByIdAndDelete(existedOTP._id);

  //generate a resettoken
  const resetToken = jwt.sign(
    {
      _id: user._id,
      purpose: "password_reset",
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
    .json(new ApiResponse(200, "otp is verified now eneter new Password"));
});

const resetPassword = asyncHandler(async (req, res) => {
  //newpassword,confirmpassword and reset token from cookie
  const { newpassword, confirmNewPassword } = req.body;
  const resetToken = req.cookies.ResetToken;

  //validate the feilds
  if (!newpassword || !confirmNewPassword || !resetToken)
    throw new ApiError(400, "feild missing");
  if (newpassword !== confirmNewPassword)
    throw new ApiError(400, "fields does not match");

  //check for resetoken
  let decoded;
  try {
    decoded = jwt.verify(resetToken, process.env.RESET_SECRETKEY);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(400, "Reset session expired — please start again");
    }
    throw new ApiError(400, "Invalid reset token");
  }

  if (decoded.purpose !== "password_reset") {
    throw new ApiError(400, "Invalid reset token");
  }

  //update the password
  const user = await User.findById(decoded._id);
  if (!user) throw new ApiError(404, "User not found");

  const hashedPassword = await bcrypt.hash(newpassword, 12);
  user.password = hashedPassword;
  user.refreshToken = []; // logout all devices
  await user.save({ validateBeforeSave: false });

  //send reponse
  res.clearCookie("ResetToken");
  return res.status(200).json(200, "password is changed successfully");
});

export {
  SignupUser,
  getCurrentUser,
  getNewAccessToken,
  loginUser,
  logoutUser,
  logoutUserAllDevice,
  verifyEmailandLogin,
  updateUsername,
  UpdatePassword,
  resendEmail,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
};
