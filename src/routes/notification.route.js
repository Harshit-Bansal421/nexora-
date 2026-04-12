import { Router } from "express";
import { jwtVerify } from "../middleware/jwtVerify.js";
import {getNotification,markRead,markReadAll} from "../controllers/notification.controller.js";

const router=Router();


//logged in users
router.route("/").get(jwtVerify,getNotification);//get notifications
router.route("/:notification_id/read").get(jwtVerify,markRead);
router.route("/:notification_id/read-all").get(jwtVerify,markReadAll);

export default router;