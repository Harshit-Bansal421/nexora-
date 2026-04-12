import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Comment } from "../models/Comment.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Post } from "../models/Post.model.js";

const createComment = asyncHandler(async (req, res) => {
  //get the post id in which user want to comment also validate it
  const { post_id } = req.params;
  console.log(post_id);
  if (!post_id) throw new ApiError(400, "no post id is given");
  if (!mongoose.Types.ObjectId.isValid(post_id))
    throw new ApiError(400, "post id is invalid");

  const post = await Post.findById(post_id);
  if (!post) throw new ApiError(400, "no post exist with this post_id");

  //get the author who is writing the comment
  const author = req.user._id;

  //get the req.body for each thing and also validate it
  let { parentComment = null, body } = req.body;
  if (!body) throw new ApiError(400, "comment body is missing");

  //create a db entry
  const responsedata = await Comment.create({
    author,
    parentComment,
    body,
    post: post_id,
  });

  //send a response
  return res
    .status(201)
    .json(new ApiResponse(201, responsedata, "comment created succcessfully"));
});

const getComnment = asyncHandler(async (req, res) => {
  //get the post_id from url and validate it
  const { post_id } = req.params;
  if (!post_id) throw new ApiError(400, "Post ID is required");

  if (!post_id) throw new ApiError(400, "Post ID is required");

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    throw new ApiError(400, "Invalid Post ID");
  }

  // Step 2 — get query params
  // parentComment → which level to fetch
  // sort          → top (upvotes) or latest (newest)
  // page + limit  → pagination
  const {
    parentComment = null,
    sort = "top",
    page = 1,
    limit = 10,
  } = req.query;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Step 3 — build sort option
  // top level → by upvotes
  // replies   → by date ascending (conversation order)
  const isTopLevel = !parentComment || parentComment === "null";
  const sortOption =
    sort === "top" && isTopLevel
      ? { upvotesCount: -1, createdAt: -1 }
      : { createdAt: 1 }; // replies always oldest first

  // Step 4 — aggregate pipeline
  // gets comments + reply count + author info in one query
  const comments = await Comment.aggregate([
    {
      $match: {
        post: new mongoose.Types.ObjectId(post_id),
        parentComment: isTopLevel
          ? null
          : new mongoose.Types.ObjectId(parentComment),
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "parentComment",
        as: "replies",
      },
    },
    {
      $addFields: {
        upvotesCount: { $size: "$upvotes" },
        replyCount: { $size: "$replies" },
        hasChildren: { $gt: [{ $size: "$replies" }, 0] },
        statusPriority: {
          $switch: {
            branches: [
              { case: { $eq: ["$status", "pinned"] }, then: 0 },
              { case: { $eq: ["$status", "helpful"] }, then: 1 },
            ],
            default: 2,
          },
        },
      },
    },
    { $project: { replies: 0, statusPriority: 0 } },
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
        pipeline: [{ $project: { username: 1, avatar: 1, title: 1 } }],
      },
    },
    { $unwind: "$author" },
    { $sort: { statusPriority: 1, ...sortOption } },
    { $skip: skip },
    { $limit: limitNumber },
  ]);

  // Step 5 — get total count for pagination
  const total = await Comment.countDocuments({
    post: post_id,
    parentComment: isTopLevel ? null : parentComment,
  });

  // Step 6 — return response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        comments,
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          hasNextPage: pageNumber * limitNumber < total,
        },
      },
      "Comments fetched",
    ),
  );
});

const editComment = asyncHandler(async (req, res) => {
  //get comment id from params and body from req.body
  const comment_id = req.comment.id;

  const { body } = req.body;
  if (!body) throw new ApiError(400, "there is no new body to change");

  //edit the info
  await Comment.findByIdAndUpdate(comment_id, {
    body: body,
  });

  //send response
  res
    .status(200)
    .json(new ApiResponse(200, {}, "comment updated soccessfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  //get common id from req.comment
  const comment_id = req.comment._id;

  //and we will delete where author=comment_id or parentComment_id:comment_id
  await deleteCommentAndreply(comment_id);

  //send respone
  res.status(200).json(new ApiResponse(200, {}, "comment deleted"));
});

const deleteCommentAndreply = asyncHandler(async (comment_id) => {
  const children = await Comment.find({ parentComment: comment_id });

  for (const child of children) {
    await deleteCommentAndreply(child);
  }

  await Comment.findByIdAndDelete(comment_id);
});

const upvoteComment = asyncHandler(async (req, res) => {
  //get the comment id from req.param and user id from req.user
  const { comment_id } = req.params;
  const user_id = req.user._id;

  //aggregate pipeline
  await Comment.findByIdAndUpdate(
    comment_id,
    [
      {
        $set: {
          upvotes: {
            $cond: [
              { $in: [user_id, "$upvotes"] },
              { $setDifference: ["$upvotes", [user_id]] },
              { $concatArrays: ["$upvotes", [user_id]] },
            ],
          },
        },
      },
    ],
    { returnAfterDocument: 'after', updatePipeline: true }, // ✅ FIX
  );

  res.status(201).json(new ApiResponse(201,{},"success"))
});

const statusComment = asyncHandler(async (req, res) => {
  //get comment id from req.comment and status that need to set 
  const {comment_id}=req.params;
  const {status}=req.body;

  if(!status) throw new ApiResponse(400,"no status is provided");

  //then check if it same in db then dont make db call
  const comment=await Comment.findById(comment_id);
  if(!comment) throw new ApiError(400,"no commenr exist with this id");
  if(comment.status===status) throw new ApiError(400,"status is same as the previous one");

  //otherwise make db call
  await Comment.findByIdAndUpdate(comment_id,{
    status:status
  });

  res.status(201).json(new ApiResponse(201,{},"status changed successfully"));
});

export {
  createComment,
  getComnment,
  editComment,
  deleteComment,
  upvoteComment,
  statusComment,
};
