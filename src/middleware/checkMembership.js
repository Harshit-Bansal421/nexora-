import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const checkMembership = asyncHandler(async (req, res, next) => {
  if (!req.body) throw new ApiError(400, "No users provided");
  let { users: requestedUsers } = req.body;

  const members=req.page.members|| [];

  //validate them and make an array if needed
  if (!requestedUsers) throw new ApiError(400, "Provide users as an array of member IDs");
  if (!Array.isArray(requestedUsers)) requestedUsers = [requestedUsers];
  if (requestedUsers.length < 1 || requestedUsers.length > 100)
    throw new ApiError(400, "Provide between 1 and 100 requested users");
  requestedUsers.forEach((user) => {
    if (!mongoose.Types.ObjectId.isValid(user))
      throw new ApiError(400, "Some user IDs are invalid");
  });

  //then check
  const memberIds = members.map((m) => m.toString());

  requestedUsers = [...new Set(requestedUsers.map((user) => user.toLowerCase()))];
  const nonMembers = requestedUsers.filter((user) => !memberIds.includes(user));
  if (nonMembers.length > 0)
    throw new ApiError(404, "One or more requested users are not members of this community");

  req.requestedUsers = requestedUsers;
  next();
});

export { checkMembership };
