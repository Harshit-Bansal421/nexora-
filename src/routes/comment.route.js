import { Router } from "express";
import { isCommentOwner } from "../middleware/isCommentOwner.js";
import { canDeleteComment } from "../middleware/canDeleteComment.js";
import { jwtVerify } from "../middleware/jwtVerify.js";
import ratelimit from "../middleware/RateLimiting.js";
import { isPostOwner } from "../middleware/isPostowner.js";
import { verifyOptional } from "../middleware/verifyOptional.js";
import {
  createComment,
  getComnment,
  editComment,
  deleteComment,
  voteComment,
  statusComment,
} from "../controllers/comment.controller.js";

const router = Router();

//any user
router.route("/post/:post_id").get(ratelimit.readLimiter(), verifyOptional, getComnment);

//loggedin user
router.route("/post/:post_id").post(jwtVerify, ratelimit.writeLimiter(), createComment);

//comment owner only
router.route("/:comment_id").delete(jwtVerify, ratelimit.writeLimiter(), canDeleteComment, deleteComment);
router.route("/:comment_id").patch(jwtVerify, ratelimit.writeLimiter(), isCommentOwner, editComment);

//any logged in user
router.route("/:comment_id/vote").post(jwtVerify, ratelimit.writeLimiter(), voteComment);

//only post owner can do this
router
  .route("/:post_id/:comment_id/status")
  .post(jwtVerify, ratelimit.writeLimiter(), isPostOwner, statusComment);

export default router;
