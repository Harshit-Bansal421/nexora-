import { Router } from "express";
import ratelimit from "../middleware/RateLimiting.js";
import { upload } from "../middleware/localUpload.js";
import {
  SignupUser,
  getCurrentUser,
  getNewAccessToken,
  loginUser,
  logoutUser,
  logoutUserAllDevice,
  verifyEmailandLogin,
  updateUsername,
  UpdatePassword,
  resendEmail,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  followUser,
  unfollowUser,
  updateProfile,
  getFollowList,
} from "../controllers/userauth.controller.js";
import { jwtVerify } from "../middleware/jwtVerify.js";

const router = Router();
//for sign->signin then we get current user(by frontend)
//for login-> we do actuall login

//public routes
router.route("/signup").post(ratelimit.authLimiter(), upload.avatarUpload(), SignupUser);
router.route("/login").post(ratelimit.authLimiter(), loginUser);
router.route("/refreshToken").post(ratelimit.sensitiveLimiter(), getNewAccessToken);
router.route("/verify-email").post(ratelimit.sensitiveLimiter(), verifyEmailandLogin);
router.route("/resend-email").post(ratelimit.sensitiveLimiter(), resendEmail);
router.route("/forgot-password").post(ratelimit.sensitiveLimiter(), forgotPassword);
router.route("/verify-reset-otp").post(ratelimit.sensitiveLimiter(), verifyResetOTP);
router.route("/reset-password").post(ratelimit.sensitiveLimiter(), resetPassword);

//protected routes
router.route("/follow/:user_id").post(jwtVerify, ratelimit.writeLimiter(), followUser);
router.route("/unfollow/:user_id").delete(jwtVerify, ratelimit.writeLimiter(), unfollowUser);
router.route("/currentuser").get(jwtVerify, ratelimit.readLimiter(), getCurrentUser);
router.route("/logout").post(jwtVerify, ratelimit.writeLimiter(), logoutUser);
router.route("/logout-all").post(jwtVerify, ratelimit.sensitiveLimiter(), logoutUserAllDevice);
router.route("/update-username").patch(jwtVerify, ratelimit.writeLimiter(), updateUsername);
router.route("/change-password").patch(jwtVerify, ratelimit.sensitiveLimiter(), UpdatePassword);
router.route("/update-profile").patch(jwtVerify, ratelimit.writeLimiter(), updateProfile);
router.route("/:user_id/:listType").get(ratelimit.readLimiter(), getFollowList);



//post routes

export default router;
