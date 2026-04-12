import { Router } from "express";
import { isCommentOwner } from "../middleware/isCommentOwner.js";
import { jwtVerify } from "../middleware/jwtVerify.js";
import { isPostOwner } from "../middleware/isPostowner.js";
import {
  createComment,
  getComnment,
  editComment,
  deleteComment,
  upvoteComment,
  statusComment,
} from "../controllers/comment.controller.js";

const router = Router();

//any user
router.route("/post/:post_id").get(getComnment); //get the comments of a postid

//loggedin user
router.route("/post/:post_id").post(jwtVerify, createComment); //create a comment

//comment owner only
router.route("/:comment_id").delete(jwtVerify, isCommentOwner, deleteComment); //delete a comment
router.route("/:comment_id").patch(jwtVerify, isCommentOwner, editComment); //edit the comment

//any logged in user
router.route("/:comment_id/upvote").post(jwtVerify, upvoteComment); //user can react to the comment

//only post owner can do this
router
  .route("/:post_id/:comment_id/status")
  .post(jwtVerify, isPostOwner, statusComment); //user can pinned or helpful-->user has to tell what they wanna do

export default router;
