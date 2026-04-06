import mongoose from "mongoose";

const JoinRequestSchema = new mongoose.Schema(
  {
    page: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Page",
      required: [true, "Join request must belong to a page"],
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Join request must have a user"],
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected"],
        message: "Status must be pending, approved or rejected",
      },
      default: "pending",
    },
    // Optional message from user when requesting to join
    message: {
      type: String,
      maxlength: [200, "Message cannot exceed 200 characters"],
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

JoinRequestSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 7,
    partialFilterExpression: {
      status: { $in: ["approved", "rejected"] },
    },
  },
);
JoinRequestSchema.index({ page: 1, status: 1 });
JoinRequestSchema.index({ page: 1, requestedBy: 1 }, { unique: true }); //it is made to make sure there is no duplicate request as js can be bypass but this mongodb cant be

export const JoinRequest = mongoose.model("JoinRequest", JoinRequestSchema);
