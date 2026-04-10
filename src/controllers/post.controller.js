import { Post } from "../models/Post.model.js";
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

const createPost = asyncHandler(async (req, res) => {
  //get all the info from req.body,req.user,req.files
  let { description, topic, title, pages } = req.body;
  const owner = req.user?._id;
  const Images = req.files?.PostImages;
  const Videos = req.files?.PostVideos;
  console.log("file uploaded is =", req.files);

  //validate each of the feilds properly and set defaults feilds too
  if (!owner) throw new ApiError(401, "Unauthorized access");
  if (!title || !topic) throw new ApiError(400, "Title and topic are required");
  description = description || "";
  pages = pages || [];

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
  await Post.findByIdAndDelete(post._id);

  //send success response
  res.status(200).json(new ApiResponse(200, null, "Post deleted successfully"));
});

const AddExistingPostToPage = asyncHandler(async (req, res) => {
  //we expect an array of page id
  const { post_id } = req.params;
  const pages = req.pages;

  //we already have data of post from isowner verification middleware so we just gonnna add new pages to existing page
  await Post.findByIdAndUpdate(
    post_id,
    {
      $addToSet: {
        pages: { $each: pages },
      },
    },
    { returnDocument: "after" },
  );

  //save them
  res
    .status(200)
    .json(new ApiResponse(200, "Post successfully added to pages"));
});

const updatePost = asyncHandler(async (req, res) => {
  //we will get the new updates from req.body and req.files
  //in remove part frontend will send me the remove item public_id
  let { description, topic, title, removeImages, removeVideos } = req.body;
  let addImages = req.files?.addImages;
  let addVideos = req.files?.addVideos;
  console.log("req.files is =", req.files);
  console.log("addImages=", addImages);
  console.log("addVideos=", addVideos);
  //validate them
  description = description ? description : req.post?.description;
  topic = topic ? topic : req.post.topic;
  title = title ? title : req.post.title;

  //if addimages then we validate and updload images and store their public_id in a variable
  if (addImages) {
    if (!Array.isArray(addImages)) addImages = [addImages];
    if (addImages.length + req.post.postImage.length > 3)
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
  if (removeImages && req.post.postImage) {
    if (!Array.isArray(removeImages)) removeImages = [removeImages];
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
  if (addVideos) {
    if (!Array.isArray(addVideos)) addVideos = [addVideos];
    if (addVideos.length + req.post.postVideo.length > 2)
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
  if (removeVideos && req.post.postVideo) {
    if (!Array.isArray(removeVideos)) removeVideos = [removeVideos];
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
  await Post.findByIdAndUpdate(req.post._id, {
    title,
    description,
    topic,
    $pull: {
      postImage: { $in: removeImages },
      postVideo: { $in: removeVideos },
    },
  });

  const updatedData = await Post.findByIdAndUpdate(
    req.post.id,
    {
      $addToSet: {
        postImage: { $each: addedImages },
        postVideo: { $each: addedVideos },
      },
    },
    { returnDocument: "after" },
  );
  if (!updatedData) throw new ApiError(500, "Failed to update post");

  const postResponse = {
    ...updatedData.toObject(),
    postImage: (updatedData.postImage || []).map(getOptimizedImage),
    postVideo: (updatedData.postVideo || []).map(getOptimizedVideo),
  };

  //send success reponse
  res
    .status(200)
    .json(new ApiResponse(200, postResponse, "Post updated successfully"));
});

const getPostById = asyncHandler(async (req, res) => {
  // validate the post id
  const postId = req.params.post_id;
  if (!postId) throw new ApiError(400, "Post ID is required");

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
        upvoteCount: { $size: "$upvotes" },
        downvoteCount: { $size: "$downvotes" },
      },
    },
    {
      $project: {
        _id: 1,
        ownerInfo: 1,
        upvoteCount: 1,
        downvoteCount: 1,
        topic: 1,
        title: 1,
        postVideo: 1,
        postImage: 1,
        createdAt: 1,
        updatedAt: 1,
        description: 1,
      },
    },
    { returnDocument: "after" },
  ]);

  if (!postdata || postdata.length === 0)
    throw new ApiError(404, "Post not found");

  const postResponse = postdata.map((post) => ({
    ...post,
    postImage: (post.postImage || []).map(getOptimizedImage),
    postVideo: (post.postVideo || []).map(getOptimizedVideo),
  }));

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
  if (!post_id) throw new ApiError(400, "Post ID is required");
  const postExisted = await Post.findById(post_id);
  if (!postExisted) throw new ApiError(404, "Post not found");

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
  //get user id from req.user
  const userid = req.user?._id;

  //get the pagination query from search query
  const page = req.query?.page || 1;
  const limit = req.query?.page || 10;
  const skip = (page - 1) * limit;

  //validate it
  if (!userid) throw new ApiError(401, "Unauthorized access");

  //get saved post from database of user
  const savedPost = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(userid) } },

    {
      $lookup: {
        from: "posts",
        let: { savedPostIds: { $ifNull: ["$savedPost", []] } },
        pipeline: [
          {
            $match: {
              $expr: { $in: ["$_id", "$$savedPostIds"] },
            },
          },

          {
            $facet: {
              posts: [
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },

                // for owner info
                {
                  $lookup: {
                    from: "users",
                    let: { ownerid: "$owner" },
                    pipeline: [
                      {
                        $match: {
                          $expr: { $eq: ["$_id", "$$ownerid"] },
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
                { $unwind: "$ownerInfo" },
                {
                  $addFields: {
                    upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
                    downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    postImage: 1,
                    title: 1,
                    description: 1,
                    ownerInfo: 1,
                    upvoteCount: 1,
                    downvoteCount: 1,
                  },
                },
              ],

              totalCount: [{ $count: "count" }],
            },
          },
        ],
        as: "savedPosts",
      },
    },
    {
      $unwind: {
        path: "$savedPosts",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $project: {
        savedPosts: 1,
      },
    },
  ]);
  if (!savedPost) throw new ApiError(500, "Failed to fetch saved posts");

  const modifiedSavedPosts = (savedPost[0]?.savedPosts || []).map((post) => ({
    ...post,
    postImage: (post.postImage || []).map(getOptimizedImage),
    postVideo: (post.postVideo || []).map(getOptimizedVideo),
  }));

  //return response
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { savedPost: modifiedSavedPosts, page, limit },
        "Saved posts retrieved successfully",
      ),
    );
});

const getUserPosts = asyncHandler(async (req, res) => {
  //get username from params and also see for pagination query
  const { username } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const skip = (page - 1) * limit;
  if (!username) throw new ApiError(400, "Username is required");

  //then get user collection from database if it exist
  const user = await User.findOne({ username: username }).select(
    "-password -refreshToken",
  );
  if (!user) throw new ApiError(404, "User not found");

  //call for posts
  const posts = await Post.find({ owner: user._id })
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .select(
      " _id postImage description topic title createdAt updatedAt upvotes downvotes owner",
    );
  if (!posts)
    throw new ApiError(500, "Failed to fetch user posts");
  //send response
  const total = await Post.countDocuments({ owner: user._id });
  const totalPages = Math.ceil(total / limit);

  const modifiedPosts = (posts || []).map((post) => {
    const postObj = post.toObject ? post.toObject() : post;
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
        },
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
        },
      },
      "Posts retrieved successfully",
    ),
  );
});

const getTopicPosts = asyncHandler(async (req, res) => {
  //get username from params and also see for pagination query
  const { topic } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const skip = (page - 1) * limit;
  if (!topic) throw new ApiError(400, "Topic is required");

  //call for posts
  const posts = await Post.aggregate([
    { $match: { topic: topic } },
    {
      $facet: {
        posts: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
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
              upvotesCount: {
                $size: { $ifNull: ["$upvotes", []] },
              },
              downvotesCount: {
                $size: { $ifNull: ["$downvotes", []] },
              },
            },
          },
          {
            $project: {
              _id: 1,
              postImage: 1,
              topic: 1,
              title: 1,
              createdAt: 1,
              updatedAt: 1,
              upvotesCount: 1,
              downvotesCount: 1,
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

  const modifiedTopicPosts = (result.posts || []).map((post) => ({
    ...post,
    postImage: (post.postImage || []).map(getOptimizedImage),
    postVideo: (post.postVideo || []).map(getOptimizedVideo),
  }));

  const total = result.totalcounts[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts: modifiedTopicPosts,
        paginations: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
        },
      },
      "Posts retrieved successfully",
    ),
  );
});

const getPost = asyncHandler(async (req, res) => {
  //get query of pagination if it is given
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;
  //i just have to make a aggregate pipeline for giving every post in sorted manner
  const postData = await Post.aggregate([
    { $match: {} },
    {
      $facet: {
        totalPost: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
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
              upvoteCount: { $size: "$upvotes" },
              downvoteCount: { $size: "$downvotes" },
            },
          },
          {
            $project: {
              _id: 1,
              ownerInfo: 1,
              upvoteCount: 1,
              downvoteCount: 1,
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

  const result = postData[0];

  const modifiedTotalPost = (result.totalPost || []).map((post) => ({
    ...post,
    postImage: (post.postImage || []).map(getOptimizedImage),
    postVideo: (post.postVideo || []).map(getOptimizedVideo),
  }));

  result.totalPost = modifiedTotalPost;

  const total = result.totalCount[0]?.count || 0;
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  const pagination = {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
  };

  const finalresponse = {
    post: result,
    pagination,
  };
  //then send response
  res
    .status(200)
    .json(
      new ApiResponse(200, finalresponse, "Posts retrieved successfully"),
    );
});

const reactToPost = asyncHandler(async (req, res) => {
  //get type from req.body
  const { type } = req.body;
  const { post_id } = req.params;
  const user_id = req.user._id;

  //then perform action
  let response = {};
  if (type === "upvote") {
    response = await Post.findByIdAndUpdate(
      post_id,
      {
        $addToSet: { upvotes: user_id },
        $pull: { downvotes: user_id },
      },
      { returnDocument: "after" },
    );
  } else if (type === "downvote") {
    response = await Post.findByIdAndUpdate(
      post_id,
      {
        $addToSet: { downvotes: user_id },
        $pull: { upvotes: user_id },
      },
      { returnDocument: "after" },
    );
  }
  if (!response) throw new ApiError(404, "Post not found");
  // then send response
  res.status(200).json(new ApiResponse(200, null, "Successfully reacted to post"));
});

const removeExistingPostFromPage = asyncHandler(async (req, res) => {
  //we expect an array of page id
  const pages = req.pages;
  const { post_id } = req.params;

  //we already have data of post from isowner verification middleware so we just gonnna add new pages to existing page
  await Post.findByIdAndUpdate(post_id, {
    $pull: {
      pages: { $in: pages },
    },
  });

  //save them
  res
    .status(200)
    .json(new ApiResponse(200, null, "Post successfully removed from pages"));
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
};
