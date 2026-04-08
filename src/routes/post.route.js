import { Router } from "express";
import { jwtVerify } from "../middleware/jwtVerify.js";
import { isOwner } from "../middleware/isowner.js";
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
  removeExistingPostToPage,
} from "../controllers/post.controller.js";

const router = Router();

//post routes

//publc route any one can access them
router.route("/").get(getPost); //--> for getting posts from default content
// router.route("/search").get(); //for intent based getting post
router.route("/topic/:topic").get(getTopicPosts); //--> for getting post of particular type
router.route("/user/:username").get(getUserPosts); //to get posts of some particular user,used in time of seeing some profile page

//login user can access them
router.route("/saved").get(jwtVerify, getSavePost); //-> getting saved post of a user and user can also provide query of limit,page
// router.route("/page/:pageid").get(jwtVerify); //-> to get the post of a particular page
router.route("/:post_id/vote").post(jwtVerify, reactToPost); //--> to perform upvote,downvote//i want type also in req.body
router.route("/:post_id/save").post(jwtVerify, savePost); //to save the post
router.route("/:post_id/save").delete(jwtVerify, unsavePost); //to unsave the post

//only owner can do these
router
  .route("/")
  .post(jwtVerify, upload.postUpload("PostImages", "PostVideos"), createPost); //--> for creating a post
router
  .route("/:post_id")
  .patch(
    jwtVerify,
    isOwner,
    upload.postUpload("addImages", "addVideos"),
    updatePost,
  ); //-->for updting a post
router.route("/:post_id").delete(jwtVerify, isOwner, deletePost); //--> for deleting a post
router.route("/add/:post_id").post(jwtVerify, isOwner, AddExistingPostToPage); //--> for adding existing post on a particular page
router
  .route("/add/:post_id")
  .delete(jwtVerify, isOwner, removeExistingPostToPage); //--> for adding existing post on a particular page

router.route("/:post_id").get(jwtVerify, getPostById); //--> for fetching a single post

export default router;
