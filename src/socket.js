import ApiError from "./utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "./models/User.model.js";
import { Server } from "socket.io";
import { getOptimizedImage } from "./utils/Cloudinary.js";

const onlineUser = new Map();
export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      credentials: true,
    },
    pingTimeout: 60000, //how long to wait before considering connection dead
    pingInterval: 25000, //how often to ping client to check connection
  });

  io.use(async (socket, next) => {
    try {
      //get aceess token for checking authenticity
      const token =
        socket.handshake.auth?.token || //Socket.IO auth object
        socket.handshake.query?.token || //route query
        socket.handshake.headers?.authorization?.split(" ")[1]; // header authorisation bearrer

      if (!token)
        throw new ApiError(400, "no token is present || go to login page");

      //check the authenticity of code
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded._id).select(
        "_id username profileImage title badge",
      );

      if (!user) {
        return next(new Error("Unauthorized — user not found"));
      }

      // Attach user to socket — available in all listeners
      socket.user = user;
      return next();
      //if it is correct then store the id in onlineuser map
    } catch (error) {
      console.log("SOCKET AUTH ERROR:", error);
      return next(error);
    }
  });

  io.on("connection", (socket) => {
    const userid = socket.user._id.toString();
    if(!onlineUser.has(userid)){
      onlineUser.set(userid,new Set())
    };

    onlineUser.get(userid).add(socket.id);

    socket.on("join-page", async (page_id) => {
      if (!page_id) return;
      const room = `page:${String(page_id).trim()}`;
      await socket.join(room);
      console.log(`${socket.user.username} joined page = ${page_id}`);
    });

    socket.on("leave-page", async (page_id) => {
      if (!page_id) return;
      const room = `page:${String(page_id).trim()}`;
      await socket.leave(room);
      console.log(`${socket.user.username} leaved page = ${page_id}`);
    });

    socket.on("join-post", async (post_id) => {
      if (!post_id) return;
      const room = `post:${String(post_id).trim()}`;
      await socket.join(room);
      console.log(`${socket.user.username} joined post = ${post_id}`);
    });

    socket.on("leave-post", async (post_id) => {
      if (!post_id) return;
      const room = `post:${String(post_id).trim()}`;
      await socket.leave(room);
      console.log(`${socket.user.username} leave post = ${post_id}`);
    });

    socket.on("join-user",async(user_id)=>{
      const room=`user:${String(user_id).trim()}`
      await socket.join(room);
    })

    socket.on("leave-user",async(user_id)=>{
      const room=`user:${String(user_id).trim()}`
      await socket.leave(room);
    })

    socket.on("typing",(post_id) => {
      if (!post_id) return;
      const room = `post:${String(post_id).trim()}`;
      socket.broadcast.to(room).emit("typing", {
        username: socket.user.username,
        profileImage: getOptimizedImage(socket.user.profileImage),
        badge: socket.user.badge,
      });
    });

    socket.on("stop-typing",(post_id) => {
      if (!post_id) return;
      const room = `post:${String(post_id).trim()}`;
      socket.broadcast.to(room).emit("stop-typing", {
        username: socket.user.username,
        profileImage: getOptimizedImage(socket.user.profileImage),
        badge: socket.user.badge,
      });
    });

    socket.on("disconnect", (reason) => {
      const userid=socket.user._id.toString();
      const userSockets=onlineUser.get(userid);
      if(userSockets){
        userSockets.delete(socket.id);
        if(userSockets.size===0){
          onlineUser.delete(userid);
        }
      }
      console.log("disconnected:", socket.id, reason);
    });
  });

  return io;
};

export const isUserOnline = (userId) => {
  return onlineUser.has(userId.toString());
};

let ioInstance = null;
export const getIO = {
  set: (io) => {
    ioInstance = io;
  },
  get: () => ioInstance,
};

export const sendToUser = (userId, event, data) => {
  const socketid = onlineUser.get(userId.toString());
  if (!socketid) return;
  for(const sid of socketid){
    getIO.get().to(sid).emit(event, data);
  }
};
