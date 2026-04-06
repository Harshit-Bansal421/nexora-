import mongoose from "mongoose";

const PostSchema = mongoose.Schema(
  {
    owner: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: [true, "Post must have an owner"],
    },
    title: {
      type: String,
      required: [true, "Post title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    topic: {
      type: String,
      required: [true, "Topic is required"],
      enum: {
        values: ["Academic", "Career", "Tech", "Life"],
        message: "Topic must be Academic, Career, Tech or Life",
      },
    },
    postImage: {
      type: [String],
      validate: {
        validator: (arr) => arr.length <= 3,
        message: "Maximum 3 images allowed per post",
      },
      default: [],
    },
    postVideo:{
      type:[String],
      validate: {
        validator: (arr) => arr.length <= 1,
        message: "Maximum 1 images allowed per post",
      },
      default: [],
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    downvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    description: {
      type: String,
      required:[true,"description is required"],
      maxlength: [500, "description maxlength shouldnot exceed 500 words"],
    },
    pages:[{
      type:mongoose.Schema.Types.ObjectId,
      ref:"Page",
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

PostSchema.virtual("upvotesCount").get(function () {
  return this.upvotes.length;
});

PostSchema.virtual("downvotesCount").get(function () {
  return this.downvotes.length;
});

PostSchema.index({owner:1,createdAt:-1})
PostSchema.index({owner:1,title:1,createdAt:1})
PostSchema.index({createdAt:-1})
PostSchema.index({topic:1})
PostSchema.index({pages:1,title:1,createdAt:1})
PostSchema.index({ title: 'text', description: 'text' })   // full text search

export const Post=mongoose.model("Post",PostSchema)