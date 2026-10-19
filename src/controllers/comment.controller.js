import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Comment } from "../models/Comment.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import { getIO } from "../socket.js";
import { createNotification } from "../utils/createNotification.js";
import { User } from '../models/User.model.js'
import { assertPostAccess } from "../utils/postAccess.js";


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
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    throw new ApiError(400, "Limit must be between 1 and 100");
  }
  if (!["top", "latest"].includes(sort)) {
    throw new ApiError(400, "Sort must be top or latest");
  }
  if (!isTopLevel && !mongoose.Types.ObjectId.isValid(parentComment)) {
    throw new ApiError(400, "Invalid parent comment ID");
  }
  const skip = (pageNumber - 1) * limitNumber;

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

  // Start atomic transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const comment = await Comment.findById(comment_id).session(session);
    if (!comment) throw new ApiError(404, "Comment not found");
    await assertPostAccess(comment.post, user_id);

    const alreadyUpvoted = comment.upvotes.some(
      (id) => id.toString() === user_id.toString(),
    );
    let contributionDelta = 0;
    if (alreadyUpvoted) {
      // remove upvote
      comment.upvotes.pull(user_id);
      contributionDelta = -10;
    } else {
      // add upvote
      comment.upvotes.addToSet(user_id);
      contributionDelta = 10;
    }

    await comment.save({ session });
    // Update comment author contribution atomically
    if (comment.author.toString() !== user_id.toString()) {
      await User.applyContribution(comment.author, contributionDelta, session);
    }

    await session.commitTransaction();

    // Emit live update to post room
    const io = getIO.get();
    io.to(`post:${comment.post}`).emit("comment-vote-update", {
      commentId: comment_id,
      upvotesCount: comment.upvotes.length,
      userUpvoted: !alreadyUpvoted,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        { upvotesCount: comment.upvotes.length, userUpvoted: !alreadyUpvoted },
        "Comment vote recorded",
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
  upvoteComment,
  statusComment,
};
