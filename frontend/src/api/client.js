import axios from "axios";

// Base API client
const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true, // Needed for JWT cookies
  headers: {
    Accept: "application/json",
  },
});

// Response interceptor to normalize response data
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    const isPublicAuthRequest =
      /\/users\/(signup|login|refreshToken|verify-email|resend-email|forgot-password|verify-reset-otp|reset-password)(?:\/|$)/.test(
        originalRequest?.url || "",
      );
    // Auto-refresh token if 401 and not already retrying
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isPublicAuthRequest
    ) {
      originalRequest._retry = true;
      try {
        await axios.post(
          "/api/v1/users/refreshToken",
          {},
          { withCredentials: true },
        );
        return api(originalRequest);
      } catch {
        // Refresh failed, let the error fall through
        return Promise.reject(error.response?.data || error);
      }
    }
    return Promise.reject(error.response?.data || error);
  },
);

// Auth & User APIs
export const authApi = {
  signup: (formData) =>
    api.post("/users/signup", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  login: (credentials) => api.post("/users/login", credentials),
  verifyEmail: (data) => api.post("/users/verify-email", data),
  resendEmail: (data) => api.post("/users/resend-email", data),
  forgotPassword: (data) => api.post("/users/forgot-password", data),
  verifyResetOtp: (data) => api.post("/users/verify-reset-otp", data),
  resetPassword: (data) => api.post("/users/reset-password", data),
  changePassword: (data) => api.patch("/users/change-password", data),
  getCurrentUser: () => api.get("/users/currentuser"),
  logout: () => api.post("/users/logout"),
  logoutAll: () => api.post("/users/logout-all"),
  updateUsername: (data) => api.patch("/users/update-username", data),
  updateProfile: (data) => api.patch("/users/update-profile", data),
  unfollowUser: (userId) => api.delete(`/users/unfollow/${userId}`),
};

// Post APIs
export const postApi = {
  getPosts: (params) => api.get("/posts", { params }),
  getTopicPosts: (topic, params) =>
    api.get(`/posts/topic/${topic}`, { params }),
  getUserPosts: (username, params) =>
    api.get(`/posts/user/${username}`, { params }),
  getSavedPosts: (params) => api.get("/posts/saved", { params }),
  getPagePosts: (pageId, params) =>
    api.get(`/posts/page/${pageId}`, { params }),
  getPostById: (postId) => api.get(`/posts/${postId}`),
  searchPosts: (search) => api.get("/posts/search", { params: { search } }),
  createPost: (formData) =>
    api.post("/posts", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updatePost: (postId, formData) =>
    api.patch(`/posts/${postId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deletePost: (postId) => api.delete(`/posts/${postId}`),
  votePost: (postId, type) => api.post(`/posts/${postId}/vote`, { type }),
  savePost: (postId) => api.post(`/posts/${postId}/save`),
  unsavePost: (postId) => api.delete(`/posts/${postId}/save`),
  addPostToPage: (postId, pageIds) =>
    api.post(`/posts/add/pages/${postId}`, { pages: pageIds }),
  removePostFromPage: (postId, pageIds) =>
    api.delete(`/posts/remove/pages/${postId}`, { data: { pages: pageIds } }),
};

// Page / Community APIs
export const pageApi = {
  getPages: (params) => api.get("/pages", { params }),
  getPageById: (pageId) => api.get(`/pages/${pageId}`),
  createPage: (formData) =>
    api.post("/pages", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updatePage: (pageId, formData) =>
    api.patch(`/pages/${pageId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deletePage: (pageId) => api.delete(`/pages/${pageId}`),
  joinPage: (pageId, message = "") =>
    api.post(`/pages/${pageId}/join`, { message }),
  leavePage: (pageId, newOwner) =>
    api.delete(`/pages/${pageId}/leave`, { data: { newOwner } }),
  getPageMembers: (pageId, params) =>
    api.get(`/pages/${pageId}/members`, { params }),
  removeMember: (pageId, memberId) =>
    api.delete(`/pages/${pageId}/members`, { data: { memberId } }),
  addModerator: (pageId, userId) =>
    api.post(`/pages/${pageId}/moderators`, { userId }),
  removeModerator: (pageId, userId) =>
    api.delete(`/pages/${pageId}/moderators`, { data: { userId } }),
  getJoinRequests: (pageId, params) =>
    api.get(`/pages/${pageId}/requests`, { params }),
  handleJoinRequest: (pageId, requestedBy, status) =>
    api.post(`/pages/${pageId}/request`, { requestedBy, status }),
};

// Comment APIs
export const commentApi = {
  getComments: (postId, params) =>
    api.get(`/comments/post/${postId}`, { params }),
  createComment: (postId, data) => api.post(`/comments/post/${postId}`, data),
  updateComment: (commentId, data) => api.patch(`/comments/${commentId}`, data),
  deleteComment: (commentId) => api.delete(`/comments/${commentId}`),
  upvoteComment: (commentId) => api.post(`/comments/${commentId}/upvote`),
  setCommentStatus: (postId, commentId, status) =>
    api.post(`/comments/${postId}/${commentId}/status`, { status }),
};

// Notification APIs
export const notificationApi = {
  getNotifications: (params) => {
    // Note: Backend uses ?pages=1 instead of ?page=1
    const p = { ...params };
    if (p.page && !p.pages) {
      p.pages = p.page;
      delete p.page;
    }
    return api.get("/notifications", { params: p });
  },
  markAsRead: (notificationId) =>
    api.patch(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.patch("/notifications/all/read-all"),
};

export default api;
