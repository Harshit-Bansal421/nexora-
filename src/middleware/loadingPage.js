import { asyncHandler } from "../utils/asyncHandler.js";
import { Page } from "../models/Page.model.js";
import ApiError from "../utils/ApiError.js";
import mongoose from "mongoose";

const loadingPage = asyncHandler(async (req, res, next) => {
  const { page_id } = req.params;
  if (!page_id) throw new ApiError(400, "Page id is required");

  if (!mongoose.Types.ObjectId.isValid(page_id))
    throw new ApiError(400, "Invalid page id");
  const page = await Page.findById(page_id).select(
    "_id owner members pageProfileImage moderators",
  );
  if(!page) throw new ApiError(400,"no page exist with this pageID");
  req.page = page;
  next();
});

export { loadingPage };
