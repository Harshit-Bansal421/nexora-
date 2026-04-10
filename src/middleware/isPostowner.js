import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Post } from "../models/Post.model.js";

export const isPostOwner = asyncHandler(async (req, res, next) => {
  //first get data from url as well as from req body
  //check whether the data is even is present or not

  const post_id = req.params.post_id;
  if (!post_id) throw new ApiError(400, "Post ID is required");

  const user_id = req.user._id;
  if (!user_id) throw new ApiError(401, "Unauthorized access");
  const post=await Post.findById(post_id);
  if (!post) throw new ApiError(404, "Post not found");
  //then check the user is the owner or have authority to modify or delete it
  if(post.owner.toString()!==user_id.toString()) throw new ApiError(403, "You do not have authorization to perform this action");

  //if it has then pass it to next
  req.post=post;
  next();
});
