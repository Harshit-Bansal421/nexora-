import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const isPageMember = asyncHandler(async (req, res, next) => {
  //get the requestedUser from req.body and get pageId from req.params and creating post part for independent member check
  let user_id=req.user?._id;

  let members=req.page.members|| [];

  //validate them and make an array if needed
  if (!user_id) throw new ApiError(401, "User is missing");
  if (!mongoose.Types.ObjectId.isValid(user_id)){
      throw new ApiError(400, "Invalid user ID");
  };

  //then check
  if(!members.some(mem=>mem.toString()===user_id.toString())) throw new ApiError(403, "You are not a member of this page")
  next();
});

export { isPageMember };
