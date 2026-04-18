import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Notification must have a recipient"],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Notification must have a sender"],
    },
    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: {
        values: [
          "comment", //someone commented on your post
          "reply", //someone replied to your comment
          "post_upvote", //someone upvoted your post
          "post_downvote",//someone downvoted your post
          "comment_upvote", //someone upvoted your comment
          "helpful", //your comment marked as helpful
          "follow", //someone followed you
          "page_join", //someone joined your page
          "page_removed", //you were removed from a page
          "page_deleted", //a page you were in got deleted
          "mod_appointed", //you were made moderator
          "mod_removed", //you were removed as moderator
          "request_approved", //your join request approved
          "request_rejected", //your join request rejected
          "join_request", //someone want to join ur page,
          "pinned"//pinned ur comment
        ],
        message: "Invalid notification type",
      },
    },

    // What the notification links to
    // All optional — depends on type
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    page: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Page",
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    // Optional message override
    // if null — frontend generates message from type + sender
    message: {
      type: String,
      default: null,
      maxlength: [200, "Message cannot exceed 200 characters"],
    },
  },
  {
    timestamps: true,
  },
);

// ── Indexes ────────────────────────────────────────────────────────
// Most common query — get all notifications for a user
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// Unread count — for notification bell
NotificationSchema.index({ recipient: 1, isRead: 1 });

// Auto delete after 30 days — keeps DB clean
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

export const Notification = mongoose.model("Notification", NotificationSchema);
