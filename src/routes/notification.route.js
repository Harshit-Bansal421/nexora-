import { Router } from "express";
import { jwtVerify } from "../middleware/jwtVerify.js";
import {getNotification,markRead,markReadAll} from "../controllers/notification.controller.js";
import ratelimit from "../middleware/RateLimiting.js";

const router=Router();


//logged in users
router.route("/").get(jwtVerify, ratelimit.readLimiter(), getNotification);
router.route("/:notification_id/read").patch(jwtVerify, ratelimit.writeLimiter(), markRead);
router.route("/all/read-all").patch(jwtVerify, ratelimit.writeLimiter(), markReadAll);

export default router;