import dotenv from "dotenv";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { DB_NAME } from "../src/constants.js";
import { User } from "../src/models/User.model.js";
import { Page } from "../src/models/Page.model.js";
import { Post } from "../src/models/post.model.js";
import { Comment } from "../src/models/Comment.model.js";
import { JoinRequest } from "../src/models/Joinrequest.model.js";
import { Notification } from "../src/models/Notification.model.js";

dotenv.config({ quiet: true });

const VERSION = "nexora-human-test-seed-v2";
const LEGACY_USERS = [
  ["naruto@nexora.test", "naruto_u"],
  ["sakura@nexora.test", "sakura_h"],
  ["luffy@nexora.test", "luffy_d"],
  ["zoro@nexora.test", "zoro_r"],
  ["light@nexora.test", "light_y"],
  ["mikasa@nexora.test", "mikasa_a"],
  ["tanjiro@nexora.test", "tanjiro_k"],
  ["gojo@nexora.test", "gojo_s"],
  ["deku@nexora.test", "deku_m"],
  ["edward@nexora.test", "edward_e"],
];
const LEGACY_PAGES = [
  "Hidden Leaf Study Circle",
  "Straw Hat Coders",
  "Alchemists' Lab",
  "Demon Slayer Fitness Club",
  "Soul Society Book Club",
];

const hashId = (kind, key, namespace = VERSION) => {
  const hex = createHash("sha256").update(`${namespace}:${kind}:${key}`).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
};
const ask = async (prompt) => {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    return (await readline.question(prompt)).trim();
  } finally {
    readline.close();
  }
};

const main = async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Seed scripts are disabled in production.");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured.");
  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
  console.log(`Connected database: ${mongoose.connection.name}`);
  if (mongoose.connection.name !== DB_NAME) throw new Error(`Refusing to unseed unexpected database "${mongoose.connection.name}".`);
  if ((await ask("Confirm this is your development database, not production. Type YES to remove identifiable seed data: ")) !== "YES") {
    console.log("Unseed cancelled; no records deleted.");
    return;
  }

  const currentUserIds = Array.from({ length: 35 }, (_, index) => hashId("user", index));
  const currentPageIds = Array.from({ length: 8 }, (_, index) => hashId("page", index));
  const currentPostIds = Array.from({ length: 120 }, (_, index) => hashId("post", index));
  const legacyUserDocs = await User.find({
    $or: LEGACY_USERS.map(([email, username]) => ({ email, username })),
    _id: { $nin: currentUserIds },
  }).select("_id email username");
  const userIds = [...currentUserIds, ...legacyUserDocs.map((user) => user._id)];
  const legacyPageDocs = await Page.find({
    pageName: { $in: LEGACY_PAGES },
    owner: { $in: userIds },
    _id: { $nin: currentPageIds },
  }).select("_id pageName");
  const pageIds = [...currentPageIds, ...legacyPageDocs.map((page) => page._id)];

  const legacyPosts = await Post.find({
    owner: { $in: userIds },
    pages: { $in: legacyPageDocs.map((page) => page._id) },
  }).select("_id");
  const postIds = [...currentPostIds, ...legacyPosts.map((post) => post._id)];
  const commentIds = (await Comment.find({ post: { $in: postIds } }).distinct("_id"));

  const deleteCounts = {};
  deleteCounts.notifications = (await Notification.deleteMany({
    $or: [
      { post: { $in: postIds } },
      { comment: { $in: commentIds } },
      { page: { $in: pageIds } },
    ],
  })).deletedCount;
  deleteCounts.joinrequests = (await JoinRequest.deleteMany({
    page: { $in: pageIds },
    requestedBy: { $in: userIds },
  })).deletedCount;
  deleteCounts.comments = (await Comment.deleteMany({ _id: { $in: commentIds } })).deletedCount;
  deleteCounts.posts = (await Post.deleteMany({ _id: { $in: postIds } })).deletedCount;
  deleteCounts.pages = (await Page.deleteMany({ _id: { $in: pageIds } })).deletedCount;
  deleteCounts.users = (await User.deleteMany({ _id: { $in: userIds } })).deletedCount;

  console.log("\nRemoved only documents identified by deterministic seed IDs or the exact original fixture users/pages and their content:");
  console.table(Object.entries(deleteCounts).map(([collection, deleted]) => ({ collection, deleted })));
  console.log("No OTP or other unidentifiable records were deleted.");
};

main()
  .catch((error) => {
    const rawMessage = String(error?.message || error);
    const message = process.env.MONGODB_URI ? rawMessage.replaceAll(process.env.MONGODB_URI, "[redacted]") : rawMessage;
    console.error(`Unseed failed (${error?.name || "Error"}): ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
