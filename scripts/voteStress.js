import "dotenv/config";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Post } from "../src/models/post.model.js";
import { User } from "../src/models/User.model.js";
import { execSync } from "child_process";

function getVotePipeline(targetVote, userId) {
  return [
    {
      $set: {
        upvotes: {
          $cond: [
            { $eq: [targetVote, "up"] },
            { $setUnion: [{ $ifNull: ["$upvotes", []] }, [userId]] },
            { $setDifference: [{ $ifNull: ["$upvotes", []] }, [userId]] },
          ],
        },
        downvotes: {
          $cond: [
            { $eq: [targetVote, "down"] },
            { $setUnion: [{ $ifNull: ["$downvotes", []] }, [userId]] },
            { $setDifference: [{ $ifNull: ["$downvotes", []] }, [userId]] },
          ],
        },
      },
    },
    {
      $set: {
        upvoteCount: { $size: "$upvotes" },
        downvoteCount: { $size: "$downvotes" },
      },
    },
  ];
}

async function runStressTest() {
  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
  console.log("=== VOTE STRESS TEST STARTED ===");

  // Find or create test author
  let testAuthor = await User.findOne({ username: "naruto_u" });
  if (!testAuthor) {
    testAuthor = await User.findOne();
  }

  // Create isolated stress test post
  const testPost = await Post.create({
    owner: testAuthor._id,
    title: "Stress Test Post " + Date.now(),
    topic: "Tech",
    description: "Post created strictly for atomic vote stress testing",
    upvotes: [],
    downvotes: [],
    upvoteCount: 0,
    downvoteCount: 0,
  });
  console.log(`Created test post: ${testPost._id}`);

  try {
    // ------------------------------------------------------------------------
    // TEST (a): 50 users vote UP simultaneously
    // ------------------------------------------------------------------------
    console.log("\n--- TEST (a): 50 users vote UP simultaneously ---");
    const testUsers50 = Array.from({ length: 50 }, () => new mongoose.Types.ObjectId());
    const upPromises = testUsers50.map((uId) =>
      Post.findOneAndUpdate(
        { _id: testPost._id },
        getVotePipeline("up", uId),
        { returnDocument: 'after', updatePipeline: true }
      )
    );
    await Promise.all(upPromises);

    const postAfterA = await Post.findById(testPost._id);
    const expectedA = { upvoteCount: 50, downvoteCount: 0 };
    const actualA = { upvoteCount: postAfterA.upvoteCount, downvoteCount: postAfterA.downvoteCount };

    console.log(`Expected: upvoteCount=${expectedA.upvoteCount}, downvoteCount=${expectedA.downvoteCount}`);
    console.log(`Actual:   upvoteCount=${actualA.upvoteCount}, downvoteCount=${actualA.downvoteCount}`);
    console.log(`Real array lengths: upvotes=${postAfterA.upvotes.length}, downvotes=${postAfterA.downvotes.length}`);

    if (
      actualA.upvoteCount !== expectedA.upvoteCount ||
      actualA.downvoteCount !== expectedA.downvoteCount ||
      postAfterA.upvotes.length !== 50 ||
      postAfterA.downvotes.length !== 0
    ) {
      throw new Error("TEST (a) FAILED!");
    }
    console.log(">>> TEST (a) PASSED!");

    // ------------------------------------------------------------------------
    // TEST (b): One user fires 20 mixed up/down/null requests in parallel
    // ------------------------------------------------------------------------
    console.log("\n--- TEST (b): One user fires 20 mixed up/down/null requests in parallel ---");
    const singleUser = new mongoose.Types.ObjectId();
    const mixedVotes = [
      "up", "down", null, "up", "up", "null", "down", "up", null, "down",
      "down", "up", null, "down", "up", "down", null, "up", "down", "up"
    ].map(v => v === "null" ? null : v);

    const mixedPromises = mixedVotes.map((v) =>
      Post.findOneAndUpdate(
        { _id: testPost._id },
        getVotePipeline(v, singleUser),
        { returnDocument: 'after', updatePipeline: true }
      )
    );
    await Promise.all(mixedPromises);

    const postAfterB = await Post.findById(testPost._id);
    const inUpvotes = postAfterB.upvotes.some((id) => id.toString() === singleUser.toString());
    const inDownvotes = postAfterB.downvotes.some((id) => id.toString() === singleUser.toString());

    console.log(`Single user state after 20 parallel requests: inUpvotes=${inUpvotes}, inDownvotes=${inDownvotes}`);
    console.log(`Post totals: upvoteCount=${postAfterB.upvoteCount}, downvoteCount=${postAfterB.downvoteCount}`);
    console.log(`Array lengths: upvotes=${postAfterB.upvotes.length}, downvotes=${postAfterB.downvotes.length}`);

    if (inUpvotes && inDownvotes) {
      throw new Error("TEST (b) FAILED: User was found in BOTH upvotes and downvotes!");
    }
    if (
      postAfterB.upvoteCount !== postAfterB.upvotes.length ||
      postAfterB.downvoteCount !== postAfterB.downvotes.length
    ) {
      throw new Error("TEST (b) FAILED: Counts do not match array lengths!");
    }
    console.log(">>> TEST (b) PASSED! (User is in at most one array, counts exact)");

    // Re-clean singleUser from post before (c)
    await Post.findOneAndUpdate(
      { _id: testPost._id },
      getVotePipeline(null, singleUser),
      { returnDocument: 'after', updatePipeline: true }
    );

    // ------------------------------------------------------------------------
    // TEST (c): 50 users switch UP -> DOWN in parallel
    // ------------------------------------------------------------------------
    console.log("\n--- TEST (c): 50 users switch UP -> DOWN in parallel ---");
    const switchPromises = testUsers50.map((uId) =>
      Post.findOneAndUpdate(
        { _id: testPost._id },
        getVotePipeline("down", uId),
        { returnDocument: 'after', updatePipeline: true }
      )
    );
    await Promise.all(switchPromises);

    const postAfterC = await Post.findById(testPost._id);
    const expectedC = { upvoteCount: 0, downvoteCount: 50 };
    const actualC = { upvoteCount: postAfterC.upvoteCount, downvoteCount: postAfterC.downvoteCount };

    console.log(`Expected: upvoteCount=${expectedC.upvoteCount}, downvoteCount=${expectedC.downvoteCount}`);
    console.log(`Actual:   upvoteCount=${actualC.upvoteCount}, downvoteCount=${actualC.downvoteCount}`);
    console.log(`Real array lengths: upvotes=${postAfterC.upvotes.length}, downvotes=${postAfterC.downvotes.length}`);

    // Check no user is in both
    const upSetC = new Set(postAfterC.upvotes.map(String));
    const overlaps = postAfterC.downvotes.filter(d => upSetC.has(String(d)));
    if (overlaps.length > 0) {
      throw new Error(`TEST (c) FAILED: Overlapping users found: ${overlaps.length}`);
    }

    if (
      actualC.upvoteCount !== expectedC.upvoteCount ||
      actualC.downvoteCount !== expectedC.downvoteCount ||
      postAfterC.upvotes.length !== 0 ||
      postAfterC.downvotes.length !== 50
    ) {
      throw new Error("TEST (c) FAILED!");
    }
    console.log(">>> TEST (c) PASSED!");

  } finally {
    // Clean up test post
    await Post.findByIdAndDelete(testPost._id);
    console.log(`\nCleaned up stress test post: ${testPost._id}`);
    await mongoose.disconnect();
  }

  // ------------------------------------------------------------------------
  // RUN INTEGRITY CHECKER
  // ------------------------------------------------------------------------
  console.log("\n--- RUNNING INTEGRITY CHECKER POST-STRESS ---");
  const checkerOutput = execSync("node scripts/integrityChecker.js", { encoding: "utf8" });
  console.log(checkerOutput);
  console.log("=== VOTE STRESS TEST COMPLETE ===");
}

runStressTest().catch((err) => {
  console.error("Stress test failed:", err);
  process.exit(1);
});
