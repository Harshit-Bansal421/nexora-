import mongoose from "mongoose";
import { connectDB } from "../src/database/connectDB.js";
import { Post } from "../src/models/post.model.js";
import { Comment } from "../src/models/Comment.model.js";

async function runCheck() {
  await connectDB();
  const posts = await Post.find({});
  let violations = 0;
  for (const p of posts) {
    const up = p.upvotes.map(String);
    const down = p.downvotes.map(String);
    const intersect = up.filter(id => down.includes(id));
    if (intersect.length) {
      console.log(`Post ${p._id} has users in both upvotes and downvotes:`, intersect);
      violations++;
    }
  }
  // Check comments for any future downvote array (none currently)
  const comments = await Comment.find({});
  for (const c of comments) {
    // placeholder for future checks
  }
  if (violations === 0) {
    console.log("Integrity check passed: no dual vote violations.");
  } else {
    console.log(`Integrity check found ${violations} violations.`);
  }
  await mongoose.disconnect();
}

runCheck().catch(err => {
  console.error("Integrity check failed:", err);
  process.exit(1);
});
