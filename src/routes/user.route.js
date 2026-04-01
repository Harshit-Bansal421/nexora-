import { Router } from "express";
import ApiResponse from "../utils/ApiResponse.js";
import ratelimit from "../middleware/RateLimiting.js";

const router=Router();

router.route("/login").get(ratelimit.authLimiter(),(req,res)=>{
  res.status(201).json(
    new ApiResponse(201)
  )
})

export default router;