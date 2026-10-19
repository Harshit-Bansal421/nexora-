// models/otp.model.js
import mongoose from "mongoose";

const OTPSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["email_verify", "password_reset"],
      required: true,
    },
    pendingUsername: {
      type: String,
      lowercase: true,
      trim: true,
      required: function () {
        return this.type === "email_verify";
      },
    },
    pendingUserImageID: {
      type: String,
      default: "",
    },
    pendingPasswordHash: {
      type: String,
      default: null,
    },
    hashedOTP: {
      type: String,
      required: true,
    },
    expiry: {
      type: Date,
      required: true,
    },
    resendCount: {
      type: Number,
      default: 0,
    },
    lastResend: {
      type: Date,
      default: null,
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

OTPSchema.index({ expiry: 1 }, { expireAfterSeconds: 0 });
OTPSchema.index({ email: 1, type: 1 }, { unique: true });
OTPSchema.index(
  { pendingUsername: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: "email_verify",
      pendingUsername: { $exists: true },
    },
  },
);

export const OTP = mongoose.model("OTP", OTPSchema);