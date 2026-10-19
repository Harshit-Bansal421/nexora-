import mongoose from "mongoose";
import connectDB from "../src/database/connectDB.js";
import { User } from "../src/models/User.model.js";
import { Post } from "../src/models/post.model.js";
import { Comment } from "../src/models/Comment.model.js";
import { Page } from "../src/models/Page.model.js";

const runIntegrityChecks = async () => {
  let errors = 0;
  try {
    await connectDB();
    const [posts, comments, users, pages] = await Promise.all([
      Post.find().select("_id upvotes downvotes upvoteCount downvoteCount"),
      Comment.find().select("_id upvotes downvotes upvoteCount downvoteCount"),
      User.find().select("_id followers following"),
      Page.find().select("_id owner members moderators"),
    ]);
    const mismatch = (label, count) => {
      console.log(`[${label}] mismatches: ${count}`);
      errors += count;
    };
    const duplicates = (values = []) => new Set(values.map(String)).size !== values.length;

    let dualVotes = 0;
    let voteCountMismatch = 0;
    for (const item of [...posts, ...comments]) {
      const up = new Set((item.upvotes || []).map(String));
      dualVotes += (item.downvotes || []).filter((id) => up.has(String(id))).length;
      if (item.upvoteCount !== (item.upvotes?.length || 0) || item.downvoteCount !== (item.downvotes?.length || 0)) {
        voteCountMismatch++;
      }
    }
    mismatch("Check 1: no dual votes", dualVotes);
    mismatch("Check 2: vote counts equal array lengths", voteCountMismatch);

    let duplicateIds = 0;
    for (const item of [...posts, ...comments]) {
      if (duplicates(item.upvotes) || duplicates(item.downvotes)) duplicateIds++;
    }
    for (const user of users) {
      if (duplicates(user.followers) || duplicates(user.following)) duplicateIds++;
    }
    for (const page of pages) {
      if (duplicates(page.members) || duplicates(page.moderators)) duplicateIds++;
    }
    mismatch("Check 3: no duplicate IDs", duplicateIds);

    const userMap = new Map(users.map((user) => [String(user._id), {
      followers: new Set((user.followers || []).map(String)),
      following: new Set((user.following || []).map(String)),
    }]));
    let followMismatches = 0;
    for (const [userId, edges] of userMap) {
      for (const followerId of edges.followers) {
        if (!userMap.get(followerId)?.following.has(userId)) followMismatches++;
      }
      for (const followingId of edges.following) {
        if (!userMap.get(followingId)?.followers.has(userId)) followMismatches++;
      }
    }
    mismatch("Check 4: follower/following relationships are symmetric", followMismatches);

    let memberCountMismatch = 0;
    let moderatorMemberMismatch = 0;
    let ownerRoleMismatch = 0;
    for (const page of pages) {
      const members = new Set((page.members || []).map(String));
      const moderators = new Set((page.moderators || []).map(String));
      if (page.membersCount !== (page.members || []).length) memberCountMismatch++;
      for (const moderator of moderators) {
        if (!members.has(moderator)) moderatorMemberMismatch++;
      }
      if (page.owner && (!members.has(String(page.owner)) || !moderators.has(String(page.owner)))) {
        ownerRoleMismatch++;
      }
    }
    mismatch("Check 5: member counts match member arrays", memberCountMismatch);
    mismatch("Check 6: every moderator is also a member", moderatorMemberMismatch);
    mismatch("Check 7: owner remains a member and moderator", ownerRoleMismatch);
    console.log("Note: Page has no removed-users list; owner exclusion is enforced by the removal endpoint.");
    console.log(`Total mismatches: ${errors}`);
    process.exitCode = errors ? 1 : 0;
  } catch (error) {
    console.error("Integrity check failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

runIntegrityChecks();
