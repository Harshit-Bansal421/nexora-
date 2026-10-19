import { Router } from "express";
import { jwtVerify } from "../middleware/jwtVerify.js";
import { isPostOwner } from "../middleware/isPostowner.js";
import { upload } from "../middleware/localUpload.js";
import {
  createPost,
  deletePost,
  AddExistingPostToPage,
  updatePost,
  getPostById,
  savePost,
  unsavePost,
  getSavePost,
  getUserPosts,
  getTopicPosts,
  getPost,
  reactToPost,
  removeExistingPostFromPage,
  searchOnText,
  getPagePost
} from "../controllers/post.controller.js";
import { isPageOrPostOwner } from "../middleware/isPageOrPostOwner.js";
import ratelimit from "../middleware/RateLimiting.js";
import { verifyOptional } from "../middleware/verifyOptional.js";
const router = Router();

//specific named route first

//publc route any one can access them
router.route("/").get(ratelimit.readLimiter(), getPost);
router.route("/search").get(ratelimit.readLimiter(), searchOnText);
router.route("/topic/:topic").get(ratelimit.readLimiter(), getTopicPosts);
router.route("/user/:username").get(ratelimit.readLimiter(), getUserPosts);

//login user can access them
 //-> getting saved post of a user and user can also provide query of limit,page
router.route("/saved").get(jwtVerify, ratelimit.readLimiter(), getSavePost);
router.route("/page/:pageid").get(ratelimit.readLimiter(), verifyOptional, getPagePost);

//only owner can do these
router
  .route("/")
  .post(jwtVerify, ratelimit.writeLimiter(), upload.postUpload("PostImages", "PostVideos"), createPost); //--> for creating a post
router
  .route("/add/pages/:post_id")
  .post(jwtVerify, ratelimit.writeLimiter(), isPageOrPostOwner, AddExistingPostToPage); //--> for adding existing post on a particular page
router
  .route("/remove/pages/:post_id")
  .delete(jwtVerify, ratelimit.writeLimiter(), isPageOrPostOwner, removeExistingPostFromPage); //--> for removing existing post on a particular page,, get the pages from which post are to be removed in req.body

//param routes

router.route("/:post_id/vote").post(jwtVerify, ratelimit.writeLimiter(), reactToPost);
router.route("/:post_id/save").post(jwtVerify, ratelimit.writeLimiter(), savePost);
router.route("/:post_id/save").delete(jwtVerify, ratelimit.writeLimiter(), unsavePost);
router
  .route("/:post_id")
  .patch(
    jwtVerify,
    ratelimit.writeLimiter(),
    isPostOwner,
    upload.postUpload("addImages", "addVideos"),
    updatePost,
  ); //-->for updting a post
router.route("/:post_id").delete(jwtVerify, ratelimit.writeLimiter(), isPostOwner, deletePost); //--> for deleting a post

router.route("/:post_id").get(ratelimit.readLimiter(), verifyOptional, getPostById); //--> for fetching a single post

export default router;
