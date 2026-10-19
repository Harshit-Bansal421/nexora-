import { User } from "../models/User.model.js";
import ApiError from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const jwtVerify = asyncHandler(async (req, res, next) => {
  const AccessToken =
    req.cookies?.AccessToken ||
    req.header("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!AccessToken) {
    throw new ApiError(401, "Unauthorized — no token provided");
  }
  // JWT errors — we catch manually because we want specific messages
  let decodedToken;
  try {
    decodedToken = jwt.verify(AccessToken, process.env.ACCESS_TOKEN_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Access token expired");
    }

    if (!decodedToken?._id || !mongoose.Types.ObjectId.isValid(decodedToken._id)) {
      throw new ApiError(401, "Invalid access token");
    }
    if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid access token");
    }
    throw new ApiError(401, error.message || "Unauthorized access");
  }

  if (decodedToken?.tokenUse) {
    throw new ApiError(401, "Socket tokens cannot be used for API requests");
  }
  
  const user = await User.findById(decodedToken?._id).select(
    "-password -refreshToken",
  );
  if (!user) {
    throw new ApiError(401, "User not found");
  }
  req.user = user;
  next();
});

export { jwtVerify };
