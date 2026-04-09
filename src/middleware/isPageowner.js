import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Page } from "../models/Page.model.js";
import mongoose from "mongoose";

const isPageOwner = asyncHandler(async (req, res, next) => {
  //get the user_id from req.user
  const user_id = req.user?._id;
  if (!user_id) throw new ApiError(401, "User not authenticated");
  if (!mongoose.Types.ObjectId.isValid(user_id))
    throw new ApiError(400, "Invalid user id");
  //then check if the user if owner of the page_id
  if (req.page.owner.toString() !== user_id.toString())
    throw new ApiError(403, "only page owner can perform this task");

  next();
});

export { isPageOwner };
