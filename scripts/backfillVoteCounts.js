import "dotenv/config";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Post } from "../src/models/post.model.js";
import { Comment } from "../src/models/Comment.model.js";

async function backfill() {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log("Connected to MongoDB database:", DB_NAME);

    const postUpdateResult = await Post.collection.updateMany({}, [
      {
        $set: {
          upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
          downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
        },
      },
    ]);
    console.log(`Posts backfilled: matched ${postUpdateResult.matchedCount}, modified ${postUpdateResult.modifiedCount}`);

    const commentUpdateResult = await Comment.collection.updateMany({}, [
      {
        $set: {
          upvoteCount: { $size: { $ifNull: ["$upvotes", []] } },
          downvoteCount: { $size: { $ifNull: ["$downvotes", []] } },
        },
      },
    ]);
    console.log(`Comments backfilled: matched ${commentUpdateResult.matchedCount}, modified ${commentUpdateResult.modifiedCount}`);

    // Verify sample post & comment
    const samplePost = await Post.findOne().select("title upvoteCount downvoteCount upvotes downvotes");
    console.log("Sample post verification:", {
      title: samplePost?.title,
      upvoteCount: samplePost?.upvoteCount,
      realUpvotesLength: samplePost?.upvotes?.length,
      downvoteCount: samplePost?.downvoteCount,
      realDownvotesLength: samplePost?.downvotes?.length,
    });

    const sampleComment = await Comment.findOne().select("body upvoteCount downvoteCount upvotes downvotes");
    console.log("Sample comment verification:", {
      body: sampleComment?.body?.slice(0, 30),
      upvoteCount: sampleComment?.upvoteCount,
      realUpvotesLength: sampleComment?.upvotes?.length,
      downvoteCount: sampleComment?.downvoteCount,
      realDownvotesLength: sampleComment?.downvotes?.length,
    });
  } catch (err) {
    console.error("Backfill error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

backfill();
