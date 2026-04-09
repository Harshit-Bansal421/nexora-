import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Page } from "../models/Page.model.js";
import {
  uploadUserImage_cloud,
  getOptimizedImage,
  getOptimizedVideo,
  deleteFromCloudinary,
} from "../utils/Cloudinary.js";
import { Post } from "../models/Post.model.js";

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
    .json(new ApiResponse(201, "user are updated to moderators"));
});

const seeMembersList = asyncHandler(async (req, res) => {
  //get page id from req.page
  const { page = 1, limit = 10 } = req.query;
  const page_id = req.page._id;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const membeList = await Page.findById(page_id)
    .select({ pageName: 1, owner: 1, pageProfileImage:1,members: { $slice: [skip, limit] } })
    .populate({
      path: "members",
      select: "username profileImage title badge",
    });

  membeList.pageProfileImage=getOptimizedImage(membeList.pageProfileImage);
  membeList.members.profileImage=membeList.members.map(member=>member.profileImage=getOptimizedImage(member.profileImage));

  const pagination={
    total:membeList.membersCount,
    page:pageNumber,
    limit:limitNumber,
    totalPages:Math.ceil(membeList.membersCount/limitNumber),
    hasNextPage:page<Math.ceil(membeList.membersCount/limitNumber)
  }

  //request maker only need to see members name,profileImage,username,title,badge
  res
    .status(200)
    .json(
      new ApiResponse(200, {membeList,pagination}, "member list is fetched successfully"),
    );
});

export {
  createPage,
  deletePage,
  getPages,
  makeModerator,
  removeModerator,
  seeMembersList,
};
