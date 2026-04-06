import { Router } from "express";
import { jwtVerify } from "../middleware/jwtVerify";

const router=Router();


//post routes(i didnot make routes for unsave because i will just toggle and i also didnot make different route for downvote or upvote because they will be handled in one)

//publc route any one can access them 
router.route("/").get()//--> for getting posts from default content
router.route("/search").get()//for intent based getting post
router.route("/type/:type").get()//--> for getting post of particular type
router.route("/user/:user_id").get()//to get posts of some particular user,used in time of seeing some profile page

//login user can access them 
router.route("/saved").get(jwtVerify)//-> getting saved post of a user
router.route("/page/:pageid").get(jwtVerify)//-> to get the post of a particular page
router.route("/:id/vote").post(jwtVerify)//--> to perform upvote,downvote 
router.route("/:id/save").post(jwtVerify)//to save the post 


//only owner can do these
router.route("/").post(jwtVerify)//--> for creating a post
router.route("/:id").patch(jwtVerify)//-->for updting a post
router.route("/:id").delete(jwtVerify)//--> for deleting a post


router.route("/:id").get()//--> for fetching a single post


export default router;