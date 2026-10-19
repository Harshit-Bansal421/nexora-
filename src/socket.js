import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { User } from "./models/User.model.js";
import { Page } from "./models/Page.model.js";
import { Post } from "./models/post.model.js";
import { getOptimizedImage } from "./utils/Cloudinary.js";
import { isOriginAllowed } from "./utils/originPolicy.js";

const onlineUser = new Map();

const getAccessToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken) return authToken;

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization === "string") {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1];
  }

  const cookies = socket.handshake.headers.cookie || "";
  const accessCookie = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("AccessToken="));
  if (!accessCookie) return null;

  try {
    return decodeURIComponent(accessCookie.slice("AccessToken=".length));
  } catch {
    return null;
  }
};

const canAccessPrivatePage = (page, userId) =>
  page.type !== "private" ||
  page.owner.equals(userId) ||
  page.members.some((member) => member.equals(userId)) ||
  page.moderators.some((moderator) => moderator.equals(userId));

const getValidId = (value) =>
  typeof value === "string" && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin is not allowed"));
      },
      credentials: true,
    },
    maxHttpBufferSize: 1e6,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    try {
      const token = getAccessToken(socket);
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
        algorithms: ["HS256"],
      });
      if (!mongoose.Types.ObjectId.isValid(decoded?._id)) {
        return next(new Error("Unauthorized"));
      }
      const user = await User.findById(decoded._id).select(
        "_id username profileImage title badge",
      );
      if (!user) return next(new Error("Unauthorized"));

      socket.user = user;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    if (!onlineUser.has(userId)) onlineUser.set(userId, new Set());
    onlineUser.get(userId).add(socket.id);

    socket.on("join-page", async (pageId) => {
      const id = getValidId(pageId);
      if (!id) return socket.emit("socket-error", "Invalid page ID");
      try {
        const page = await Page.findById(id).select(
          "type owner members moderators",
        );
        if (!page) return socket.emit("socket-error", "Page not found");
        if (!canAccessPrivatePage(page, socket.user._id)) {
          return socket.emit("socket-error", "Page access denied");
        }
        await socket.join(`page:${id}`);
      } catch {
        socket.emit("socket-error", "Unable to join page");
      }
    });

    socket.on("leave-page", async (pageId) => {
      const id = getValidId(pageId);
      if (id) await socket.leave(`page:${id}`);
    });

    socket.on("join-post", async (postId) => {
      const id = getValidId(postId);
      if (!id) return socket.emit("socket-error", "Invalid post ID");
      try {
        const post = await Post.findById(id).select("pages");
        if (!post) return socket.emit("socket-error", "Post not found");
        const pages = await Page.find({
          _id: { $in: post.pages },
          type: "private",
        }).select("type owner members moderators");
        if (pages.some((page) => !canAccessPrivatePage(page, socket.user._id))) {
          return socket.emit("socket-error", "Post access denied");
        }
        await socket.join(`post:${id}`);
      } catch {
        socket.emit("socket-error", "Unable to join post");
      }
    });

    socket.on("leave-post", async (postId) => {
      const id = getValidId(postId);
      if (id) await socket.leave(`post:${id}`);
    });

    socket.on("join-user", async (requestedUserId) => {
      const id = getValidId(requestedUserId);
      if (!id || !id.equals(socket.user._id)) {
        return socket.emit("socket-error", "User room access denied");
      }
      await socket.join(userRoom);
    });

    socket.on("leave-user", async (requestedUserId) => {
      const id = getValidId(requestedUserId);
      if (id?.equals(socket.user._id)) await socket.leave(userRoom);
    });

    const broadcastTyping = (event) => (postId) => {
      const id = getValidId(postId);
      const room = id && `post:${id}`;
      if (!room || !socket.rooms.has(room)) {
        return socket.emit("socket-error", "Join the post before sending typing events");
      }
      socket.to(room).emit(event, {
        username: socket.user.username,
        profileImage: getOptimizedImage(socket.user.profileImage),
        badge: socket.user.badge,
      });
    };

    socket.on("typing", broadcastTyping("typing"));
    socket.on("stop-typing", broadcastTyping("stop-typing"));

    socket.on("disconnect", () => {
      const userSockets = onlineUser.get(userId);
      if (!userSockets) return;
      userSockets.delete(socket.id);
      if (userSockets.size === 0) onlineUser.delete(userId);
    });
  });

  return io;
};

export const isUserOnline = (userId) => onlineUser.has(userId.toString());

let ioInstance = null;
export const getIO = {
  set: (io) => {
    ioInstance = io;
  },
  get: () => ioInstance,
};

export const sendToUser = (userId, event, data) => {
  getIO.get()?.to(`user:${userId.toString()}`).emit(event, data);
};
