import { Notification } from "../models/Notification.model.js";
import { sendToUser } from "../socket.js";
import ApiError from "./ApiError.js";

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
    message,
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
