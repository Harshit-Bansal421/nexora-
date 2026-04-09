import { User } from "../models/User.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const verifyOptional = asyncHandler(async (req, res, next) => {
  const AccessToken =
    req.cookies.AccessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
  if (!AccessToken) {
    return next();
  }
  // JWT errors — we catch manually because we want specific messages
  let decodedToken;
  try {
    decodedToken = jwt.verify(AccessToken, process.env.ACCESS_TOKEN_SECRET);
  } catch (error) {
    return next();
  }
  
  const user = await User.findById(decodedToken?._id).select(
    "-password -refreshToken",
  );
  if (!user) {
    return next();
  }
  req.user = user;
  next();
});

export { verifyOptional };
