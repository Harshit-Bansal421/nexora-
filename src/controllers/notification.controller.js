import { asyncHandler } from "../utils/asyncHandler.js";
import { Notification } from "../models/Notification.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import { parsePagination } from "../utils/pagination.js";

const getNotification = asyncHandler(async (req, res) => {
  //we have to get all notifications of user having user_id which has isreadAll
  const user_id = req.user?._id;

  if (!user_id) {
    throw new ApiError(401, "Unauthorized access");
  }

  const { page: pages, limit, skip } = parsePagination({
    page: req.query.page ?? req.query.pages,
    limit: req.query.limit,
  });

  const [notificationResult = { notifications: [], totalCount: [] }] = await Notification.aggregate([
    {
      $match: {
        recipient: new mongoose.Types.ObjectId(user_id),
      },
    },
    {
      $facet: {
        notifications: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "sender",
              foreignField: "_id",
              as: "sender",
              pipeline: [{ $project: { username: 1, profileImage: 1 } }],
            },
          },
          { $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "posts",
              localField: "post",
              foreignField: "_id",
              as: "postInfo",
              pipeline: [{ $project: { title: 1, description: 1, topic: 1 } }],
            },
          },
          {
            $lookup: {
              from: "pages",
              localField: "page",
              foreignField: "_id",
              as: "pageInfo",
              pipeline: [{ $project: { pageName: 1, pageDescription: 1, pageProfileImage: 1 } }],
            },
          },
          {
            $addFields: {
              post: { $ifNull: [{ $arrayElemAt: ["$postInfo", 0] }, "$post"] },
              page: { $ifNull: [{ $arrayElemAt: ["$pageInfo", 0] }, "$page"] },
            },
          },
          { $project: { postInfo: 0, pageInfo: 0 } },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const notifications = notificationResult.notifications || [];
  const total = notificationResult.totalCount?.[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  const pagination = {
    total,
    pages,
    limit,
    totalPages,
    hasNextPage: pages < totalPages,
  };

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { notifications, pagination },
        "notifications has been fetched successfully",
      ),
    );
});

const markRead = asyncHandler(async (req, res) => {
  const { notification_id } = req.params;

  if (!notification_id?.trim()) {
    throw new ApiError(400, "Notification ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(notification_id)) {
    throw new ApiError(400, "Invalid notification ID format");
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: notification_id, recipient: req.user._id },
    {
      $set: { isRead: true },
    },
    { returnDocument: "after" },
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  res.status(200).json(new ApiResponse(200, {}, "marked read successfully"));
});

const markReadAll = asyncHandler(async (req, res) => {
  const user_id = req.user?._id;

  if (!user_id) {
    throw new ApiError(401, "Unauthorized access");
  }

  await Notification.updateMany(
    { recipient: user_id, isRead: false },
    { $set: { isRead: true } },
  );

  res.status(200).json(new ApiResponse(200, {}, "marked read successfully"));
});

export { getNotification, markRead, markReadAll };
