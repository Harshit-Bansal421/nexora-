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

  sendToUser(recipient, "notification", res);
  return res;
};
