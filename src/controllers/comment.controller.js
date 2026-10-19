import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Comment } from "../models/Comment.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import { getIO } from "../socket.js";
import { createNotification } from "../utils/createNotification.js";
import { User } from '../models/User.model.js'
import { assertPostAccess } from "../utils/postAccess.js";
import { parsePagination } from "../utils/pagination.js";


const createComment = asyncHandler(async (req, res) => {
  //get the post id in which user want to comment also validate it
  const { post_id } = req.params;
  if (!post_id) throw new ApiError(400, "no post id is given");
  if (!mongoose.Types.ObjectId.isValid(post_id))
    throw new ApiError(400, "post id is invalid");

  const post = await assertPostAccess(post_id, req.user?._id);

  //get the author who is writing the comment
  const author = req.user._id;

  //get the req.body for each thing and also validate it
  let { parentComment = null, body } = req.body || {};
  if (typeof body !== "string" || !body.trim() || body.length > 1000) {
    throw new ApiError(400, "Comment must contain 1 to 1000 characters");
  }
  body = body.trim();
  if (parentComment) {
    if (!mongoose.Types.ObjectId.isValid(parentComment)) {
      throw new ApiError(400, "Invalid parent comment ID");
    }
    const parent = await Comment.findOne({
      _id: parentComment,
      post: post_id,
    }).select("_id");
    if (!parent) throw new ApiError(404, "Parent comment not found");
  }

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
  io.to(`post:${post_id}`).emit("comment-count-updated", {
    postId: post_id,
    commentsCount: await Comment.countDocuments({ post: post_id }),
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

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    throw new ApiError(400, "Invalid Post ID");
  }
  await assertPostAccess(post_id, req.user?._id);

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

  const isTopLevel = !parentComment || parentComment === "null";
  const { page: pageNumber, limit: limitNumber, skip } = parsePagination({
    page,
    limit,
  });
  if (!["top", "latest"].includes(sort)) {
    throw new ApiError(400, "Sort must be top or latest");
  }
  if (!isTopLevel && !mongoose.Types.ObjectId.isValid(parentComment)) {
    throw new ApiError(400, "Invalid parent comment ID");
  }
  // Step 3 — build sort option
  // top level → by upvotes
  // replies   → by date ascending (conversation order)
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
    { $project: { replies: 0} },
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
        pipeline: [{ $project: { username: 1, profileImage: 1, title: 1 } }],
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

  const { body } = req.body || {};
  if (typeof body !== "string" || !body.trim() || body.length > 1000) {
    throw new ApiError(400, "Comment must contain 1 to 1000 characters");
  }

  //edit the info
  const updatedComment = await Comment.findByIdAndUpdate(
    comment_id,
    {
      body: body.trim(),
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
  io.to(`post:${commentInfo.post}`).emit("comment-count-updated", {
    postId: commentInfo.post,
    commentsCount: await Comment.countDocuments({ post: commentInfo.post }),
  });

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

const voteComment = asyncHandler(async (req, res) => {
  const { comment_id } = req.params;
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

  if (!mongoose.Types.ObjectId.isValid(comment_id)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  // Start atomic transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const oldComment = await Comment.findById(comment_id).session(session);
    if (!oldComment) throw new ApiError(404, "Comment not found");
    await assertPostAccess(oldComment.post, user_id);

    const wasUpvoted = (oldComment.upvotes || []).some(
      (id) => id.toString() === userId.toString(),
    );
    const wasDownvoted = (oldComment.downvotes || []).some(
      (id) => id.toString() === userId.toString(),
    );

    const updatedComment = await Comment.findOneAndUpdate(
      { _id: comment_id },
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

    if (!updatedComment) throw new ApiError(404, "Comment not found");

    const isUpvoted = (updatedComment.upvotes || []).some(
      (id) => id.toString() === userId.toString(),
    );
    const isDownvoted = (updatedComment.downvotes || []).some(
      (id) => id.toString() === userId.toString(),
    );

    const oldVal = wasUpvoted ? 1 : wasDownvoted ? -1 : 0;
    const newVal = isUpvoted ? 1 : isDownvoted ? -1 : 0;
    const contributionDelta = (newVal - oldVal) * 10;

    if (
      contributionDelta !== 0 &&
      oldComment.author &&
      oldComment.author.toString() !== userId.toString()
    ) {
      await User.applyContribution(oldComment.author, contributionDelta, session);
    }

    await session.commitTransaction();

    // Emit live update to post room
    const io = getIO.get();
    if (io) {
      io.to(`post:${updatedComment.post}`).emit("comment-vote-update", {
        commentId: updatedComment._id,
        upvoteCount: updatedComment.upvoteCount,
        downvoteCount: updatedComment.downvoteCount,
        voterId: userId,
        userVote: isUpvoted ? "up" : isDownvoted ? "down" : null,
      });
    }

    const userVote = isUpvoted ? "up" : isDownvoted ? "down" : null;
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          upvoteCount: updatedComment.upvoteCount,
          downvoteCount: updatedComment.downvoteCount,
          userVote,
        },
        "Comment vote recorded successfully",
      ),
    );
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

const statusComment = asyncHandler(async (req, res) => {
  //get comment id from req.comment and status that need to set
  const { comment_id } = req.params;
  const { status } = req.body || {};

  if (!["pinned", "helpful", "none"].includes(status)) {
    throw new ApiError(400, "Status must be pinned, helpful, or none");
  }

  if (!mongoose.Types.ObjectId.isValid(comment_id)) {
    throw new ApiError(400, "Invalid comment ID");
  }
  const comment = await Comment.findOne({
    _id: comment_id,
    post: req.params.post_id,
  });
  if (!comment) throw new ApiError(404, "Comment not found on this post");
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
  if (status !== "none") {
    await createNotification(
      comment.author,
      req.user?._id,
      status,
      message,
      comment.post,
      comment_id,
    );
  }

  //socket also
  const io = getIO.get();
  io.to(`post:${comment.post}`).emit("comment-status", {
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
  voteComment,
  statusComment,
};
