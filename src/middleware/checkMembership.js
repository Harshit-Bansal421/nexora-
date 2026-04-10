import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const checkMembership = asyncHandler(async (req, res, next) => {
  //get the requestedUser from req.body and get pageId from req.params and creating post part for independent member check
  if(!(!!req.body)) throw new ApiError(400,"No users provided");
  let { users: requestedUsers } = req.body;

  const members=req.page.members|| [];

  //validate them and make an array if needed
  if (!requestedUsers) throw new ApiError(400, "Requested users are missing");
  if (!Array.isArray(requestedUsers)) requestedUsers = [requestedUsers];
  if (requestedUsers.length < 1)
    throw new ApiError(400, "requested user array is empty");
  requestedUsers.forEach((user) => {
    if (!mongoose.Types.ObjectId.isValid(user))
      throw new ApiError(400, "Some user IDs are invalid");
  });

  //then check
  const memberIds = members.map((m) => m.toString());

  const nonMembers = requestedUsers.filter((user) => !memberIds.includes(user));
  if (nonMembers.length > 0)
    throw new ApiError(
      400,
      "some of the user are not even members of the group",
    );

  req.requestedUsers = requestedUsers;
  next();
});

export { checkMembership };
