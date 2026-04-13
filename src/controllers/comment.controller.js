import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Comment } from "../models/Comment.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Post } from "../models/Post.model.js";
import { getIO } from "../socket.js";
import { createNotification } from "../utils/createNotification.js";
import { User } from '../models/User.model.js'


const createComment = asyncHandler(async (req, res) => {
  //get the post id in which user want to comment also validate it
  const { post_id } = req.params;
  console.log(post_id);
  if (!post_id) throw new ApiError(400, "no post id is given");
  if (!mongoose.Types.ObjectId.isValid(post_id))
    throw new ApiError(400, "post id is invalid");

  const post = await Post.findById(post_id).select("owner");
  if (!post) throw new ApiError(400, "no post exist with this post_id");

  //get the author who is writing the comment
  const author = req.user._id;

  //get the req.body for each thing and also validate it
  let { parentComment = null, body } = req.body;
  if (!body) throw new ApiError(400, "comment body is missing");

  const postowner = post.owner;

  //create a db entry
  const responsedata = await Comment.create({
    author,
    parentComment,
    body,
    post: post_id,
  });

  //send notification to the post owner
  await createNotification(
    postowner,
    author,
    "comment",
    `${req.user.username} commented on your post`,
    post_id,
    responsedata._id,
  );

  //send notification to the parent comment owner
  if (parentComment) {
    const parent = await Comment.findById(parentComment).select("author");
    await createNotification(
      parent.author,
      author,
      "reply",
      `${req.user.username} replied to your comment`,
      post_id,
      responsedata._id,
    );
  }

  //also send real time comment to those who are in the post
  const io = getIO.get();
  const populatedComment = await Comment.findById(responsedata._id).populate(
    "author",
    "username profileImage title",
  );

  io.to(`post:${post_id}`).emit("new-comment", populatedComment);
  //send a response
  return res
    .status(201)
    .json(new ApiResponse(201, responsedata, "comment created succcessfully"));
});

const getComnment = asyncHandler(async (req, res) => {
  //get the post_id from url and validate it
  const { post_id } = req.params;
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
    { $project: { replies: 0, statusPriority: 1 } },
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
  const updatedComment = await Comment.findByIdAndUpdate(
    comment_id,
    {
      body: body,
    },
    { new:true },
  ).select("post body");

  if (!updatedComment) {
    throw new ApiError(404, "Comment not found");
  }

  //send real time update
  const io = getIO.get();
  io.to(`post:${updatedComment.post}`).emit("comment-updated", {
    body: updatedComment.body,
    comment_id: comment_id,
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
  let deletedCommentInfo = [];
  const commentInfo = await Comment.findById(comment_id);
  await deleteCommentAndreply(comment_id, deletedCommentInfo);


  const io = getIO.get();
  io.to(`post:${commentInfo.post}`).emit("comment-deleted", deletedCommentInfo);

  //send respone
  res.status(200).json(new ApiResponse(200, {}, "comment deleted"));
});

const deleteCommentAndreply = async (comment_id, deletedCommentInfo) => {
  const children = await Comment.find({ parentComment: comment_id });

  for (const child of children) {
    await deleteCommentAndreply(child._id,deletedCommentInfo);
  }

  const info = await Comment.findByIdAndDelete(comment_id);
  deletedCommentInfo.push({ id: info._id, body: info.body });
};

const upvoteComment = asyncHandler(async (req, res) => {
  const { comment_id } = req.params;
  const user_id = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(comment_id)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(comment_id);
  if (!comment) throw new ApiError(404, "Comment not found");

  const alreadyUpvoted = comment.upvotes.some(
    (id) => id.toString() === user_id.toString(),
  );

  // Toggle upvote
  if (alreadyUpvoted) {
    await Comment.findByIdAndUpdate(comment_id, {
      $pull: { upvotes: user_id },
    });
  } else {
    await Comment.findByIdAndUpdate(comment_id, {
      $addToSet: { upvotes: user_id },
    });

    // Notify comment author — only when adding upvote
    if (comment.author.toString() !== user_id.toString()) {
      await createNotification(
        comment.author,
        user_id,
        "comment_upvote",
        `${req.user.username} upvoted your comment`,
        comment.post,
        comment._id,
        null,
      );

      // XP for comment author
      const author = await User.findById(comment.author);
      await author.addXP(10);
    }
  }

  // Get updated count
  const updatedComment =
    await Comment.findById(comment_id).select("upvotes post");

  // Emit live update to post room
  const io = getIO.get();
  io.to(`post:${comment.post}`).emit("comment-vote-update", {
    commentId: comment_id,
    upvotesCount: updatedComment.upvotes.length,
    userUpvoted: !alreadyUpvoted,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        upvotesCount: updatedComment.upvotes.length,
        userUpvoted: !alreadyUpvoted,
      },
      "Comment vote recorded",
    ),
  );
});

const statusComment = asyncHandler(async (req, res) => {
  //get comment id from req.comment and status that need to set
  const { comment_id } = req.params;
  const { status } = req.body;

  if (!status) throw new ApiResponse(400, "no status is provided");

  //then check if it same in db then dont make db call
  const comment = await Comment.findById(comment_id);
  if (!comment) throw new ApiError(400, "no commenr exist with this id");
  if (comment.status === status)
    throw new ApiError(400, "status is same as the previous one");

  //otherwise make db call
  await Comment.findByIdAndUpdate(comment_id, {
    status: status,
  });

  const message =
    status === "pinned"
      ? `${req.user.username} pinned ur comment`
      : `${req.user.username} marked helpfull on ur comment`;

  //send noitification to comment owner
  await createNotification(
    comment.author,
    req.user?._id,
    status,
    message,
    comment.post,
    comment_id,
  );

  //socket also
  const io = getIO.get();
  io.to(`post:${comment_id.post}`).emit("comment-status", {
    id: comment_id,
    status: status,
  });

  res.status(201).json(new ApiResponse(201, {}, "status changed successfully"));
});

export {
  createComment,
  getComnment,
  editComment,
  deleteComment,
  upvoteComment,
  statusComment,
};
