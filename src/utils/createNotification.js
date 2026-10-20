import { Notification } from "../models/Notification.model.js";
import { sendToUser } from "../socket.js";
import ApiError from "./ApiError.js";

const NOTIFICATION_MESSAGES = {
  comment: "commented on your post",
  reply: "replied to your comment",
  post_upvote: "upvoted your post",
  post_downvote: "downvoted your post",
  comment_upvote: "upvoted your comment",
  helpful: "marked your comment helpful",
  pinned: "pinned your comment",
  follow: "started following you",
  page_join: "joined your community",
  page_removed: "removed you from this community",
  page_deleted: "deleted a community you were part of",
  mod_appointed: "made you a moderator",
  mod_removed: "removed your moderator role",
  join_request: "requested to join your community",
  request_approved: "approved your join request",
  request_rejected: "declined your join request",
};

export const createNotification = async (
  recipient,
  sender,
  type,
  message,
  post,
  comment,
  page,
) => {
  if (recipient?.toString() === sender?.toString()) return null;
  const res = await Notification.create({
    recipient,
    sender,
    type,
    message: NOTIFICATION_MESSAGES[type] || message,
    post,
    comment,
    page,
  });
  if (!res) throw new ApiError(400, "error in creating notification");

  await res.populate([
    { path: "sender", select: "username profileImage title" },
    { path: "post", select: "title description topic" },
    { path: "page", select: "pageName pageDescription pageProfileImage" },
  ]);
  sendToUser(recipient, "notification", res);
  return res;
};
