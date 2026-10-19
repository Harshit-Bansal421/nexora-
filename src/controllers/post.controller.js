import { Post } from "../models/post.model.js";
import { Comment } from "../models/Comment.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  uploadUserImage_cloud,
  getOptimizedImage,
  getOptimizedVideo,
  deleteFromCloudinary,
} from "../utils/Cloudinary.js";
import { User } from "../models/User.model.js";
import mongoose from "mongoose";
import { Page } from "../models/Page.model.js";
import { createNotification } from "../utils/createNotification.js";
import { getIO, sendToUser } from "../socket.js";
import {
  assertPostAccess,
  postVisibilityStagesForUser,
  publicPostVisibilityStages,
} from "../utils/postAccess.js";
import { parsePagination } from "../utils/pagination.js";

const attachCommentCounts = async (posts) => {
  if (!posts.length) return posts;
  const counts = await Comment.aggregate([
    {
      $match: {
        post: { $in: posts.map((post) => new mongoose.Types.ObjectId(post._id)) },
        parentComment: null,
      },
    },
    { $group: { _id: "$post", count: { $sum: 1 } } },
  ]);
  const countByPostId = new Map(counts.map((row) => [String(row._id), row.count]));
  return posts.map((post) => ({
    ...post,
    commentsCount: countByPostId.get(String(post._id)) || 0,
  }));
};

const createPost = asyncHandler(async (req, res) => {
  //get all the info from req.body,req.user,req.files
  let { description, topic, title, pages } = req.body;
  const owner = req.user?._id;
  const Images = req.files?.PostImages;
  const Videos = req.files?.PostVideos;

  if (!owner) throw new ApiError(401, "Unauthorized access");
  if (typeof title !== "string" || !title.trim() || typeof topic !== "string") {
    throw new ApiError(400, "Title and topic are required");
  }
  if (typeof description !== "string") description = "";
  if (description.length > 500 || title.trim().length > 150) {
    throw new ApiError(400, "Title or description exceeds the allowed length");
  }
  pages = pages ? (Array.isArray(pages) ? pages : [pages]) : [];
  if (
    pages.length > 10 ||
    pages.some((page) => !mongoose.Types.ObjectId.isValid(page))
  ) {
    throw new ApiError(400, "Page IDs must be valid and no more than 10");
  }
  const pageIds = [...new Set(pages.map(String))];
  if (pageIds.length) {
    const targetPages = await Page.find({ _id: { $in: pageIds } }).select(
      "owner members moderators",
    );
    if (targetPages.length !== pageIds.length) {
      throw new ApiError(404, "One or more pages do not exist");
    }
    const canPostToAll = targetPages.every(
      (page) =>
        page.owner.equals(owner) ||
        page.members.some((member) => member.equals(owner)) ||
        page.moderators.some((moderator) => moderator.equals(owner)),
    );
    if (!canPostToAll) {
      throw new ApiError(403, "You must be a member of every target page");
    }
  }
  pages = pageIds;

  //then upload the images on cloudinary
  const [postImage, postVideo] = await Promise.all([
    Promise.all(
      Images?.map(async (image) => {
        const response = await uploadUserImage_cloud(
          image.path,
          "nexora_postImage",
          "image",
        );
        if (!response?.public_id) {
          throw new ApiError(500, "Failed to upload image");
        }
        return response.public_id;
      }) || [],
    ),
    Promise.all(
      Videos?.map(async (video) => {
        const response = await uploadUserImage_cloud(
          video.path,
          "nexora_postVideos",
          "video",
        );
        if (!response?.public_id) {
          throw new ApiError(500, "Failed to upload video");
        }
        return response.public_id;
      }) || [],
    ),
  ]);

  //get the public_id and then upload the post into database
  const post = await Post.create({
    postImage,
    description,
    topic,
    title,
    postVideo,
    owner,
    pages,
  });

  post.postImage = (post.postImage || []).map((image) =>
    getOptimizedImage(image),
  );

  //modify the returned object with secure_url
  const postResponse = {
    ...post.toObject(),
    postImage: postImage.map(getOptimizedImage),
    postVideo: postVideo.map(getOptimizedVideo),
  };

  //send live response and there is no need for notification
  const io = getIO.get();
  (postResponse.pages || []).forEach((page_id) => {
    const room = `page:${page_id.toString().trim()}`;
    io.to(room).emit("post-created", postResponse);
  });

  //then send the response
  res
    .status(201)
    .json(new ApiResponse(201, postResponse, "Post created successfully"));
});

const deletePost = asyncHandler(async (req, res) => {
  //we already have the postid and we have verified whether the user is owner so now take that id fetched details for cloudinary delete
  const post = req.post;
  if (!post) throw new ApiError(404, "Post not found");

  //then delete images and videos in cloudinary
  await Promise.all(
    post.postImage.map((id) => deleteFromCloudinary(id, "image")),
  );

  await Promise.all(
    post.postVideo.map((id) => deleteFromCloudinary(id, "video")),
  );

  // 3. remove the deleting post from users saved posts
  const savedPostresponse = await User.updateMany(
    { savedPost: post._id },
    { $pull: { savedPost: post._id } },
  );
  if (!savedPostresponse)
    throw new ApiError(500, "Failed to remove post from saved posts");

  //delete the collection in database
  const deletedPost = await Post.findByIdAndDelete(post._id);
  if (!deletedPost) throw new ApiError(400, "error in deleting the post");

  //send live response to post as well as to all pages in which this post is available
  const io = getIO.get();
  const room = `post:${deletedPost._id?.toString().trim()}`;
  io.to(room).emit("post-deleted", deletedPost);

  (deletedPost.pages || []).forEach((page_id) => {
    const room = `page:${page_id.toString().trim()}`;
    io.to(room).emit("post-deleted", deletedPost);
  });

  //send success response
  res.status(200).json(new ApiResponse(200, null, "Post deleted successfully"));
});

const AddExistingPostToPage = asyncHandler(async (req, res) => {
  //we expect an array of page id
  const { post_id } = req.params;
  const pages = (req.pages || []).map((id) => String(id).trim());

  const post = req.post;
  if (!post) throw new ApiError(404, "Post not found");
  const existingIds = (post.pages || []).map(String);
  if (pages.some((page) => existingIds.includes(page))) {
    throw new ApiError(409, "Post is already attached to one or more pages");
  }

  //we already have data of post from isowner verification middleware so we just gonnna add new pages to existing page
  const returnedPost = await Post.findByIdAndUpdate(
    post_id,
    {
      $addToSet: {
        pages: { $each: pages },
      },
    },
    { returnDocument: "after" },
  );

  //send live response to the user and also notification to the page owner
  const io = getIO.get();
  (pages || []).forEach(async (page_id) => {
    const room = `page:${page_id.toString().trim()}`;
    io.to(room).emit("addPost-to-page", returnedPost);
  });

  //save them
  res
    .status(200)
    .json(new ApiResponse(200, "Post successfully added to pages"));
});

const updatePost = asyncHandler(async (req, res) => {
  //we will get the new updates from req.body and req.files
  //in remove part frontend will send me the remove item public_id
  let { description, topic, title, removeImages, removeVideos } = req.body || {};
  let addImages = req.files?.addImages;
  let addVideos = req.files?.addVideos;
  if (!req.post) throw new ApiError(404, "Post not found");
  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim() || title.trim().length > 150) {
      throw new ApiError(400, "Title must contain 1 to 150 characters");
    }
    title = title.trim();
  }
  if (description !== undefined && (typeof description !== "string" || description.length > 500)) {
    throw new ApiError(400, "Description cannot exceed 500 characters");
  }
  if (topic !== undefined && !["Academic", "Career", "Tech", "Life"].includes(topic)) {
    throw new ApiError(400, "Invalid post topic");
  }
  if (removeImages !== undefined && !Array.isArray(removeImages)) removeImages = [removeImages];
  if (removeVideos !== undefined && !Array.isArray(removeVideos)) removeVideos = [removeVideos];
  if (addImages !== undefined && !Array.isArray(addImages)) addImages = [addImages];
  if (addVideos !== undefined && !Array.isArray(addVideos)) addVideos = [addVideos];
  removeImages ||= [];
  removeVideos ||= [];
  addImages ||= [];
  addVideos ||= [];

  //if addimages then we validate and updload images and store their public_id in a variable
  if (addImages.length + req.post.postImage.length - new Set(removeImages).size > 3) {
      throw new ApiError(400, "Maximum number of images exceeded");
  }
  let addedImages = [];
  if (addImages?.length > 0) {
    addedImages = await Promise.all(
      addImages.map(async (image) => {
        const res = await uploadUserImage_cloud(
          image.path,
          "nexora_postImage",
          "image",
        );
        return res.public_id;
      }),
    );
  }

  //if remove images then we validate and destroy images and remove their public_id from req.post.postImage
  if (removeImages.length && req.post.postImage) {
    if (removeImages.length > 0) {
      const existingSet = new Set(req.post.postImage);

      const InvalidImages = removeImages.filter(
        (image) => !existingSet.has(image),
      );

      if (InvalidImages.length > 0) {
        throw new ApiError(400, "Some images do not exist in the post");
      }
    }
  }
  await Promise.all(
    (removeImages || []).map((id) => deleteFromCloudinary(id, "image")),
  );

  //if addVideos exist then we validate and updload videos and store their public_id in a variable
  if (addVideos.length + req.post.postVideo.length - new Set(removeVideos).size > 1) {
      throw new ApiError(400, "Maximum number of videos exceeded");
  }
  let addedVideos = [];
  if (addVideos?.length > 0) {
    addedVideos = await Promise.all(
      addVideos.map(async (video) => {
        const res = await uploadUserImage_cloud(
          video.path,
          "nexora_postVideos",
          "video",
        );
        return res.public_id;
      }),
    );
  }

  //if remove videos then we validate and destroy videos and remove their public_id from req.post.postVideo
  if (removeVideos.length && req.post.postVideo) {
    if (removeVideos.length > 0) {
      const existingSet = new Set(req.post.postVideo);

      const InvalidVideos = removeVideos.filter(
        (image) => !existingSet.has(image),
      );

      if (InvalidVideos.length > 0) {
        throw new ApiError(400, "Some videos do not exist in the post");
      }
    }
  }
  await Promise.all(
    (removeVideos || []).map((id) => deleteFromCloudinary(id, "video")),
  );

  //update the info by finding by id
  const updateFields = {};
  if (title !== undefined) updateFields.title = title;
  if (description !== undefined) updateFields.description = description;
  if (topic !== undefined) updateFields.topic = topic;
  const update = {};
  if (Object.keys(updateFields).length) update.$set = updateFields;
  if (removeImages.length || removeVideos.length) {
    update.$pull = {};
    if (removeImages.length) update.$pull.postImage = { $in: removeImages };
    if (removeVideos.length) update.$pull.postVideo = { $in: removeVideos };
  }
  if (addedImages.length || addedVideos.length) {
    update.$addToSet = {};
    if (addedImages.length) update.$addToSet.postImage = { $each: addedImages };
    if (addedVideos.length) update.$addToSet.postVideo = { $each: addedVideos };
  }

  const updatedData = await Post.findByIdAndUpdate(
    req.post.id,
    update,
    { returnDocument: "after", runValidators: true },
  );
  if (!updatedData) throw new ApiError(500, "Failed to update post");

  const postResponse = {
    ...updatedData.toObject(),
    postImage: (updatedData.postImage || []).map(getOptimizedImage),
    postVideo: (updatedData.postVideo || []).map(getOptimizedVideo),
  };

  //send live response of updated post
  const io = getIO.get();
  const room = `post:${String(postResponse._id).trim()}`;
  io.to(room).emit("updated-post", postResponse);
  postResponse.pages.forEach((page) => {
    const room = `page:${String(page).trim()}`;
    io.to(room).emit("updated-post", postResponse);
  });

  //send success reponse
  res
    .status(200)
    .json(new ApiResponse(200, postResponse, "Post updated successfully"));
});

const getPostById = asyncHandler(async (req, res) => {
  // validate the post id
  const postId = req.params.post_id;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(400, "Invalid post ID");
  }
  await assertPostAccess(postId, req.user?._id);

  //i just have to make a aggregate pipeline for the getting upvotes and downvotes and owner and pages of that post
  const postdata = await Post.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(postId) } },
    {
      $lookup: {
        from: "users",
        let: { ownerid: "$owner" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$$ownerid", "$_id"] },
            },
          },
          {
            $project: {
              _id: 1,
              username: 1,
              profileImage: 1,
              title: 1,
              badge: 1,
            },
          },
        ],
        as: "ownerInfo",
      },
    },
    {
      $unwind: {
        path: "$ownerInfo",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
        downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
        upvotesCount: { $size: { $ifNull: ["$upvotes", []] } },
        downvotesCount: { $size: { $ifNull: ["$downvotes", []] } },
        userVote: req.user?._id
          ? {
              $cond: [
                {
                  $in: [
                    new mongoose.Types.ObjectId(req.user._id),
                    { $ifNull: ["$upvotes", []] },
                  ],
                },
                "up",
                {
                  $cond: [
                    {
                      $in: [
                        new mongoose.Types.ObjectId(req.user._id),
                        { $ifNull: ["$downvotes", []] },
                      ],
                    },
                    "down",
                    null,
                  ],
                },
              ],
            }
          : null,
      },
    },
    {
      $project: {
        _id: 1,
        owner: "$ownerInfo",
        upvoteCount: 1,
        downvoteCount: 1,
        upvotesCount: 1,
        downvotesCount: 1,
        userVote: 1,
        topic: 1,
        title: 1,
        postVideo: 1,
        postImage: 1,
        createdAt: 1,
        updatedAt: 1,
        description: 1,
      },
    },
  ]);

  if (!postdata || postdata.length === 0)
    throw new ApiError(404, "Post not found");

  const post = postdata[0];
  const postWithCommentCount = (await attachCommentCounts([post]))[0];
  const postResponse = {
    ...postWithCommentCount,
    postImage: (postWithCommentCount.postImage || []).map(getOptimizedImage),
    postVideo: (postWithCommentCount.postVideo || []).map(getOptimizedVideo),
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, postResponse, "Post data retrieved successfully"),
    );
});

const savePost = asyncHandler(async (req, res) => {
  //get the post from params
  const { post_id } = req.params;

  //validate it and check if it even exist or not
  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    throw new ApiError(400, "Invalid post ID");
  }
  await assertPostAccess(post_id, req.user?._id);

  //it exist then add in user's saved post
  const response = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $addToSet: {
        savedPost: post_id,
      },
    },
    { returnDocument: "after" },
  );
  if (!response) throw new ApiError(500, "Failed to save post");

  //send success response
  return res
    .status(200)
    .json(new ApiResponse(200, response, "Post saved successfully"));
});

const unsavePost = asyncHandler(async (req, res) => {
  //get the post from params
  const { post_id } = req.params;

  //validate it and check if it even exist or not
  if (!post_id) throw new ApiError(400, "Post ID is required");
  const postExisted = await Post.findById(post_id);
  if (!postExisted) throw new ApiError(404, "Post not found");

  //it exist then add in user's saved post
  const response = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $pull: {
        savedPost: post_id,
      },
    },
    { returnDocument: "after" },
  );
  if (!response) throw new ApiError(500, "Failed to unsave post");

  //send success response
  return res
    .status(200)
    .json(new ApiResponse(200, response, "Post unsaved successfully"));
});

const getSavePost = asyncHandler(async (req, res) => {
  const userid = req.user?._id;
  const { page, limit } = parsePagination(req.query);
  if (!userid) throw new ApiError(401, "Unauthorized access");

  const user = await User.findById(userid).select("savedPost").lean();
  if (!user) throw new ApiError(404, "User not found");
  const savedIds = user.savedPost || [];
  const [posts, countResult] = await Promise.all([
    Post.aggregate([
    { $match: { _id: { $in: savedIds } } },
    ...postVisibilityStagesForUser(userid),
    { $sort: { createdAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        pipeline: [
        {
            $project: {
              _id: 1,
              username: 1,
              profileImage: 1,
              title: 1,
              badge: 1,
            },
        },
        ],
        as: "ownerInfo",
      },
    },
    { $unwind: { path: "$ownerInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
        downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
        upvotesCount: { $size: { $ifNull: ["$upvotes", []] } },
        downvotesCount: { $size: { $ifNull: ["$downvotes", []] } },
        userVote: userid
          ? {
              $cond: [
                {
                  $in: [
                    new mongoose.Types.ObjectId(userid),
                    { $ifNull: ["$upvotes", []] },
                  ],
                },
                "up",
                {
                  $cond: [
                    {
                      $in: [
                        new mongoose.Types.ObjectId(userid),
                        { $ifNull: ["$downvotes", []] },
                      ],
                    },
                    "down",
                    null,
                  ],
                },
              ],
            }
          : null,
      },
    },
    {
      $project: {
        _id: 1,
        postImage: 1,
        postVideo: 1,
        title: 1,
        description: 1,
        topic: 1,
        owner: "$ownerInfo",
        ownerInfo: 1,
        upvoteCount: 1,
        downvoteCount: 1,
        upvotesCount: 1,
        downvotesCount: 1,
        userVote: 1,
        createdAt: 1,
      },
    },
    ]),
    Post.aggregate([
      { $match: { _id: { $in: savedIds } } },
      ...postVisibilityStagesForUser(userid),
      { $count: "count" },
    ]),
  ]);
  const total = countResult[0]?.count || 0;

  const savedPostsWithCounts = await attachCommentCounts(posts);
  const modifiedSavedPosts = savedPostsWithCounts.map((post) => ({
    ...post,
    postImage: (post.postImage || []).map(getOptimizedImage),
    postVideo: (post.postVideo || []).map(getOptimizedVideo),
  }));
  return res
    .status(200)
    .json(
    new ApiResponse(
      200,
      {
        savedPost: modifiedSavedPosts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
        },
      },
      "Saved posts retrieved successfully",
    ),
    );
});

const getUserPosts = asyncHandler(async (req, res) => {
  const username = req.params.username?.trim().toLowerCase();
  const { page: pageNumber, limit: limitNumber } = parsePagination(req.query);
  if (!username) throw new ApiError(400, "Username is required");

  const user = await User.findOne({ username }).select(
    "-password -refreshToken",
  );
  if (!user) throw new ApiError(404, "User not found");

  const [result] = await Post.aggregate([
    { $match: { owner: user._id } },
    ...publicPostVisibilityStages(),
    {
      $facet: {
        posts: [
          { $sort: { createdAt: -1 } },
          { $skip: (pageNumber - 1) * limitNumber },
          { $limit: limitNumber },
          {
            $lookup: {
              from: "comments",
              let: { postId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$post", "$$postId"] },
                        { $eq: ["$parentComment", null] },
                      ],
                    },
                  },
                },
                { $count: "count" },
              ],
              as: "commentCountLookup",
            },
          },
          {
            $addFields: {
              commentsCount: {
                $ifNull: [{ $arrayElemAt: ["$commentCountLookup.count", 0] }, 0],
              },
              upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
              upvotesCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvotesCount: { $size: { $ifNull: ["$downvotes", []] } },
              userVote: req.user?._id
                ? {
                    $cond: [
                      {
                        $in: [
                          new mongoose.Types.ObjectId(req.user._id),
                          { $ifNull: ["$upvotes", []] },
                        ],
                      },
                      "up",
                      {
                        $cond: [
                          {
                            $in: [
                              new mongoose.Types.ObjectId(req.user._id),
                              { $ifNull: ["$downvotes", []] },
                            ],
                          },
                          "down",
                          null,
                        ],
                      },
                    ],
                  }
                : null,
            },
          },
          {
            $project: {
              _id: 1,
              postImage: 1,
              postVideo: 1,
              description: 1,
              topic: 1,
              title: 1,
              createdAt: 1,
              updatedAt: 1,
              upvoteCount: 1,
              downvoteCount: 1,
              upvotesCount: 1,
              downvotesCount: 1,
              userVote: 1,
              commentsCount: 1,
              owner: 1,
            },
          },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);
  const posts = result?.posts || [];
  const total = result?.totalCount?.[0]?.count || 0;
  const totalPages = Math.ceil(total / limitNumber);

  const postsWithCommentCounts = await attachCommentCounts(posts);
  const modifiedPosts = postsWithCommentCounts.map((postObj) => {
    return {
      ...postObj,
      postImage: (postObj.postImage || []).map(getOptimizedImage),
      postVideo: (postObj.postVideo || []).map(getOptimizedVideo),
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts: modifiedPosts,
        owner: {
          username: user.username,
          profileImage: user.profileImage,
          _id: user.id,
          title: user.title,
          badge: user.badge,
          bio: user.bio || "",
          createdAt: user.createdAt,
          point: user.point || 0,
          followersCount: user.followers?.length || 0,
          followingCount: user.following?.length || 0,
          isFollowing: Boolean(
            req.user && user.followers?.some((followerId) => String(followerId) === String(req.user._id)),
          ),
        },
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages,
          hasNextPage: pageNumber < totalPages,
        },
      },
      "Posts retrieved successfully",
    ),
  );
});

const getTopicPosts = asyncHandler(async (req, res) => {
  const { topic } = req.params;
  const { page: pageNumber, limit: limitNumber } = parsePagination(req.query);
  if (!topic) throw new ApiError(400, "Topic is required");

  const posts = await Post.aggregate([
    { $match: { topic: topic } },
    ...publicPostVisibilityStages(),
    {
      $facet: {
        posts: [
          { $sort: { createdAt: -1 } },
          { $skip: (pageNumber - 1) * limitNumber },
          { $limit: limitNumber },
          {
            $lookup: {
              from: "users",
              let: { ownerId: "$owner" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$$ownerId", "$_id"] },
                  },
                },
                {
                  $project: {
                    username: 1,
                    _id: 1,
                    profileImage: 1,
                    title: 1,
                    badge: 1,
                  },
                },
              ],
              as: "ownerInfo",
            },
          },
          {
            $addFields: {
              upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
              upvotesCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvotesCount: { $size: { $ifNull: ["$downvotes", []] } },
              userVote: req.user?._id
                ? {
                    $cond: [
                      {
                        $in: [
                          new mongoose.Types.ObjectId(req.user._id),
                          { $ifNull: ["$upvotes", []] },
                        ],
                      },
                      "up",
                      {
                        $cond: [
                          {
                            $in: [
                              new mongoose.Types.ObjectId(req.user._id),
                              { $ifNull: ["$downvotes", []] },
                            ],
                          },
                          "down",
                          null,
                        ],
                      },
                    ],
                  }
                : null,
            },
          },
          {
            $project: {
              _id: 1,
              owner: "$ownerInfo",
              postImage: 1,
              postVideo: 1,
              topic: 1,
              title: 1,
              description: 1,
              createdAt: 1,
              updatedAt: 1,
              upvoteCount: 1,
              downvoteCount: 1,
              upvotesCount: 1,
              downvotesCount: 1,
              userVote: 1,
            },
          },
        ],
        totalcounts: [
          {
            $count: "count",
          },
        ],
      },
    },
  ]);

  if (!posts)
    throw new ApiError(500, "Failed to fetch posts for the given topic");
  //send response
  const result = posts[0];

  const topicPostsWithCounts = await attachCommentCounts(result.posts || []);
  const modifiedTopicPosts = topicPostsWithCounts.map((post) => ({
    ...post,
    postImage: (post.postImage || []).map(getOptimizedImage),
    postVideo: (post.postVideo || []).map(getOptimizedVideo),
  }));

  const total = result.totalcounts[0]?.count || 0;
  const totalPages = Math.ceil(total / limitNumber);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts: modifiedTopicPosts,
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages,
          hasNextPage: pageNumber < totalPages,
        },
      },
      "Posts retrieved successfully",
    ),
  );
});

const getPost = asyncHandler(async (req, res) => {
  const { page: pageNumber, limit: limitNumber } = parsePagination(req.query);
  const postData = await Post.aggregate([
    { $match: {} },
    ...publicPostVisibilityStages(),
    {
      $facet: {
        posts: [
          { $sort: { createdAt: -1 } },
          { $skip: (pageNumber - 1) * limitNumber },
          { $limit: limitNumber },
          {
            $lookup: {
              from: "users",
              let: { ownerInfo: { $ifNull: ["$owner", []] } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$$ownerInfo", "$_id"],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    profileImage: 1,
                    title: 1,
                    badge: 1,
                  },
                },
              ],
              as: "ownerInfo",
            },
          },
          {
            $unwind: {
              path: "$ownerInfo",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $addFields: {
              upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
              upvotesCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvotesCount: { $size: { $ifNull: ["$downvotes", []] } },
              userVote: req.user?._id
                ? {
                    $cond: [
                      {
                        $in: [
                          new mongoose.Types.ObjectId(req.user._id),
                          { $ifNull: ["$upvotes", []] },
                        ],
                      },
                      "up",
                      {
                        $cond: [
                          {
                            $in: [
                              new mongoose.Types.ObjectId(req.user._id),
                              { $ifNull: ["$downvotes", []] },
                            ],
                          },
                          "down",
                          null,
                        ],
                      },
                    ],
                  }
                : null,
            },
          },
          {
            $project: {
              _id: 1,
              owner: "$ownerInfo",
              upvoteCount: 1,
              downvoteCount: 1,
              upvotesCount: 1,
              downvotesCount: 1,
              userVote: 1,
              topic: 1,
              title: 1,
              postVideo: 1,
              postImage: 1,
              createdAt: 1,
              updatedAt: 1,
              description: 1,
            },
          },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const result = postData[0] || { posts: [], totalCount: [] };

  const postsWithCounts = await attachCommentCounts(result.posts || []);
  const posts = postsWithCounts.map((post) => ({
    ...post,
    postImage: (post.postImage || []).map(getOptimizedImage),
    postVideo: (post.postVideo || []).map(getOptimizedVideo),
  }));
  const total = result.totalCount[0]?.count || 0;
  const totalPages = Math.ceil(total / limitNumber);
  const pagination = {
    total,
    page: pageNumber,
    limit: limitNumber,
    totalPages,
    hasNextPage: pageNumber < totalPages,
  };

  const finalresponse = {
    posts,
    pagination,
  };
  //then send response
  res
    .status(200)
    .json(new ApiResponse(200, finalresponse, "Posts retrieved successfully"));
});

const reactToPost = asyncHandler(async (req, res) => {
  const { post_id } = req.params;
  const user_id = req.user._id;
  const userId = new mongoose.Types.ObjectId(user_id);

  let targetVote = req.body?.vote;
  if (targetVote === undefined && req.body?.type) {
    if (req.body.type === "upvote") targetVote = "up";
    else if (req.body.type === "downvote") targetVote = "down";
  }
  if (!["up", "down", null].includes(targetVote)) {
    throw new ApiError(400, "Vote must be 'up', 'down', or null");
  }

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    throw new ApiError(400, "Invalid post ID");
  }
  await assertPostAccess(post_id, user_id);

  // Start atomic transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const oldPost = await Post.findById(post_id)
      .select("owner upvotes downvotes pages")
      .session(session);
    if (!oldPost) throw new ApiError(404, "Post not found");

    const wasUpvoted = (oldPost.upvotes || []).some(
      (id) => id.toString() === userId.toString(),
    );
    const wasDownvoted = (oldPost.downvotes || []).some(
      (id) => id.toString() === userId.toString(),
    );

    const updatedPost = await Post.findOneAndUpdate(
      { _id: post_id },
      [
        {
          $set: {
            upvotes: {
              $cond: [
                { $eq: [targetVote, "up"] },
                { $setUnion: [{ $ifNull: ["$upvotes", []] }, [userId]] },
                { $setDifference: [{ $ifNull: ["$upvotes", []] }, [userId]] },
              ],
            },
            downvotes: {
              $cond: [
                { $eq: [targetVote, "down"] },
                { $setUnion: [{ $ifNull: ["$downvotes", []] }, [userId]] },
                { $setDifference: [{ $ifNull: ["$downvotes", []] }, [userId]] },
              ],
            },
          },
        },
        {
          $set: {
            upvoteCount: { $size: "$upvotes" },
            downvoteCount: { $size: "$downvotes" },
          },
        },
      ],
      { returnDocument: "after", session, updatePipeline: true },
    );

    if (!updatedPost) throw new ApiError(404, "Post not found");

    const isUpvoted = (updatedPost.upvotes || []).some(
      (id) => id.toString() === userId.toString(),
    );
    const isDownvoted = (updatedPost.downvotes || []).some(
      (id) => id.toString() === userId.toString(),
    );

    const oldVal = wasUpvoted ? 1 : wasDownvoted ? -1 : 0;
    const newVal = isUpvoted ? 1 : isDownvoted ? -1 : 0;
    const contributionDelta = (newVal - oldVal) * 10;

    if (contributionDelta !== 0 && oldPost.owner) {
      await User.applyContribution(oldPost.owner, contributionDelta, session);
    }

    await session.commitTransaction();

    // Emit live updates
    const io = getIO.get();
    if (io) {
      const room = `post:${String(updatedPost._id).trim()}`;
      io.to(room).emit("reacted-post", {
        postId: updatedPost._id,
        upvoteCount: updatedPost.upvoteCount,
        downvoteCount: updatedPost.downvoteCount,
        voterId: userId,
        userVote: isUpvoted ? "up" : isDownvoted ? "down" : null,
      });
      (oldPost.pages || []).forEach((page) => {
        const r = `page:${String(page).trim()}`;
        io.to(r).emit("reacted-post", {
          postId: updatedPost._id,
          upvoteCount: updatedPost.upvoteCount,
          downvoteCount: updatedPost.downvoteCount,
          voterId: userId,
          userVote: isUpvoted ? "up" : isDownvoted ? "down" : null,
        });
      });
    }

    if (targetVote && oldPost.owner?.toString() !== userId.toString()) {
      await createNotification(
        oldPost.owner,
        userId,
        targetVote === "down" ? "post_downvote" : "post_upvote",
        `${req.user.username} has ${targetVote === "down" ? "downvoted" : "upvoted"} your post`,
        updatedPost._id,
      );
    }

    const userVote = isUpvoted ? "up" : isDownvoted ? "down" : null;
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          upvoteCount: updatedPost.upvoteCount,
          downvoteCount: updatedPost.downvoteCount,
          userVote,
        },
        "Successfully reacted to post",
      ),
    );
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

const removeExistingPostFromPage = asyncHandler(async (req, res) => {
  //we expect an array of page id
  const { post_id } = req.params;
  const pages = (req.pages || []).map((id) => String(id).trim());

  const post = req.post;
  if (!post) throw new ApiError(404, "Post not found");
  const existingIds = (post.pages || []).map(String);
  if (pages.some((page) => !existingIds.includes(page))) {
    throw new ApiError(400, "Post is not attached to every requested page");
  }

  //we already have data of post from isowner verification middleware so we just gonnna add new pages to existing page
  const returnedPost = await Post.findByIdAndUpdate(post_id, {
    $pull: {
      pages: { $in: pages },
    },
  });

  //send live response to the user and also notification to the page owner
  const io = getIO.get();
  (pages || []).forEach(async (page_id) => {
    const room = `page:${page_id.toString().trim()}`;
    io.to(room).emit("removePost-from-page", returnedPost);
  });

  //save them
  res
    .status(200)
    .json(new ApiResponse(200, null, "Post successfully removed from pages"));
});

const searchOnText = asyncHandler(async (req, res) => {
  const { search } = req.query;

  if (typeof search !== "string" || !search.trim()) {
    throw new ApiError(400, "Search query is required");
  }
  if (search.length > 100) {
    throw new ApiError(400, "Search query cannot exceed 100 characters");
  }

  const { page: pageNumber, limit: limitNumber } = parsePagination(req.query);

  const [result] = await Post.aggregate([
    { $match: { $text: { $search: search.trim() } } },
    ...publicPostVisibilityStages(),
    { $addFields: { score: { $meta: "textScore" } } },
    {
      $facet: {
        posts: [
          { $sort: { score: -1 } },
          { $skip: (pageNumber - 1) * limitNumber },
          { $limit: limitNumber },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              pipeline: [{ $project: { _id: 1, username: 1, profileImage: 1, title: 1 } }],
              as: "owner",
            },
          },
          { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
              upvotesCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvotesCount: { $size: { $ifNull: ["$downvotes", []] } },
              userVote: req.user?._id
                ? {
                    $cond: [
                      {
                        $in: [
                          new mongoose.Types.ObjectId(req.user._id),
                          { $ifNull: ["$upvotes", []] },
                        ],
                      },
                      "up",
                      {
                        $cond: [
                          {
                            $in: [
                              new mongoose.Types.ObjectId(req.user._id),
                              { $ifNull: ["$downvotes", []] },
                            ],
                          },
                          "down",
                          null,
                        ],
                      },
                    ],
                  }
                : null,
            },
          },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);
  const posts = result?.posts || [];
  const total = result?.totalCount?.[0]?.count || 0;

  const postsWithCommentCounts = await attachCommentCounts(posts);
  const modifiedPosts = postsWithCommentCounts.map((postObj) => {
    return {
      ...postObj,
      postImage: (postObj.postImage || []).map(getOptimizedImage),
      postVideo: (postObj.postVideo || []).map(getOptimizedVideo),
      owner: postObj.owner
        ? {
            ...postObj.owner,
            profileImage: postObj.owner.profileImage
              ? getOptimizedImage(postObj.owner.profileImage)
              : null,
          }
        : null,
    };
  });

  const totalPages = Math.ceil(total / limitNumber);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts: modifiedPosts,
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages,
          hasNextPage: pageNumber < totalPages,
        },
      },
      "Posts fetched successfully",
    ),
  );
});

const getPagePost = asyncHandler(async (req, res) => {
  //get pageid from req.params
  const { pageid } = req.params;
  const { page: pageNumber, limit: limitNumber, skip } = parsePagination(req.query);

  //validate it
  if (!mongoose.Types.ObjectId.isValid(pageid)) {
    throw new ApiError(400, "Invalid page ID");
  }

  const pageData = await Page.findById(pageid).select(
    "type owner members moderators",
  );
  if (!pageData) throw new ApiError(404, "Page not found");

  //verify if the page is open then allow all the user to fetch posts
  //if the page is closed then check if the user is member of page or not
  if (pageData.type === "private") {
    const user = req.user;
    if (!user) throw new ApiError(404, "Page not found");

    const isMember = pageData.members.some(
      (memberId) => memberId.toString() === user._id.toString(),
    );
    const isOwner = pageData.owner.toString() === user._id.toString();
    const isModerator = pageData.moderators.some(
      (modId) => modId.toString() === user._id.toString(),
    );

    if (!isMember && !isOwner && !isModerator) {
      throw new ApiError(404, "Page not found");
    }
  }

  //get all posts from post collections where pages array contains pageid
  const posts = await Post.aggregate([
    { $match: { pages: new mongoose.Types.ObjectId(pageid) } },
    ...postVisibilityStagesForUser(req.user?._id),
    {
      $facet: {
        posts: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limitNumber },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    profileImage: 1,
                    title: 1,
                    badge: 1,
                  },
                },
              ],
              as: "owner",
            },
          },
          { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
              upvotesCount: { $size: { $ifNull: ["$upvotes", []] } },
              downvotesCount: { $size: { $ifNull: ["$downvotes", []] } },
              userVote: req.user?._id
                ? {
                    $cond: [
                      {
                        $in: [
                          new mongoose.Types.ObjectId(req.user._id),
                          { $ifNull: ["$upvotes", []] },
                        ],
                      },
                      "up",
                      {
                        $cond: [
                          {
                            $in: [
                              new mongoose.Types.ObjectId(req.user._id),
                              { $ifNull: ["$downvotes", []] },
                            ],
                          },
                          "down",
                          null,
                        ],
                      },
                    ],
                  }
                : null,
            },
          },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const result = posts[0] || { posts: [], totalCount: [] };
  const pagePostsWithCounts = await attachCommentCounts(result.posts);
  const modifiedPosts = pagePostsWithCounts.map((postObj) => {
    return {
      ...postObj,
      postImage: (postObj.postImage || []).map(getOptimizedImage),
      postVideo: (postObj.postVideo || []).map(getOptimizedVideo),
      owner: postObj.owner
        ? {
            ...postObj.owner,
            profileImage: postObj.owner.profileImage
              ? getOptimizedImage(postObj.owner.profileImage)
              : null,
          }
        : null,
    };
  });

  const total = result.totalCount[0]?.count || 0;
  const totalPages = Math.ceil(total / limitNumber);

  //send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts: modifiedPosts,
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages,
          hasNextPage: pageNumber < totalPages,
        },
      },
      "Page posts retrieved successfully",
    ),
  );
});

export {
  createPost,
  deletePost,
  AddExistingPostToPage,
  updatePost,
  getPostById,
  savePost,
  unsavePost,
  getSavePost,
  getUserPosts,
  getTopicPosts,
  getPost,
  reactToPost,
  removeExistingPostFromPage,
  searchOnText,
  getPagePost,
};
