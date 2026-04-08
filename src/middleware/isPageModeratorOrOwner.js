import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Page } from "../models/Page.model.js";
import mongoose from "mongoose";

const isPageModeratorOrOwner = asyncHandler(async (req, res, next) => {
  //get the user_id from req.user
  const user_id = req.user?._id;
  const { page_id } = req.params;
  if (!user_id) throw new ApiError(401, "User not authenticated");
  if (!page_id) throw new ApiError(400, "Page id is required");

  if (!mongoose.Types.ObjectId.isValid(page_id))
    throw new ApiError(400, "Invalid page id");
  //then check if the user if owner of the page_id
  const response = await Page.findOne({
    _id: page_id,
    $or: [{ owner: user_id }, { moderators: user_id }],
  }).select("_id owner moderators members");
  if (!response)
    throw new ApiError(
      403,
      "only page owner or moderator can perform this task",
    );

  //if yes then next
  req.page = response;
  next();
});

export { isPageModeratorOrOwner };
