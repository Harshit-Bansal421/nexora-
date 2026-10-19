/**
 * Step 6: Endpoint curl test using naruto_u cookie. Corrected routes.
 */
import "dotenv/config";
import { execSync } from "child_process";
import fs from "fs";

const BASE = "http://localhost:8000";
const COOKIE_JAR = "cookies.jar";

function curl(method, url, bodyFile = null) {
  const body = bodyFile ? `-d "@${bodyFile}"` : "";
  const ct = bodyFile ? `-H "Content-Type: application/json"` : "";
  const cmd = `curl.exe -s -b ${COOKIE_JAR} -c ${COOKIE_JAR} -X ${method} ${ct} ${body} "${BASE}${url}"`;
  try {
    const out = execSync(cmd, { encoding: "utf8" });
    try { return JSON.parse(out); } catch { return { _raw: out.slice(0, 200) }; }
  } catch (e) {
    return { _error: e.message };
  }
}

function voteFields(item, label) {
  const up = item?.upvoteCount ?? "MISSING";
  const down = item?.downvoteCount ?? "MISSING";
  const uv = JSON.stringify(item?.userVote ?? "MISSING");
  return `  ${label}: upvoteCount=${up}, downvoteCount=${down}, userVote=${uv}`;
}

let firstPostId = null;
let firstCommentId = null;
const narutoUsername = "naruto_u";

// Prep vote payload files
fs.writeFileSync("scripts/_v_up.json", JSON.stringify({ vote: "up" }));
fs.writeFileSync("scripts/_v_down.json", JSON.stringify({ vote: "down" }));
fs.writeFileSync("scripts/_v_null.json", JSON.stringify({ vote: null }));

// 1. FEED
console.log("\n=== 1. FEED /api/post/ ===");
const feed = curl("GET", "/api/post/?page=1&limit=3");
const feedPosts = feed?.data?.posts || feed?.data || [];
const fp = Array.isArray(feedPosts) ? feedPosts : [];
if (fp.length) {
  firstPostId = fp[0]._id;
  fp.slice(0, 3).forEach((p, i) => console.log(voteFields(p, `post[${i}]`)));
} else {
  console.log("  statuscode:", feed?.statuscode, "message:", feed?.message);
  console.log("  data type:", typeof feed?.data, "keys:", Object.keys(feed?.data || {}));
}

// 2. POST DETAIL
console.log("\n=== 2. POST DETAIL /api/post/:id ===");
if (firstPostId) {
  const detail = curl("GET", `/api/post/${firstPostId}`);
  const p = detail?.data?.post || detail?.data;
  console.log(voteFields(p, "detail"));
} else {
  // Try to get a post ID directly
  const topicR = curl("GET", "/api/post/topic/Tech?page=1&limit=1");
  const tp = topicR?.data?.posts || [];
  firstPostId = tp[0]?._id;
  console.log("  Using topic post:", firstPostId);
  if (firstPostId) {
    const detail = curl("GET", `/api/post/${firstPostId}`);
    const p = detail?.data?.post || detail?.data;
    console.log(voteFields(p, "detail"));
  }
}

// 3. USER POSTS
console.log("\n=== 3. USER POSTS /api/post/user/:username ===");
const userPosts = curl("GET", `/api/post/user/${narutoUsername}?page=1&limit=2`);
const myPosts = userPosts?.data?.posts || (Array.isArray(userPosts?.data) ? userPosts?.data : []);
if (myPosts.length) {
  myPosts.slice(0, 2).forEach((p, i) => console.log(voteFields(p, `post[${i}]`)));
} else {
  console.log("  statuscode:", userPosts?.statuscode, "message:", userPosts?.message);
}

// 4. SAVED POSTS
console.log("\n=== 4. SAVED POSTS /api/post/saved ===");
const saved = curl("GET", "/api/post/saved?page=1&limit=2");
const savedPosts = saved?.data?.posts || (Array.isArray(saved?.data) ? saved?.data : []);
if (savedPosts.length) {
  savedPosts.slice(0, 2).forEach((p, i) => console.log(voteFields(p, `post[${i}]`)));
} else {
  console.log("  statuscode:", saved?.statuscode, "message:", saved?.message, "(ok if nothing saved)");
}

// 5. SEARCH
console.log("\n=== 5. SEARCH /api/post/search ===");
const search = curl("GET", "/api/post/search?q=calculus&page=1&limit=2");
const searchPosts = search?.data?.posts || (Array.isArray(search?.data) ? search?.data : []);
if (searchPosts.length) {
  searchPosts.slice(0, 2).forEach((p, i) => console.log(voteFields(p, `post[${i}]`)));
} else {
  console.log("  statuscode:", search?.statuscode, "keys:", Object.keys(search?.data || {}));
}

// 6. TOPIC POSTS
console.log("\n=== 6. TOPIC POSTS /api/post/topic/Tech ===");
const topic = curl("GET", "/api/post/topic/Tech?page=1&limit=2");
const topicPosts = topic?.data?.posts || (Array.isArray(topic?.data) ? topic?.data : []);
if (topicPosts.length) {
  if (!firstPostId) firstPostId = topicPosts[0]._id;
  topicPosts.slice(0, 2).forEach((p, i) => console.log(voteFields(p, `post[${i}]`)));
} else {
  console.log("  statuscode:", topic?.statuscode);
}

// 7. COMMUNITY POSTS
console.log("\n=== 7. COMMUNITY POSTS /api/pages/:id/posts ===");
const pagesR = curl("GET", "/api/pages?page=1&limit=1");
const pagesArr = pagesR?.data?.pages || (Array.isArray(pagesR?.data) ? pagesR?.data : []);
const firstPage = pagesArr[0];
if (firstPage) {
  const cposts = curl("GET", `/api/pages/${firstPage._id}/posts?page=1&limit=2`);
  const cp = cposts?.data?.posts || (Array.isArray(cposts?.data) ? cposts?.data : []);
  console.log(`  Page: ${firstPage.name || firstPage._id}`);
  if (cp.length) {
    if (!firstPostId) firstPostId = cp[0]._id;
    cp.slice(0, 2).forEach((p, i) => console.log(voteFields(p, `post[${i}]`)));
  } else {
    console.log("  statuscode:", cposts?.statuscode, "keys:", Object.keys(cposts?.data || {}));
  }
} else {
  console.log("  No pages found. status:", pagesR?.statuscode);
}

// 8. COMMENTS LIST
console.log("\n=== 8. COMMENTS LIST /api/comment/post/:post_id ===");
if (firstPostId) {
  const comments = curl("GET", `/api/comment/post/${firstPostId}?page=1&limit=3`);
  const commentList = comments?.data?.comments || (Array.isArray(comments?.data) ? comments?.data : []);
  if (commentList.length) {
    firstCommentId = commentList[0]._id;
    commentList.slice(0, 3).forEach((c, i) => console.log(voteFields(c, `comment[${i}]`)));
  } else {
    console.log("  statuscode:", comments?.statuscode, "keys:", Object.keys(comments?.data || {}));
  }
}

// 9. REPLIES
console.log("\n=== 9. REPLIES ===");
if (firstCommentId) {
  // Try common reply routes
  const r1 = curl("GET", `/api/comment/${firstCommentId}/replies?page=1&limit=2`);
  if (r1?.statuscode !== 404) {
    const rep = r1?.data?.replies || r1?.data?.comments || (Array.isArray(r1?.data) ? r1?.data : []);
    rep.slice(0, 2).forEach((r, i) => console.log(voteFields(r, `reply[${i}]`)));
  } else {
    console.log("  /replies route not found (may not exist separately)");
  }
}

// 10. POST VOTE ACTIONS
console.log("\n=== 10. POST VOTE ACTIONS /api/post/:id/vote ===");
if (firstPostId) {
  const up = curl("POST", `/api/post/${firstPostId}/vote`, "scripts/_v_up.json");
  console.log("  vote=up  :", JSON.stringify(up?.data || up));

  const down = curl("POST", `/api/post/${firstPostId}/vote`, "scripts/_v_down.json");
  console.log("  vote=down:", JSON.stringify(down?.data || down));

  const nul = curl("POST", `/api/post/${firstPostId}/vote`, "scripts/_v_null.json");
  console.log("  vote=null:", JSON.stringify(nul?.data || nul));
}

// 11. COMMENT VOTE ACTIONS
console.log("\n=== 11. COMMENT VOTE ACTIONS /api/comment/:id/vote ===");
if (firstCommentId) {
  const up = curl("POST", `/api/comment/${firstCommentId}/vote`, "scripts/_v_up.json");
  console.log("  vote=up  :", JSON.stringify(up?.data || up));

  const down = curl("POST", `/api/comment/${firstCommentId}/vote`, "scripts/_v_down.json");
  console.log("  vote=down:", JSON.stringify(down?.data || down));

  const nul = curl("POST", `/api/comment/${firstCommentId}/vote`, "scripts/_v_null.json");
  console.log("  vote=null:", JSON.stringify(nul?.data || nul));
}

// 12. OLD UPVOTE ROUTE — must be 404
console.log("\n=== 12. OLD /upvote ROUTE — must be 404 ===");
if (firstCommentId) {
  const old = curl("POST", `/api/comment/${firstCommentId}/upvote`);
  const code = old?.statuscode || old?.status;
  console.log(`  statuscode=${code}, message="${old?.message}"`);
  console.log(`  => 404? ${code === 404 ? "YES ✓" : "NO ✗ (FAIL)"}`);
}

// Cleanup
["scripts/_v_up.json","scripts/_v_down.json","scripts/_v_null.json"].forEach(f => { try { fs.unlinkSync(f); } catch {} });
console.log("\n=== DONE ===");
