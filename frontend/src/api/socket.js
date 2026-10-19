import { io } from "socket.io-client";

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io("/", {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: true,
    });
  }
  return socket;
};

export const joinPostRoom = (postId) => {
  const s = getSocket();
  s.emit("join-post", postId);
};

export const leavePostRoom = (postId) => {
  const s = getSocket();
  s.emit("leave-post", postId);
};

export const joinPageRoom = (pageId) => {
  const s = getSocket();
  s.emit("join-page", pageId);
};

export const leavePageRoom = (pageId) => {
  const s = getSocket();
  s.emit("leave-page", pageId);
};

export const joinUserRoom = (userId) => {
  const s = getSocket();
  s.emit("join-user", userId);
};

export const leaveUserRoom = (userId) => {
  const s = getSocket();
  s.emit("leave-user", userId);
};

export default getSocket;
