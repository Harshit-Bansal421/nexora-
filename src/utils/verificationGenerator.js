import { User } from "../models/User.model.js";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import ApiError from "./ApiError.js";

const refreshTokenGenerator = async (userID) => {
  const user = await User.findById(userID);
  if (!user) throw new ApiError(404, "User not found");
  const refreshToken = user.refreshTokenGenerator();
  user.refreshToken = user.refreshToken || [];
  user.refreshToken.push(refreshToken);
  await user.save({ validateBeforeSave: false });
  return refreshToken;
};

const accessTokenGenerator = async (userID) => {
  const user = await User.findById(userID);
  if (!user) throw new ApiError(404, "User not found");
  const accessToken = user.accessTokenGenerator();
  return accessToken;
};

const OTPgenerator = async () => {
  const plainOTP = randomInt(100000, 1000000).toString();
  const hashedOTP = await bcrypt.hash(plainOTP, 10);
  const expiry = new Date(Date.now() + 10 * 60 * 1000);
  return { plainOTP, hashedOTP, expiry };
};

export { refreshTokenGenerator, accessTokenGenerator, OTPgenerator };
