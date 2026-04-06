// models/otp.model.js
import mongoose from 'mongoose'

const OTPSchema = new mongoose.Schema(
  {
    // No userId yet — user doesn't exist
    email: {
      type: String,
      required: true,
      unique: true, // one pending registration per email
    },
    
    type: {
      type: String,
      enum: ['email_verify', 'password_reset'],
      required: true,
    },

    // Stored temporarily until verified
    // Only for email_verify type
    pendingUsername: {
      type: String,
      required:true,
      unique:[true,"user with this username already exist"]
    },

    pendingUserImageID:{//public_id
      type:String,
      default:""
    },

    pendingPasswordHash: {
      type: String,
      default: null, // store already hashed password
    },

    // OTP data
    hashedOTP: {
      type: String,
      required: true,
    },

    //when will the otp expired
    expiry: {
      type: Date,
      required: true,
    },

    //it is used so user doesnot spam email
    resendCount: {
      type: Number,
      default: 0,
    },

    //to see user is not spaming in short time also
    lastResend: {
      type: Date,
      default: null,
    },

    //so that user cant try brute force
    failedAttempts: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
)

// Auto delete when expiry reached — ghost data never lingers
OTPSchema.index({ expiry: 1 }, { expireAfterSeconds: 0 })

// One pending registration per email
OTPSchema.index({ email: 1, type: 1 }, { unique: true })

export const OTP = mongoose.model('OTP', OTPSchema)