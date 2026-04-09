import { Router } from "express";
import { jwtVerify } from "../middleware/jwtVerify.js";
import {
  createPage,
  deletePage,
  getPages,
  makeModerator,
  removeModerator,
  seeMembersList,
  removeUser,
  joinPage
} from "../controllers/page.controller.js";
import { upload } from "../middleware/localUpload.js";
import { isPageOwner } from "../middleware/isPageowner.js";
import { verifyOptional } from "../middleware/verifyOptional.js";
import { isPageMember } from "../middleware/isPageMember.js";
import { loadingPage } from "../middleware/loadingPage.js";
import { checkMembership } from "../middleware/checkMembership.js";
import { isPageModeratorOrOwner } from "../middleware/isPageModeratorOrOwner.js"
const router = Router();

//because of any checking is that a requestedusers is member or not i am making req.body.users an array to check them

//specific routes

//any user
router.route("/").get(verifyOptional, getPages); //to get general content
// //owner only
router
  .route("/")
  .post(jwtVerify, upload.avatarUpload("pageProfileImage"), createPage); // create page
router
  .route("/:page_id/moderators")
  .post(jwtVerify, loadingPage, isPageOwner, checkMembership, makeModerator); //make moderator-- we send user_id through body
router
  .route("/:page_id/moderators")
  .delete(
    jwtVerify,
    loadingPage,
    isPageOwner,
    checkMembership,
    removeModerator,
    joinPage
  ); //remove moderator

// //moderator + owner can operate
router.route("/:page_id/members").delete(jwtVerify,loadingPage,isPageModeratorOrOwner,checkMembership,removeUser)//remove user--jo banda remove kr ra vo moderator ya owner hoga and req.body mei accept krenge membership so that any number of users can be removed from the page
// //remove post from page
// router.route("/:page_id/request").get(jwtVerify,isPageModeratorOrOwner)//get pending request
// router.route("/:page_id/request/:req_id").post(jwtVerify,isPageModeratorOrOwner)//accept/reject request

//only member can access
router
  .route("/:page_id/members")
  .get(jwtVerify, loadingPage, isPageMember, seeMembersList); //see member list

// //logged in
// router.route("/:page_id/leave").delete(jwtVerify)//leave the page
router.route("/:page_id/join").post(jwtVerify,joinPage)//join page or request to join

// //param routes

// //owner only
//router.route("/:page_id").patch(jwtVerify,isPageOwner)//edit page info
router
  .route("/:page_id")
  .delete(jwtVerify, loadingPage, isPageOwner, deletePage); //delete page

// //any user- will handle how much information in controller
// router.route("/:page_id").get()

export default router;
