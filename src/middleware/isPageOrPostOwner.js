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
    throw new ApiError(400, "no valid post id is provided");
  if (!req.body || !req.body.pages)
    throw new ApiError(400, "no details are provided");
  let {pages} = req.body;
  if (!pages) throw new ApiError(400, "no details are provided");
  if (!Array.isArray(pages)) pages = [pages];

  if (pages.length < 1) throw new ApiError(400, "no details are provided");

  let validpages = pages.filter((page) =>
    mongoose.Types.ObjectId.isValid(page),
  );
  if (validpages.length !== pages.length)
    throw new ApiError(400, "some of the pages id are not valid");
  req.pages = pages;

  //check if user is a owner of post or not?
  //if yes then yes he can move to next layer
  const post_owner = await Post.findOne({ _id: post_id }).select("owner");
  if (post_owner.owner.toString() === user_id.toString()) return next();

  //if no then is he a owner of the page
  const pages_owner = await Page.find({ _id: { $in: pages } }).select("owner");
  //if no then he cannot perform this action
  const isOwnerOfAllPages = pages_owner.every(
    (page) => page.owner.toString() === user_id.toString(),
  );
  if (!isOwnerOfAllPages)
    throw new ApiError(403, "You don't own all these pages");

  //if yes then he can add
  return next();
});

export { isPageOrPostOwner };
