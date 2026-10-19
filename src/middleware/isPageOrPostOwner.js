import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { Page } from "../models/Page.model.js";
import { Post } from "../models/Post.model.js";

const isPageOrPostOwner = asyncHandler(async (req, res, next) => {
  //we have user id from req.user and we get pages_id in which he want to add the post from req.body
  const user_id = req.user._id;
  const { post_id } = req.params;
  if (!(post_id && mongoose.Types.ObjectId.isValid(post_id)))
    throw new ApiError(400, "Valid Post ID is required");
  if (!req.body || !req.body.pages)
    throw new ApiError(400, "No details provided");
  let {pages} = req.body;
  if (!pages) throw new ApiError(400, "no details are provided");
  if (!Array.isArray(pages)) pages = [pages];

  if (pages.length < 1 || pages.length > 10) {
    throw new ApiError(400, "Provide between 1 and 10 page IDs");
  }

  let validpages = pages.filter((page) =>
    mongoose.Types.ObjectId.isValid(page),
  );
  if (validpages.length !== pages.length)
    throw new ApiError(400, "Some page IDs are invalid");
  //check if user is a owner of post or not?
  //if yes then yes he can move to next layer
  const post = await Post.findById(post_id).select("_id pages");
  if (!post) throw new ApiError(404, "Post not found");

  const pageIds = [...new Set(validpages.map((page) => String(page).toLowerCase()))];
  const targetPages = await Page.find({ _id: { $in: pageIds } }).select(
    "_id owner moderators",
  );
  if (targetPages.length !== pageIds.length) {
    throw new ApiError(404, "One or more pages do not exist");
  }

  const canManageAllPages = targetPages.every(
    (page) =>
      page.owner.equals(user_id) ||
      page.moderators.some((moderator) => moderator.equals(user_id)),
  );
  if (!canManageAllPages) {
    throw new ApiError(403, "You must moderate every target page");
  }

  //if yes then he can add
  req.post = post;
  req.pages = pageIds;
  return next();
});

export { isPageOrPostOwner };
