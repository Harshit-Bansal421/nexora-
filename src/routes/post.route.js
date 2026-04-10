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
} from "../controllers/post.controller.js";
import { isPageOrPostOwner } from "../middleware/isPageOrPostOwner.js";
const router = Router();

//specific named route first

//publc route any one can access them
router.route("/").get(getPost); //--> for getting posts from default content
// router.route("/search").get(); //for intent based getting post
router.route("/topic/:topic").get(getTopicPosts); //--> for getting post of particular type
router.route("/user/:username").get(getUserPosts); //to get posts of some particular user,used in time of seeing some profile page

//login user can access them
router.route("/saved").get(jwtVerify, getSavePost); //-> getting saved post of a user and user can also provide query of limit,page
// router.route("/page/:pageid").get(jwtVerify); //-> to get the post of a particular page

//only owner can do these
router
  .route("/")
  .post(jwtVerify, upload.postUpload("PostImages", "PostVideos"), createPost); //--> for creating a post
router
  .route("/add/pages/:post_id")
  .post(jwtVerify, isPageOrPostOwner, AddExistingPostToPage); //--> for adding existing post on a particular page
router
  .route("/remove/pages/:post_id")
  .delete(jwtVerify, isPageOrPostOwner, removeExistingPostFromPage); //--> for removing existing post on a particular page,, get the pages from which post are to be removed in req.body

//param routes

router.route("/:post_id/vote").post(jwtVerify, reactToPost); //--> to perform upvote,downvote//i want type also in req.body
router.route("/:post_id/save").post(jwtVerify, savePost); //to save the post
router.route("/:post_id/save").delete(jwtVerify, unsavePost); //to unsave the post
router
  .route("/:post_id")
  .patch(
    jwtVerify,
    isPostOwner,
    upload.postUpload("addImages", "addVideos"),
    updatePost,
  ); //-->for updting a post
router.route("/:post_id").delete(jwtVerify, isPostOwner, deletePost); //--> for deleting a post

router.route("/:post_id").get(jwtVerify, getPostById); //--> for fetching a single post

export default router;
