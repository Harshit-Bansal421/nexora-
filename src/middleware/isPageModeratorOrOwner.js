import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Page } from "../models/Page.model.js";
import mongoose from "mongoose";

const isPageModeratorOrOwner = asyncHandler(async (req, res, next) => {
  //get the user_id from req.user
  const user_id = req.user?._id;
  if (!user_id) throw new ApiError(401, "User not authenticated");
  if (!mongoose.Types.ObjectId.isValid(user_id))
    throw new ApiError(400, "Invalid Page ID");

  const owner = req.page.owner;
  const moderators = req.page.moderators;
  //then check if the user is owner or moderator of the page_id
  if (
    !(
      owner.toString() === user_id.toString() ||
      moderators.some((moderate) => moderate.toString() === user_id.toString())
    )
  )
    throw new ApiError(403, "You do not have authorization to perform this action");
  next();
});

export { isPageModeratorOrOwner };
