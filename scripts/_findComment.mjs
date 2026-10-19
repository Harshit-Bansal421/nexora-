import "dotenv/config";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Comment } from "../src/models/Comment.model.js";

await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
const sample = await Comment.findOne().select("_id post postId parentComment body").lean();
console.log("Comment fields:", JSON.stringify({...sample, body: sample?.body?.slice(0,20)}));

// Check what field name is used
const rawDoc = await Comment.collection.findOne({});
console.log("Raw doc keys:", Object.keys(rawDoc || {}));
await mongoose.disconnect();
