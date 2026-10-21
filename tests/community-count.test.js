import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommunityMemberCount } from "../frontend/src/utils/communityData.js";

test("community member count keeps a legitimate zero", () => {
  assert.equal(resolveCommunityMemberCount({ membersCount: 0 }), 0);
});

test("community member count deduplicates plain IDs and populated members", () => {
  assert.equal(resolveCommunityMemberCount({
    members: ["one", { _id: "one", username: "one" }, { _id: "two" }],
  }), 2);
});

test("community member count stays unavailable when its source is omitted", () => {
  assert.equal(resolveCommunityMemberCount({}), null);
  assert.equal(resolveCommunityMemberCount({ membersCount: null }), null);
});
