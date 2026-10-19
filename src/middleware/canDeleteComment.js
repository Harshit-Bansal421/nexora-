import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Comment } from "../models/Comment.model.js";
import { Post } from "../models/post.model.js";

const canDeleteComment = asyncHandler(async (req, res, next) => {
  const commentId = req.params.comment_id;
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId).select(
    "_id author post status",
  );
  if (!comment) throw new ApiError(404, "Comment not found");

  const viewerId = String(req.user?._id || "");
  const isCommentAuthor = String(comment.author) === viewerId;
  let isPostOwner = false;
  if (!isCommentAuthor) {
    const post = await Post.findById(comment.post).select("owner");
    if (!post) throw new ApiError(404, "Comment post not found");
    isPostOwner = String(post.owner) === viewerId;
  }

  if (!isCommentAuthor && !isPostOwner) {
    throw new ApiError(403, "Only the comment author or post owner can delete this comment");
  }

  req.comment = comment;
  next();
});

export { canDeleteComment };
