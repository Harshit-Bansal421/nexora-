import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Comment must belong to a post"],
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null, // null = top level, ObjectId = reply
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Comment must have an author"],
    },
    body: {
      type: String,
      required: [true, "Comment body is required"],
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["none", "helpful", "pinned"],
      default: "none",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtuals
CommentSchema.virtual("upvoteCount").get(function () {
  return this.upvotes?.length || 0;
});

// Indexes
CommentSchema.index({ post: 1, createdAt: -1 }); // new comments
CommentSchema.index({ post: 1, upvotes: -1 }); // comments by likes
CommentSchema.index({ parentComment: 1, createdAt: 1 }); // for getting replies to a comment
CommentSchema.index({ author: 1 }); // user's comments

export const Comment = mongoose.model("Comment", CommentSchema);
