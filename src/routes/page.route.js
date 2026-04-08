import { Router } from "express";

const router=Router();

//routes i needed for pages

//order

//specific routes

//any user
router.route("/").get()//to get general content
//owner only
router.route("/").post()// create page
router.route("/:page_id/moderator/:user_id").post()//make moderator
router.route("/:page_id/moderator/:user_id").delete()//remove moderator

//moderator + owner can operate
router.route("/:page_id/members/:user_id").delete()//remove user
//remove post from page
router.route("/:page_id/request").get()//get pending request
router.route("/:page_id/request/:req_id").post()//accept/reject request


//logged in
router.route("/:page_id/members").get()//see member list
router.route("/:page_id/leave").delete()//leave the page
router.route("/:page_id/join").post()//join page or request to join



//param routes

//owner only
router.route("/:page_id").patch()//edit page info
router.route("/:page_id").delete()//delete page

//any user- will handle how much information in controller
router.route("/:page_id").get()


export default Router;