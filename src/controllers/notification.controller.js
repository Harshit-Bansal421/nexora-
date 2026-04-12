import { asyncHandler } from "../utils/asyncHandler.js";
import { Notification } from "../models/Notification.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import mongoose from "mongoose";

const getNotification = asyncHandler(async (req, res) => {
  //we have to get all notifications of user having user_id which has isreadAll
  const user_id = req.user?._id;

  if (!user_id) {
    throw new ApiError(401, "Unauthorized access");
  }

  let { pages = 1, limit = 10 } = req.query;
  pages = Number(pages);
  limit = Number(limit);

  if (isNaN(pages) || pages < 1) pages = 1;
  if (isNaN(limit) || limit < 1 || limit > 100) limit = 10;

  const skip = (pages - 1) * limit;

  const notifications = await Notification.aggregate([
    {
      $match: {
        recipient: new mongoose.Types.ObjectId(user_id),
        isRead: false,
      },
    },
    {
      $facet: {
        notifications: [
          { $sort: { createdAt: 1 } },
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
          { $unwind: "$sender" },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const total = notifications[0].totalCount[0]?.count || 0;
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

  const notification = await Notification.findByIdAndUpdate(
    notification_id,
    {
      isRead: true,
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
