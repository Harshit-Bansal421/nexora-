import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";

let socket = null;
const postRoomSubscriptions = new Map();
const pageRoomSubscriptions = new Map();

const emitRoomMembership = (event, roomIds) => {
  for (const roomId of roomIds) socket.emit(event, roomId);
};

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: (callback) => {
        fetch("/api/v1/users/socket-token", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        })
          .then(async (response) => {
            if (!response.ok) throw new Error("Socket authentication failed");
            return response.json();
          })
          .then((response) => callback({ token: response?.data?.token }))
          .catch(() => callback({}));
      },
      autoConnect: true,
    });
    socket.on("connect", () => {
      emitRoomMembership("join-post", postRoomSubscriptions.keys());
      emitRoomMembership("join-page", pageRoomSubscriptions.keys());
    });
  }
  return socket;
};

export const joinPostRoom = (postId) => {
  const id = String(postId);
  const subscriptions = postRoomSubscriptions.get(id) || 0;
  postRoomSubscriptions.set(id, subscriptions + 1);
  const s = getSocket();
  if (subscriptions === 0 && s.connected) s.emit("join-post", id);
};

export const leavePostRoom = (postId) => {
  const id = String(postId);
  const subscriptions = postRoomSubscriptions.get(id) || 0;
  if (subscriptions <= 1) {
    postRoomSubscriptions.delete(id);
    if (socket?.connected) socket.emit("leave-post", id);
    return;
  }
  postRoomSubscriptions.set(id, subscriptions - 1);
};

export const joinPageRoom = (pageId) => {
  const id = String(pageId);
  const subscriptions = pageRoomSubscriptions.get(id) || 0;
  pageRoomSubscriptions.set(id, subscriptions + 1);
  const s = getSocket();
  if (subscriptions === 0 && s.connected) s.emit("join-page", id);
};

export const leavePageRoom = (pageId) => {
  const id = String(pageId);
  const subscriptions = pageRoomSubscriptions.get(id) || 0;
  if (subscriptions <= 1) {
    pageRoomSubscriptions.delete(id);
    if (socket?.connected) socket.emit("leave-page", id);
    return;
  }
  pageRoomSubscriptions.set(id, subscriptions - 1);
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
