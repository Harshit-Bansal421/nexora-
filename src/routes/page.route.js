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
  joinPage,
  seePendingRequest,
  approvePendingRequest,
  leavePage,
  updatePageinfo,
  getParticularPage,
} from "../controllers/page.controller.js";
import { upload } from "../middleware/localUpload.js";
import { isPageOwner } from "../middleware/isPageowner.js";
import { verifyOptional } from "../middleware/verifyOptional.js";
import { isPageMember } from "../middleware/isPageMember.js";
import { loadingPage } from "../middleware/loadingPage.js";
import { checkMembership } from "../middleware/checkMembership.js";
import { isPageModeratorOrOwner } from "../middleware/isPageModeratorOrOwner.js";
import ratelimit from "../middleware/RateLimiting.js";

const router = Router();

//because of any checking is that a requestedusers is member or not i am making req.body.users an array to check them

//specific routes

//any user
router.route("/").get(ratelimit.readLimiter(), verifyOptional, getPages);
// //owner only
router
  .route("/")
  .post(jwtVerify, ratelimit.writeLimiter(), upload.avatarUpload("pageProfileImage"), createPage);
router
  .route("/:page_id/moderators")
  .post(jwtVerify, ratelimit.writeLimiter(), loadingPage, isPageOwner, checkMembership, makeModerator);
router
  .route("/:page_id/moderators")
  .delete(
    jwtVerify,
    ratelimit.writeLimiter(),
    loadingPage,
    isPageOwner,
    checkMembership,
    removeModerator,
  ); //remove moderator

// //moderator + owner can operate
router
  .route("/:page_id/members")
  .delete(
    jwtVerify,
    ratelimit.writeLimiter(),
    loadingPage,
    isPageModeratorOrOwner,
    checkMembership,
    removeUser,
  ); //remove user--jo banda remove kr ra vo moderator ya owner hoga and req.body mei accept krenge membership so that any number of users can be removed from the page
router
  .route("/:page_id/requests")
  .get(jwtVerify, ratelimit.readLimiter(), loadingPage, isPageModeratorOrOwner, seePendingRequest);
router
  .route("/:page_id/request")
  .post(jwtVerify, ratelimit.writeLimiter(), loadingPage, isPageModeratorOrOwner, approvePendingRequest);

//only member can access
router
  .route("/:page_id/members")
  .get(jwtVerify, ratelimit.readLimiter(), loadingPage, isPageMember, seeMembersList);

// //logged in
router
  .route("/:page_id/leave")
  .delete(jwtVerify, ratelimit.writeLimiter(), loadingPage, isPageMember, leavePage);
router.route("/:page_id/join").post(jwtVerify, ratelimit.writeLimiter(), joinPage);

// //param routes

// //owner only
router
  .route("/:page_id")
  .patch(
    jwtVerify,
    ratelimit.writeLimiter(),
    loadingPage,
    isPageOwner,
    upload.avatarUpload("newPageImage"),
    updatePageinfo,
  ); //edit page info
router
  .route("/:page_id")
  .delete(jwtVerify, ratelimit.sensitiveLimiter(), loadingPage, isPageOwner, deletePage);

// //any user- will handle how much information in controller
router.route("/:page_id").get(ratelimit.readLimiter(), verifyOptional, loadingPage, getParticularPage);

export default router;
