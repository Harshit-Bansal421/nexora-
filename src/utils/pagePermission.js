import ApiError from "./ApiError.js";
import { Page } from "../models/Page.model.js";
import mongoose from "mongoose";

export const isPageOwner = async (page_id, user_id) => {
  if (!user_id) throw new ApiError(401, "User not authenticated");
  if (!page_id) throw new ApiError(400, "Page id is required");

  if (!mongoose.Types.ObjectId.isValid(page_id))
    throw new ApiError(400, "Invalid page id");
  //then check if the user if owner of the page_id
  const response = await Page.findOne({
    _id: page_id,
    owner: user_id,
  }).select("_id owner moderators members");
  if (!response) return false;
  return true;
};

export const pageType= async (page_id) => {
  if (!page_id) throw new ApiError(400, "Page id is required");

  if (!mongoose.Types.ObjectId.isValid(page_id))
    throw new ApiError(400, "Invalid page id");
  //check the status and return 
  const status=await Page.findById(page_id).select("type");
  if(!status) throw new ApiError(404,"error in fetching the status of page");
  return status.type;
};

