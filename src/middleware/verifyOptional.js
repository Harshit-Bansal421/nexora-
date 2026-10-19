import { User } from "../models/User.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import mongoose from "mongoose";

const verifyOptional = asyncHandler(async (req, res, next) => {
  const AccessToken =
    req.cookies?.AccessToken ||
    req.header("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!AccessToken) {
    return next();
  }
  // JWT errors — we catch manually because we want specific messages
  let decodedToken;
  try {
    decodedToken = jwt.verify(AccessToken, process.env.ACCESS_TOKEN_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }

  if (!decodedToken?._id || !mongoose.Types.ObjectId.isValid(decodedToken._id)) {
    throw new ApiError(401, "Invalid access token");
  }
  
  const user = await User.findById(decodedToken?._id).select(
    "-password -refreshToken",
  );
  if (!user) throw new ApiError(401, "User not found");
  req.user = user;
  next();
});

export { verifyOptional };
