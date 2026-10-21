import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Page } from "../models/Page.model.js";
import {
  uploadUserImage_cloud,
  getOptimizedImage,
  deleteFromCloudinary,
} from "../utils/Cloudinary.js";
import { Post } from "../models/post.model.js";
import { JoinRequest } from "../models/Joinrequest.model.js";
import { User } from "../models/User.model.js";
import { getIO } from "../socket.js";
import { createNotification } from "../utils/createNotification.js";
import { parsePagination } from "../utils/pagination.js";
import {
  createCommunityListResponse,
  uniqueMemberCount,
} from "../utils/communitySerialization.js";

const createPage = asyncHandler(async (req, res) => {
  const { pageName, pageDescription, title, type = "open" } = req.body || {};
  const pageProfileImage = req.file;
  const owner = req.user._id;

  if (
    typeof pageName !== "string" ||
    typeof pageDescription !== "string" ||
    !pageName.trim() ||
    !pageDescription.trim() ||
    !title
  )
    throw new ApiError(400, "Incomplete information for creating a page");
  if (
    pageName.trim().length > 100 ||
    pageDescription.trim().length < 40 ||
    pageDescription.trim().length > 300
  ) {
    throw new ApiError(400, "Page name or description is outside the allowed length");
  }
  if (!pageProfileImage)
    throw new ApiError(400, "Page profile image is required");
  if (!["open", "private"].includes(type)) {
    throw new ApiError(400, "Page type must be open or private");
  }
  const normalizedTitle = (Array.isArray(title) ? title : [title])
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!normalizedTitle.length || normalizedTitle.length > 10) {
    throw new ApiError(400, "Provide between 1 and 10 valid page topics");
  }

  //if not then upload the images to cloudinary and get the public_id
  const cloudinaryresponse = await uploadUserImage_cloud(
    pageProfileImage.path,
    "nexora_pageImage",
    "image",
  );
  if (!cloudinaryresponse)
    throw new ApiError(500, "Failed to upload page profile image");

  //then create a entry in database
  try {
    const page = await Page.create({
      owner,
      pageName: pageName.trim(),
      pageDescription: pageDescription.trim(),
      title: normalizedTitle,
      type,
      pageProfileImage: cloudinaryresponse.public_id,
      moderators: [owner],
      members: [owner],
    });

    page.pageProfileImage = getOptimizedImage(page.pageProfileImage);

    //then create a object that u will be sending as the response
    res
      .status(201)
      .json(new ApiResponse(201, page, "page is created successfully"));
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "Page with this name already exists");
    }

    throw error;
  }
});

const deletePage = asyncHandler(async (req, res) => {
  //get page_id from req.post
  const page_id = req.page._id;
  if (!page_id) throw new ApiError(400, "Page ID is required");
  const pageImage = req.page.pageProfileImage;
  //its is validated one so just deleted the page
  const deletedPage = await Page.findByIdAndDelete(page_id);
  if (!deletedPage)
    throw new ApiError(404, "Page not found or already deleted");

  //delete file from cloudinary also
  if (pageImage) {
    const cloudinaryresponse = await deleteFromCloudinary(pageImage, "image");
    if (!cloudinaryresponse)
      throw new ApiError(500, "Failed to delete page image from Cloudinary");
  }
  //also update all those post which includes this deleted page in their pages array
  const updatedpost = await Post.updateMany(
    { pages: page_id },
    { $pull: { pages: page_id } },
  );
  if (!updatedpost)
    throw new ApiError(500, "Failed to update associated posts");

  //send live news of deleted page to online user and send notification to all members
  const io = getIO.get();
  const room = `page:${String(page_id).trim()}`;
  io.to(room).emit("deleted-page", deletedPage._id);

  for (const mem of deletedPage.members || []) {
    await createNotification(
      mem,
      deletedPage.owner,
      "page_deleted",
      `${req.user.username} deleted the page u were member of`,
      null,
      null,
      deletedPage._id,
    );
  }

  //send response
  res.status(200).json(new ApiResponse(200, null, "Page deleted successfully"));
});

const getPages = asyncHandler(async (req, res) => {
  const { page: PageNumber, limit: limitNumber, skip } = parsePagination(
    req.query,
  );
  const { search, topic, title } = req.query;

  // Communities are discoverable regardless of access type. Private post access
  // is enforced by getPagePost, and joinPage creates an approval request.
  const filter = {};
  if (search) {
    if (typeof search !== "string" || !search.trim() || search.length > 100) {
      throw new ApiError(400, "Search query cannot exceed 100 characters");
    }
    filter.$text = { $search: search.trim() };
  }
  if (topic) filter.title = topic;
  if (title) filter.title = title;
  const query = Page.find(filter);

  if (search) {
    query
      .select({ score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } });
  } else {
    query.sort({ createdAt: -1 });
  }

  const pages = await query
    .populate({ path: "owner", select: "username profileImage title" })
    .select("-moderators")
    .skip(skip)
    .limit(limitNumber);
  //   console.log(getOptimizedImage(page.pageProfileImage))
  // pages.owner.profileImage=getOptimizedImage(pages.owner.profileImage);
  // pages.pageProfileImage=getOptimizedImage(pages.pageProfileImage);
  pages.map(
    (page) =>
      (page.pageProfileImage = getOptimizedImage(page.pageProfileImage)),
  );
  pages.forEach((page) => {
    if (page.owner) {
      page.owner.profileImage = getOptimizedImage(page.owner.profileImage);
    }
  });
  const total = await Page.countDocuments(filter);
  const totalPages = limitNumber ? Math.ceil(total / limitNumber) : 1;

  res.status(200).json(
    createCommunityListResponse(pages, {
      total,
      page: PageNumber,
      limit: limitNumber,
      totalPages,
      hasNextPage: PageNumber < totalPages,
    }),
  );
});

const makeModerator = asyncHandler(async (req, res) => {
  const moderators = req.requestedUsers;
  const previousModerators = new Set(req.page.moderators.map(String));
  const updatedPage = await Page.findOneAndUpdate(
    { _id: req.page._id, owner: req.user._id, members: { $all: moderators } },
    { $addToSet: { moderators: { $each: moderators } } },
    { new: true },
  );
  if (!updatedPage) throw new ApiError(404, "Community or requested member was not found");

  for (const mod of moderators.filter((id) => !previousModerators.has(String(id)))) {
    await createNotification(
      mod,
      updatedPage.owner,
      "mod_appointed",
      `${req.user.username} appointed you moderator of the page:${updatedPage.pageName}`,
      null,
      null,
      updatedPage._id,
    );
  }

  const io = getIO.get();
  io?.to(`page:${String(updatedPage._id)}`).emit("madeModerator-page", updatedPage);
  return res.status(200).json(new ApiResponse(200, {
    userIds: moderators,
    moderatorsCount: updatedPage.moderators.length,
    membersCount: updatedPage.members.length,
  }, "Users successfully added as moderators"));
});

const removeModerator = asyncHandler(async (req, res) => {
  //get pageid from req.post and we know the the user that is giving task is owner
  //and we also know upcoming requested users is member of the same page and is an validated array
  const moderators = req.requestedUsers;
  if (moderators.some((id) => String(id) === String(req.page.owner))) {
    throw new ApiError(403, "The community owner cannot be demoted");
  }
  const previousModerators = new Set(req.page.moderators.map(String));
  const updatedPage = await Page.findOneAndUpdate(
    { _id: req.page._id, owner: req.user._id },
    { $pull: { moderators: { $in: moderators } } },
    { new: true },
  );
  if (!updatedPage) throw new ApiError(404, "Community not found");
  const io = getIO.get();
  io?.to(`page:${String(updatedPage._id)}`).emit("madeModerator-page", updatedPage);
  for (const mod of moderators.filter((id) => previousModerators.has(String(id)))) {
    await createNotification(
      mod,
      updatedPage.owner,
      "mod_removed",
      `${req.user.username} removed your moderator role from ${updatedPage.pageName}`,
      null,
      null,
      updatedPage._id,
    );
  }
  return res.status(200).json(new ApiResponse(200, {
    userIds: moderators,
    moderatorsCount: updatedPage.moderators.length,
    membersCount: updatedPage.members.length,
  }, "Users removed from moderators successfully"));
});

const seeMembersList = asyncHandler(async (req, res) => {
  const page = req.page;
  const { page: pageNumber, limit: limitNumber, skip } = parsePagination(
    req.query,
  );
  const rawSearch = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const search = rawSearch.slice(0, 80);
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = { _id: { $in: page.members } };
  if (escapedSearch) filter.username = { $regex: escapedSearch, $options: "i" };
  const [members, matchingMembers] = await Promise.all([
    User.find(filter)
      .select("username profileImage title badge")
      .sort({ username: 1, _id: 1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    User.countDocuments(filter),
  ]);
  const membeList = {
    pageName: page.pageName,
    owner: page.owner,
    pageProfileImage: page.pageProfileImage,
    membersCount: uniqueMemberCount(page.members),
    members: members.map((member) => ({
      ...member,
      profileImage: getOptimizedImage(member.profileImage),
      isOwner: String(member._id) === String(page.owner),
      isModerator: page.moderators.some((id) => String(id) === String(member._id)),
    })),
  };
  membeList.pageProfileImage = getOptimizedImage(membeList.pageProfileImage);

  const pagination = {
    total: matchingMembers,
    page: pageNumber,
    limit: limitNumber,
    totalPages: Math.ceil(matchingMembers / limitNumber),
    hasNextPage: pageNumber < Math.ceil(matchingMembers / limitNumber),
  };

  //request maker only need to see members name,profileImage,username,title,badge
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { membeList, pagination },
        "Member list retrieved successfully",
      ),
    );
});

const removeUser = asyncHandler(async (req, res) => {
  const page = req.page;
  let removingUsers = req.body?.users;
  if (removingUsers === undefined) {
    throw new ApiError(400, "Provide users as an array of member IDs");
  }
  if (!Array.isArray(removingUsers)) removingUsers = [removingUsers];
  if (removingUsers.length < 1 || removingUsers.length > 100) {
    throw new ApiError(400, "Provide between 1 and 100 users to remove");
  }
  if (removingUsers.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new ApiError(400, "One or more user IDs are invalid");
  }
  removingUsers = [...new Set(removingUsers.map((id) => String(id).toLowerCase()))];
  const existingUsers = await User.countDocuments({ _id: { $in: removingUsers } });
  if (existingUsers !== removingUsers.length) throw new ApiError(404, "One or more users were not found");
  const moderatorIds = new Set(page.moderators.map((m) => m.toString()));
  if (removingUsers.includes(String(page.owner))) {
    throw new ApiError(403, "The community owner cannot be removed");
  }
  if (String(page.owner) !== String(req.user._id) && removingUsers.some((id) => moderatorIds.has(id))) {
    throw new ApiError(403, "Only the owner can remove moderators");
  }
  const removedMembers = new Set(page.members.map(String));
  const updatedPage = await Page.findOneAndUpdate(
    { _id: page._id },
    { $pull: { moderators: { $in: removingUsers }, members: { $in: removingUsers } } },
    { new: true },
  );
  if (!updatedPage) throw new ApiError(404, "Community not found");
  const io = getIO.get();
  io?.to(`page:${String(page._id)}`).emit("removeuser-page", page._id);

  for (const rem_id of removingUsers.filter((id) => removedMembers.has(id))) {
    await createNotification(
      rem_id,
      req.user._id,
      "page_removed",
      `${req.user.username} removed you from ${page.pageName}`,
      null,
      null,
      page._id,
    )
  }
  
  return res.status(200).json(new ApiResponse(200, {
    userIds: removingUsers,
    membersCount: updatedPage.members.length,
    moderatorsCount: updatedPage.moderators.length,
  }, "Users removed from the page successfully"));
});

const joinPage = asyncHandler(async (req, res) => {
  //we get the user_id from req.user and page id from params and get the req.body info
  const user_id = req.user._id;
  const { page_id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(page_id)) {
    throw new ApiError(400, "Invalid page ID");
  }
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (message.length > 500) {
    throw new ApiError(400, "Join message cannot exceed 500 characters");
  }

  //validate if page event exist or not and is use is already a member or not
  const page = await Page.findById(page_id);
  if (!page) throw new ApiError(404, "Page not found");

  if (page.members.some((mem) => mem.toString() === user_id.toString()))
    throw new ApiError(409, "You are already a member of this page");

  //then we see if the page is private or open
  if (page.type === "open") {
    //if it is open then just add the user in member list of that page
    const updatedPage = await Page.findByIdAndUpdate(
      page_id,
      { $addToSet: { members: user_id } },
      { returnDocument: "after" },
    );

    //here we have to send notification to the owner of the page and live update to the page members 
    const io=getIO.get();
    const room=`page:${String(page_id).trim()}`;
    io.to(room).emit('joined-page',user_id);

    await createNotification(
      updatedPage.owner,
      user_id,
      "page_join",
      `${req.user.username} joined ${updatedPage.pageName}`,
      null,
      null,
      updatedPage._id,
    )
    return res
      .status(200)
      .json(new ApiResponse(200, "Successfully joined the page"));
  }
  //if it is private then validate if user already requested to join or not and then  just create a joinRequest schema
  // Before creating new request, check if one already exists
  const existingRequest = await JoinRequest.findOne({
    page: page_id,
    requestedBy: user_id,
    status: { $in: ["pending", "approved"] },
  });
  if (existingRequest?.status === "approved") {
    throw new ApiError(409, "You are already a member of this page");
  }
  if (existingRequest) throw new ApiError(409, "Join request already exists");

  const rejectedRequest = await JoinRequest.findOneAndUpdate(
    { page: page_id, requestedBy: user_id, status: "rejected" },
    { $set: { status: "pending", message } },
    { returnDocument: "after" },
  );
  if (!rejectedRequest) {
    try {
      await JoinRequest.create({
        page: page_id,
        status: "pending",
        message,
        requestedBy: user_id,
      });
    } catch (error) {
      if (error.code === 11000) {
        throw new ApiError(409, "Join request already exists");
      }
      throw error;
    }
  }

  await createNotification(
    page.owner,
    req.user._id,
    "join_request",
    `${req.user.username} requested to join ${page.pageName}`,
    null,
    null,
    page._id,
  )

  // After creating joinRequest, you need to return something
  return res
    .status(201)
    .json(new ApiResponse(201, "Join request sent successfully"));
});

const seePendingRequest = asyncHandler(async (req, res) => {
  // get page_id from req.page and status is pending
  const page_id = req.page._id;
  const status = "pending";

  const { page: pageNumber, limit: limitNumber, skip } = parsePagination(
    req.query,
  );

  //get pending request from join request and use aggregate pipeline for requestedBy info
  const requests = await JoinRequest.find({ page: page_id, status: status })
    .populate({
      path: "requestedBy",
      select: "_id username title badge profileImage",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber)
    .lean();

  const total = await JoinRequest.countDocuments({
    page: page_id,
    status: status,
  });
  const totalPages = Math.ceil(total / limitNumber);
  const pagination = {
    total,
    page: pageNumber,
    limit: limitNumber,
    totalPages,
    hasNextPage: pageNumber < totalPages,
  };

  requests.forEach(
    (oneRequest) =>
      (oneRequest.requestedBy.profileImage = getOptimizedImage(
        oneRequest.requestedBy.profileImage,
      )),
  );

  //send info
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { pendingRequest: requests, pagination },
        "Pending requests fetched successfully",
      ),
    );
});

const approvePendingRequest = asyncHandler(async (req, res) => {
  //get the page_id from req.page and status and requestedBy from req.body
  const page_id = req.page._id;
  const { status, requestedBy } = req.body || {};
  if (
    !["approved", "reject"].includes(
      typeof status === "string" ? status.trim().toLowerCase() : "",
    ) ||
    !mongoose.Types.ObjectId.isValid(requestedBy)
  )
    throw new ApiError(
      400,
      "A valid request status and user ID are required",
    );
  const normalizedStatus = status.trim().toLowerCase();

  //search for request if it still alive or not
  const isStillAlive = await JoinRequest.findOne({
    page: page_id,
    requestedBy: requestedBy,
    status: "pending",
  });
  if (!isStillAlive) throw new ApiError(404, "Join request not found");

  //if yes then check the status
  if (normalizedStatus === "approved") {
    //then if status is accept then add member to the page
    const page = await Page.findById(page_id);
    if (page.members.some((m) => m.toString() === requestedBy.toString())) {
      throw new ApiError(409, "User is already a member");
    }
    await Page.findByIdAndUpdate(page_id, {
      $addToSet: { members: requestedBy },
    });
  }
  await JoinRequest.findByIdAndUpdate(isStillAlive._id, {
    status: normalizedStatus === "approved" ? "approved" : "rejected",
  });
  //send notification to the user of the status
  const io=getIO.get();
  const room=`page:${String(page_id).trim()}`
  io.to(room).emit('responseJoin-page',{
    pageid:page_id,
    requestedBy:requestedBy,
    status: normalizedStatus
  });

  await createNotification(
    requestedBy,
    req.user._id,
    normalizedStatus === "approved" ? "request_approved" : "request_rejected",
    `${req.user.username} ${normalizedStatus} your request to join ${req.page.pageName}`,
    null,
    null,
    page_id,
  )
  //send response
  return res
    .status(200)
    .json(new ApiResponse(200, "Request processed successfully"));
});

const leavePage = asyncHandler(async (req, res) => {
  //get page id from req.page and userid of the user who want to leave the page from req.user
  const page_id = req.page._id;
  const user_id = req.user._id;

  //validate them
  if (!page_id || !user_id) throw new ApiError(400, "Invalid page or user ID");

  //check if he is not a owner
  if (req.page.owner.toString() === user_id.toString()) {
    //if he is then ask for new owner id or ownername
    if (!req.body)
      throw new ApiError(400, "Ownership must be transferred before leaving");
    const { newOwner } = req.body; //have to pass id
    if (!newOwner)
      throw new ApiError(400, "Ownership must be transferred before leaving");
    const response = req.page.members.some(
      (mem) => mem.toString() === newOwner.toString(),
    );
    if (!response)
      throw new ApiError(
        400,
        "New owner must be an existing member of the page",
      );
    if (newOwner.toString() === user_id.toString()) {
      throw new ApiError(400, "Choose another page member as the new owner");
    }
    await Page.findByIdAndUpdate(page_id, {
      $set: { owner: newOwner },
      $pull: { members: user_id, moderators: user_id },
    });
    await Page.findByIdAndUpdate(page_id, {
      $addToSet: { members: newOwner, moderators: newOwner },
    });
  } else {
    //if he is not then just remove him from the page
    await Page.findByIdAndUpdate(page_id, {
      $pull: {
        members: user_id,
        moderators: user_id,
      },
    });
  }
  //send response
  res.status(200).json(new ApiResponse(200, "Successfully left the page"));
});

const updatePageinfo = asyncHandler(async (req, res) => {
  const { pageName, pageDescription, title, type } = req.body || {};

  const newPageImage = req.file;
  const updated = {};

  if (pageName !== undefined) {
    if (typeof pageName !== "string" || !pageName.trim() || pageName.trim().length > 100) {
      throw new ApiError(400, "Page name must contain 1 to 100 characters");
    }
    const response = await Page.findOne({
      pageName: pageName.trim(),
      _id: { $ne: req.page._id },
    });
    if (response) throw new ApiError(409, "Page with this name already exists");
    updated.pageName = pageName.trim();
  }
  if (pageDescription !== undefined) {
    if (
      typeof pageDescription !== "string" ||
      pageDescription.trim().length < 40 ||
      pageDescription.trim().length > 300
    ) {
      throw new ApiError(400, "Page description must contain 40 to 300 characters");
    }
    updated.pageDescription = pageDescription.trim();
  }
  if (type !== undefined && !["open", "private"].includes(type)) {
    throw new ApiError(400, "Page type must be open or private");
  }
  if (type !== undefined) {
    updated.type = type;
  }
  let titles = [];
  if (title !== undefined) {
    titles = (Array.isArray(title) ? title : [title])
      .filter((value) => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!titles.length || titles.length > 10) {
      throw new ApiError(400, "Provide between 1 and 10 valid page topics");
    }
  }

  if (newPageImage?.path) {
    const response = await uploadUserImage_cloud(
      newPageImage.path,
      "nexora_pageImage",
      "image",
    );
    if (!response)
      throw new ApiError(500, "Failed to upload image to Cloudinary");
    updated.pageProfileImage = response.public_id;
  }

  //then update info
  let updateQuery = {};

  if (Object.keys(updated).length > 0) {
    updateQuery.$set = updated;
  }

  if (titles.length) {
    updateQuery.$addToSet = { title: { $each: titles } };
  }

  if (Object.keys(updateQuery).length === 0)
    throw new ApiError(400, "No fields provided to update");

  const updatedpagedata = await Page.findByIdAndUpdate(
    req.page._id,
    updateQuery,
    {
      returnDocument: "after",
      runValidators: true,
    },
  ).select("-moderators -members");

  if (!updatedpagedata)
    throw new ApiError(500, "Failed to update page information");

  if (updated.pageProfileImage && req.page.pageProfileImage) {
    await deleteFromCloudinary(req.page.pageProfileImage, "image");
  }
  if (updatedpagedata && updatedpagedata.pageProfileImage) {
    updatedpagedata.pageProfileImage = getOptimizedImage(
      updatedpagedata.pageProfileImage,
    );
  }

  //send live response 
  const io=getIO.get();
  const room=`page:${String(updatedpagedata._id).trim()}`;
  io.to(room).emit("updated-page",updatedpagedata);

  //send response
  return res
    .status(200)
    .json(new ApiResponse(200, updatedpagedata, "Page updated successfully"));
});

const getParticularPage = asyncHandler(async (req, res) => {
  const pageId = req.page._id;
  const userId = req.user?._id; // user might not be logged in

  // Get page with populated references
  const page = await Page.findById(pageId)
    .populate("owner", "username profileImage title");

  if (!page) throw new ApiError(404, "Page not found");

  const isOwner = userId && page.owner._id.toString() === userId.toString();
  const [isModerator, isMember] = userId
    ? await Promise.all([
        Page.exists({ _id: pageId, moderators: userId }),
        Page.exists({ _id: pageId, members: userId }),
      ])
    : [false, false];
  // Build response based on user role
  let responseData = {
    _id: page._id,
    pageName: page.pageName,
    pageDescription: page.pageDescription,
    title: page.title,
    pageProfileImage: getOptimizedImage(page.pageProfileImage),
    pageCoverImage: page.pageCoverImage,
    type: page.type,
    membersCount: uniqueMemberCount(page.members),
    moderatorsCount: page.moderatorsCount,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };

  // Add owner info for all
  responseData.owner = page.owner;

  if (isOwner || isModerator) {
    responseData.userRole = isOwner ? "owner" : "moderator";
    responseData.canEditPage = true;
    responseData.canDeletePage = isOwner;
    responseData.canApproveModerators = isOwner;
    responseData.canManageMembers = true;
  } else if (isMember) {
    responseData.userRole = "member";
    responseData.canEditPage = false;
    responseData.canDeletePage = false;
  } else if (userId) {
    responseData.userRole = "viewer";
  } else {
    responseData.userRole = "guest";
  }
  responseData.canViewContent =
    page.type !== "private" || Boolean(isOwner || isModerator || isMember);
  if (page.type === "private" && userId && !responseData.canViewContent) {
    responseData.pendingJoinRequest = Boolean(
      await JoinRequest.exists({
        page: pageId,
        requestedBy: userId,
        status: "pending",
      }),
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, responseData, "Page retrieved successfully"));
});

export {
  createPage,
  deletePage, //need socket and notification to members of page
  getPages,
  makeModerator, //need notification
  removeModerator, //need notification
  seeMembersList,
  removeUser, //both
  joinPage, //both
  seePendingRequest,
  approvePendingRequest, //both
  leavePage,
  updatePageinfo, //need socket
  getParticularPage,
};
