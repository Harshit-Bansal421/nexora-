import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Comment } from "../models/Comment.model.js";

const isCommentOwner = asyncHandler(async (req, res, next) => {
  //we alredy have a user info from previous middlware
  const user_id = req.user?._id;

  //validate comment id from url
  const { comment_id } = req.params;
  if (!comment_id) throw new ApiError(404, "no comment id is provided");

  if (!mongoose.Types.ObjectId.isValid(comment_id))
    throw new ApiError(400, "comment is id invalid");

  //check if he is the owner of the comment or not
  const comment = await Comment.findById(comment_id).select(
    "_id author status",
  );

  if (!comment) throw new ApiError(404, "no comment found with this id");
  if (comment.author.toString() !== user_id.toString())
    throw new ApiError(400, "U can not perform this action");

  //type in the info
  req.comment = comment;
  next();
});

export {isCommentOwner}