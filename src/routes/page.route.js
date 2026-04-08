import { Router } from "express";
import { jwtVerify } from "../middleware/jwtVerify.js";
import {createPage} from "../controllers/page.controller.js";
import {upload} from "../middleware/localUpload.js"

const router=Router();

//routes i needed for pages

//order

//specific routes

//any user
// router.route("/").get()//to get general content
// //owner only
router.route("/").post(jwtVerify,upload.avatarUpload("pageImage"),createPage);// create page
// router.route("/:page_id/moderator/:user_id").post(jwtVerify, isPageOwner)//make moderator
// router.route("/:page_id/moderator/:user_id").delete(jwtVerify,isPageOwner)//remove moderator

// //moderator + owner can operate
// router.route("/:page_id/members/:user_id").delete(jwtVerify,isPageModerator)//remove user
// //remove post from page
// router.route("/:page_id/request").get(jwtVerify,isPageModeratorOrOwner)//get pending request
// router.route("/:page_id/request/:req_id").post(jwtVerify,isPageModeratorOrOwner)//accept/reject request


// //logged in
// router.route("/:page_id/members").get(jwtVerify)//see member list
// router.route("/:page_id/leave").delete(jwtVerify)//leave the page
// router.route("/:page_id/join").post(jwtVerify)//join page or request to join



// //param routes

// //owner only
// router.route("/:page_id").patch(jwtVerify,isPageOwner)//edit page info
// router.route("/:page_id").delete(jwtVerify,isPageOwner)//delete page

// //any user- will handle how much information in controller
// router.route("/:page_id").get()


export default router;