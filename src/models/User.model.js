import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

const UserSchema = mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: [true, "username is required"],
      trim: true,
      lowercase: true,
      minlength: [4, "username should have atleast 4 character"],
      maxlength: [20, "username can have atmost 20 character"],
    },
    email: {
      type: String,
      unique: true,
      required: [true, "email is required"],
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      minlength: [5, "password should have atleast minimum of 5 length"],
    },
    title: {
      type: String,
      enum: {
        values: ["Newcomer", "Contributor", "Helper", "Mentor", "Legend"],
        message:"user must have title from Newcomer,Contributor,Helper,Mentor,Legend"
      },
      default: "Newcomer",
    },
    point: {
      type: Number,
      default: 0,
    },
    profileImage: {
      type: String,
      default: "",
    },
    followers: [{ type: mongoose.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Types.ObjectId, ref: "User" }],
    savedPost: [{ type: mongoose.Types.ObjectId, ref: "Post" }],
    refreshToken: [String],
    bio: {
      type: String,
      maxlength: [150, "bio can no exceed 150 characters"],
      default: "",
    },
    badges: [String],
    googleId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// UserSchema.pre("save", async function () {
//   if (!this.isModified("password") || !this.password) return ;//agar password update nhi hua load hone ke baad to return kr do
//   this.password = await bcryptjs.hash(this.password, 12);
// }); we do not need this because we already getting hashed password from otpshcema

UserSchema.methods.isPasswordCorrect = async function (password) {
  return await bcryptjs.compare(password, this.password);
};

UserSchema.virtual("followersCount").get(function () {
  return this.followers?.length || 0;
});

UserSchema.virtual("followingCount").get(function () {
  return this.following?.length || 0;
});

UserSchema.methods.accessTokenGenerator = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    },
  );
};

UserSchema.methods.refreshTokenGenerator = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    },
  );
};

UserSchema.methods.toJSON = function () {
  const user = this.toObject(); //it become plain js object now we can easily modify,delete and update it
  delete user.password;
  delete user.refreshToken;
  return user;
};

UserSchema.methods.addXP = async function (points) {
  this.point += points;
  if (this.point >= 5000) this.title = "Legend";
  else if (this.point >= 1501) this.title = "Mentor";
  else if (this.point >= 501) this.title = "Helper";
  else if (this.point >= 101) this.title = "Contributor";
  else this.title = "Newcomer";
  await this.save({ validateBeforeSave: false });
};

export const User = mongoose.model("User", UserSchema);
