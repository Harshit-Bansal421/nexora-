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
  resetPassword
} from "../controllers/userauth.controller.js";
import { jwtVerify } from "../middleware/jwtVerify.js";

const router = Router();
//for sign->signin then we get current user(by frontend)
//for login-> we do actuall login

//public routes
router.route("/signup").post(ratelimit.authLimiter(), upload.avatarUpload(), SignupUser);
router.route("/login").post(ratelimit.authLimiter(), loginUser);
router.route("/refreshToken").post(ratelimit.authLimiter(), getNewAccessToken);
router.route("/verify-email").post(ratelimit.authLimiter(),verifyEmailandLogin);
router.route("/resend-email").post(ratelimit.authLimiter(),resendEmail);//will work for both verify email as well as change password
router.route("/forgot-password").post(ratelimit.authLimiter(),forgotPassword);
router.route("/verify-reset-otp").post(ratelimit.authLimiter(), verifyResetOTP)
router.route("/reset-password").post(ratelimit.authLimiter(), resetPassword)

//protected routes
router.route("/currentuser").get(ratelimit.authLimiter(), jwtVerify, getCurrentUser);
router.route("/logout").post(ratelimit.authLimiter(), jwtVerify, logoutUser);
router.route("/logout-all").post(ratelimit.authLimiter(), jwtVerify, logoutUserAllDevice);
router.route("/update-username").patch(ratelimit.authLimiter(),jwtVerify,updateUsername);
router.route("/change-password").patch(ratelimit.authLimiter(),jwtVerify,UpdatePassword);
// router.route("/update-profile").patch();



//post routes

export default router;
