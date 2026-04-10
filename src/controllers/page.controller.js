import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Page } from "../models/Page.model.js";
import {
  uploadUserImage_cloud,
  getOptimizedImage,
  deleteFromCloudinary,
} from "../utils/Cloudinary.js";
import { Post } from "../models/Post.model.js";
import { JoinRequest } from "../models/Joinrequest.model.js";

const createPage = asyncHandler(async (req, res) => {
  //get the info from req.body
  const { pageName, pageDescription, title, type = "open" } = req.body;
  const pageProfileImage = req.file;
  const owner = req.user._id;

  //validate each of them
  if (!pageName || !pageDescription || !title)
    throw new ApiError(400, "Incomplete information for creating a page");
  if (!pageProfileImage)
    throw new ApiError(400, "Page profile image is required");
  const normalizedTitle = Array.isArray(title) ? title : [title];

  //if not then upload the images to cloudinary and get the public_id
  const cloudinaryresponse = await uploadUserImage_cloud(
    pageProfileImage.path,
    "nexora_pageImage",
    "image",
  );
  if (!cloudinaryresponse)
    throw new ApiError(500, "error in uploading image to cloudinary");

  //then create a entry in database
  try {
    const page = await Page.create({
      owner,
      pageName,
      pageDescription,
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
      throw new ApiError(400, "Page with this name already exists");
    }

    throw error;
  }
});

const deletePage = asyncHandler(async (req, res) => {
  //get page_id from req.post
  const page_id = req.page._id;
  if (!page_id) throw new ApiResponse(404, "page id not found");
  const pageImage = req.page.pageProfileImage;
  //its is validated one so just deleted the page
  const deletedPage = await Page.findByIdAndDelete(page_id);
  if (!deletedPage) throw new ApiError(400, "error in deleting page");

  //delete file from cloudinary also
  if (pageImage) {
    const cloudinaryresponse = await deleteFromCloudinary(pageImage, "image");
    if (!cloudinaryresponse)
      throw new ApiError(400, "error in deleting files from cloudinary");
  }
  //also update all those post which includes this deleted page in their pages array
  const updatedpost = await Post.updateMany(
    { pages: page_id },
    { $pull: { pages: page_id } },
  );
  if (!updatedpost) throw new ApiError(400, "error in uploading post");

  res.status(200).json(new ApiResponse(200, "page deleted successfully"));
});

const getPages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, topic, title } = req.query;

  const PageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (PageNumber - 1) * limitNumber;

  const filter = {};
  if (search) filter.$text = { $search: search };
  if (topic) filter.topic = topic;
  if (title) filter.title = title;
  const query = Page.find(filter);

  if (search) {
    query
      .select({ score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } });
  } else {
    query.sort({ createAt: -1 });
  }

  const pages = await query
    .populate({ path: "owner", select: "username profileImage title" })
    .select("-moderators -members")
    .skip(skip)
    .limit(limitNumber);
  //   console.log(getOptimizedImage(page.pageProfileImage))
  // pages.owner.profileImage=getOptimizedImage(pages.owner.profileImage);
  // pages.pageProfileImage=getOptimizedImage(pages.pageProfileImage);
  pages.map(
    (page) =>
      (page.pageProfileImage = getOptimizedImage(page.pageProfileImage)),
  );
  pages.map(
    (page) =>
      (page.owner.profileImage = getOptimizedImage(page.owner.profileImage)),
  );
  const total = await Page.countDocuments(filter);
  const totalPages = limitNumber ? Math.ceil(total / limitNumber) : 1;

  const isloggedIn = !!req.user;
  let responsePages;
  if (isloggedIn) {
    responsePages = pages;
  } else {
    responsePages = pages.map((page) => ({
      _id: page._id,
      owner: {
        username: page.owner.username,
        profileImage: page.owner.profileImage,
      },
      pagePrifileImage: page?.pageProfileImage,
      pageName: page?.pageName,
      title: page.title,
      membersCount: page.membersCount,
    }));
  }
  console.log(pages);
  res.status(200).json(
    new ApiResponse(
      200,
      {
        pages: responsePages,
        pagination: {
          total,
          page: PageNumber,
          limit: limitNumber,
          totalPages,
          hasNextPage: PageNumber < totalPages,
        },
      },
      "Pages fetched",
    ),
  );
});

const makeModerator = asyncHandler(async (req, res) => {
  //get pageid from req.post and we know the the user that is giving task is owner
  //and we also know upcoming requested users is member of the same page and is an validated array
  const moderators = req.requestedUsers;
  const page_id = req.page._id;
  //make him a moderator
  await Page.updateOne(
    { _id: page_id },
    {
      $addToSet: {
        moderators: { $each: moderators },
      },
    },
  );

  return res
    .status(201)
    .json(new ApiResponse(201, "user are updated to moderators"));
});

const removeModerator = asyncHandler(async (req, res) => {
  //get pageid from req.post and we know the the user that is giving task is owner
  //and we also know upcoming requested users is member of the same page and is an validated array
  const moderators = req.requestedUsers;
  const page_id = req.page._id;

  //we have to check if the one of removing users is owner or not
  const owner_id = req.page.owner;
  if (moderators.includes(owner_id.toString()))
    throw new ApiError(400, "owner cannot be removed from moderators");

  //make him a moderator
  await Page.updateOne(
    { _id: page_id },
    {
      $pullAll: {
        moderators: moderators,
      },
    },
  );

  return res
    .status(201)
    .json(new ApiResponse(201, "user are removed from moderators"));
});

const seeMembersList = asyncHandler(async (req, res) => {
  //get page id from req.page
  const { page = 1, limit = 10 } = req.query;
  const page_id = req.page._id;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const membeList = await Page.findById(page_id)
    .select({
      pageName: 1,
      owner: 1,
      pageProfileImage: 1,
      members: { $slice: [skip, limit] },
    })
    .populate({
      path: "members",
      select: "username profileImage title badge",
    });

  membeList.pageProfileImage = getOptimizedImage(membeList.pageProfileImage);
  membeList.members.profileImage = membeList.members.map(
    (member) => (member.profileImage = getOptimizedImage(member.profileImage)),
  );

  const pagination = {
    total: membeList.membersCount,
    page: pageNumber,
    limit: limitNumber,
    totalPages: Math.ceil(membeList.membersCount / limitNumber),
    hasNextPage: page < Math.ceil(membeList.membersCount / limitNumber),
  };

  //request maker only need to see members name,profileImage,username,title,badge
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { membeList, pagination },
        "member list is fetched successfully",
      ),
    );
});

const removeUser = asyncHandler(async (req, res) => {
  //get page id from req.page and removing user from req.requestedUsers
  const page = req.page;
  const removingUsers = req.requestedUsers.map((id) => id.toString());
  const userPerformingAction = req.user._id;
  const moderatorIds = new Set(page.moderators.map((m) => m.toString()));
  // i have to check if the person who is removing is owner then he can remove anyone except himself
  if (removingUsers.includes(page.owner.toString()))
    throw new ApiError(403, "u cannot remove the owner of the page");

  //if he is not owner that means he is moderator then he can not remove owner or any other moderator
  if (page.owner.toString() !== userPerformingAction.toString()) {
    if (removingUsers.some((id) => moderatorIds.has(id)))
      throw new ApiError(403, "u cannot remove other moderators");
  }
  //remove them
  await Page.updateOne(
    { _id: page._id },
    {
      $pull: {
        moderators: { $in: removingUsers },
        members: { $in: removingUsers },
      },
    },
  );
  //send response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "users is removed from the page"));
});

const joinPage = asyncHandler(async (req, res) => {
  //we get the user_id from req.user and page id from params and get the req.body info
  const user_id = req.user._id;
  const { page_id } = req.params;
  const { message = "" } = req.body || "";

  //validate if page event exist or not and is use is already a member or not
  const page = await Page.findById(page_id);
  if (!page) throw new ApiError(400, "page doesnot exist");

  if (page.members.some((mem) => mem.toString() === user_id.toString()))
    throw new ApiError(400, "u are already a member of this page");

  //then we see if the page is private or open
  if (page.type === "open") {
    //if it is open then just add the user in member list of that page
    await Page.findByIdAndUpdate(page_id, {
      $push: { members: user_id },
    });
    return res
      .status(201)
      .json(new ApiResponse(201, "u are successfully added to this page"));
  }
  //if it is private then validate if user already requested to join or not and then  just create a joinRequest schema
  // Before creating new request, check if one already exists
  const existingRequest = await JoinRequest.findOne({
    page: page_id,
    requestedBy: user_id,
    status: "pending",
  });
  if (existingRequest) throw new ApiError(400, "You already requested to join");

  await JoinRequest.create({
    page: page_id,
    status: "pending",
    message: message,
    requestedBy: user_id,
  });

  // After creating joinRequest, you need to return something
  return res.status(201).json(new ApiResponse(201, "Join request sent"));
});

const seePendingRequest = asyncHandler(async (req, res) => {
  // get page_id from req.page and status is pending
  const page_id = req.page._id;
  const status = "pending";

  const { page = 1, limit = 10 } = req.query;
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

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
        "pending request has been fetched successfully",
      ),
    );
});

const approvePendingRequest = asyncHandler(async (req, res) => {
  //get the page_id from req.page and status and requestedBy from req.body
  const page_id = req.page._id;
  const { status, requestedBy } = req.body;
  if (!status || !requestedBy)
    throw new ApiError(
      400,
      "Incomplete information for reacting to page request",
    );

  //search for request if it still alive or not
  const isStillAlive = await JoinRequest.findOne({
    page: page_id,
    requestedBy: requestedBy,
  });
  if (!isStillAlive) throw new ApiError(400, "no request exist");

  //if yes then check the status
  if (status.toLowerCase().trim() === "approved") {
    //then if status is accept then add member to the page
    const page = await Page.findById(page_id);
    if (page.members.some((m) => m.toString() === requestedBy.toString())) {
      throw new ApiError(400, "User is already a member");
    }
    await Page.findByIdAndUpdate(page_id, {
      $push: { members: requestedBy },
    });

    await JoinRequest.findByIdAndUpdate(isStillAlive._id, {
      status: "approved",
    });
  } else if (status.toLowerCase().trim() === "reject") {
    //if reject just delete the request
    await JoinRequest.findByIdAndUpdate(isStillAlive._id, {
      status: "rejected",
    });
  }
  //send notification to the user of the status
  //todo

  //send response
  return res.status(201).json(new ApiResponse(201, "successfully"));
});

const leavePage = asyncHandler(async (req, res) => {
  //get page id from req.page and userid of the user who want to leave the page from req.user
  const page_id = req.page._id;
  const user_id = req.user._id;

  //validate them
  if (!page_id || !user_id) throw new ApiError(400, "error in fetching ids");

  //check if he is not a owner
  if (req.page.owner.toString() === user_id.toString()) {
    //if he is then ask for new owner id or ownername
    if (!!!req.body)
      throw new ApiError(
        400,
        "u have to pass the ownership to some other member",
      );
    const { newOwner } = req.body; //have to pass id
    if (!newOwner)
      throw new ApiError(
        400,
        "u have to pass the ownership to some other member",
      );
    const response = req.page.members.some(
      (mem) => mem.toString() === newOwner.toString(),
    );
    if (!response)
      throw new ApiError(
        400,
        "ur recommeded user must be a member of this group",
      );
    await Page.findByIdAndUpdate(page_id, {
      owner: newOwner,
      $pull: {
        members: user_id,
        moderators: user_id,
      },
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
  res.status(200).json(new ApiResponse(200, "removed from page successfully"));
});

const updatePageinfo = asyncHandler(async (req, res) => {
  //get info that is to be updated in page from req.body and page id from req.page
  const { pageName, pageDescription, title, type } = req.body;

  const newPageImage = req.file;
  const updated = {};

  //validate each info
  if (pageName) {
    const response = await Page.findOne({ pageName: pageName });
    if (response) throw new ApiError(400, "page with this name already exist");
    updated.pageName = pageName;
  }
  if (pageDescription && pageDescription.length > 0) {
    updated.pageDescription = pageDescription;
  }
  if (type && (type === "open" || type === "private")) {
    updated.type = type;
  }

  //also upload image on clodinary and delete previous image also
  if (newPageImage?.path) {
    const response = await uploadUserImage_cloud(
      newPageImage.path,
      "nexora_pageImage",
      "image",
    );
    if (!response)
      throw new ApiError(500, "error in uploading file on cloudinary");
    await deleteFromCloudinary(req.page.pageProfileImage);
    updated.pageProfileImage = response.public_id;
  }

  //then update info
  let updateQuery = {};

  if (Object.keys(updated).length > 0) {
    updateQuery.$set = updated;
  }

  if (title) {
    const titles = Array.isArray(title) ? title : [title];
    updateQuery.$addToSet = { title: { $each: titles } };
  }

  if (Object.keys(updateQuery).length === 0)
    throw new ApiError(400, "No fields provided to update");

  const updatedpagedata = await Page.findByIdAndUpdate(
    req.page._id,
    updateQuery,
    {
      returnDocument: "after",
    },
  ).select("-moderators -members");
  if (!updatedpagedata) throw new ApiError(400, "error in updating info");

  //send response
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedpagedata, "page is updated successfully"),
    );
});

const getParticularPage = asyncHandler(async (req, res) => {
  const pageId = req.page._id;
  const userId = req.user?._id; // user might not be logged in

  // Get page with populated references
  const page = await Page.findById(pageId)
    .populate("owner", "username email profileImage")
    .populate("moderators", "username email profileImage")
    .populate("members", "username email profileImage");

  if (!page) throw new ApiError(404, "Page not found");

  // Determine user's role in the page
  const isOwner = userId && page.owner._id.toString() === userId.toString();
  const isModerator =
    userId &&
    page.moderators.some((mod) => mod._id.toString() === userId.toString());
  const isMember =
    userId &&
    page.members.some((mem) => mem._id.toString() === userId.toString());

  // Build response based on user role
  let responseData = {
    _id: page._id,
    pageName: page.pageName,
    pageDescription: page.pageDescription,
    title: page.title,
    pageProfileImage: getOptimizedImage(page.pageProfileImage),
    type: page.type,
    membersCount: page.membersCount,
    moderatorsCount: page.moderatorsCount,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };

  // Add owner info for all
  responseData.owner = page.owner;

  // If logged in, add moderators and members list
  if (userId) {
    responseData.moderators = page.moderators.map((mod) => ({
      ...mod.toObject(),
      profileImage: getOptimizedImage(mod.profileImage),
    }));
    responseData.members = page.members.map((mem) => ({
      ...mem.toObject(),
      profileImage: getOptimizedImage(mem.profileImage),
    }));
  }

  // If owner or moderator, add full permissions info
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

  return res
    .status(200)
    .json(new ApiResponse(200, "Page retrieved successfully", responseData));
});

export {
  createPage,
  deletePage,
  getPages,
  makeModerator,
  removeModerator,
  seeMembersList,
  removeUser,
  joinPage,
  seePendingRequest,
  approvePendingRequest,
  leavePage,
  updatePageinfo,
  getParticularPage,
};
