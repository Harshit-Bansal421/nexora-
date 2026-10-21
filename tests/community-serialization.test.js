import assert from "node:assert/strict";
import { accessSync } from "node:fs";
import test from "node:test";
import {
  createCommunityListResponse,
  uniqueMemberCount,
} from "../src/utils/communitySerialization.js";

process.env.CLOUDINARY_NAME ??= "test-cloud";
const [{ getPages }, { Page }] = await Promise.all([
  import("../src/controllers/page.controller.js"),
  import("../src/models/Page.model.js"),
]);

test("getPages returns the cover and member count in its actual API response", async (context) => {
  const page = {
    _id: "page-1",
    owner: { username: "owner", profileImage: "/seed/avatars/owner.svg" },
    pageName: "Illuminati Theatre",
    pageDescription: "A community for theatre members.",
    pageProfileImage: "/seed/icons/illuminati.svg",
    pageCoverImage: "/seed/covers/illuminati.svg",
    title: ["Theatre"],
    type: "open",
    members: ["member-1", "member-2", "member-1"],
  };
  const query = {
    sort() { return this; },
    populate() { return this; },
    select(fields) { assert.equal(fields, "-moderators"); return this; },
    skip() { return this; },
    limit() { return Promise.resolve([page]); },
  };
  context.mock.method(Page, "find", () => query);
  context.mock.method(Page, "countDocuments", async () => 1);

  const response = await new Promise((resolve, reject) => {
    getPages(
      { query: { page: "1", limit: "30" }, user: null },
      {
        status(code) { this.statuscode = code; return this; },
        json(body) { resolve({ statuscode: this.statuscode, body }); },
      },
      reject,
    );
  });

  assert.equal(response.statuscode, 200);
  assert.equal(response.body.data.pages[0].pageCoverImage, "/seed/covers/illuminati.svg");
  assert.equal(response.body.data.pages[0].membersCount, 2);
});

test("community list API response includes cover URLs and unique member counts", () => {
  const response = createCommunityListResponse([{
    _id: "page-1",
    owner: { username: "owner", profileImage: "/seed/avatars/owner.svg" },
    pageName: "Illuminati Theatre",
    pageDescription: "A community for theatre members.",
    pageProfileImage: "/seed/icons/illuminati.svg",
    pageCoverImage: "/seed/covers/illuminati.svg",
    title: ["Theatre"],
    type: "open",
    members: ["member-1", "member-2", "member-1"],
    moderators: ["member-2"],
  }], { total: 1, page: 1, limit: 30, totalPages: 1, hasNextPage: false });

  assert.equal(response.statuscode, 200);
  assert.equal(response.message, "Pages retrieved successfully");
  assert.equal(response.data.pages.length, 1);
  assert.deepEqual(response.data.pagination, {
    total: 1,
    page: 1,
    limit: 30,
    totalPages: 1,
    hasNextPage: false,
  });
  const [page] = response.data.pages;
  assert.equal(page.pageCoverImage, "/seed/covers/illuminati.svg");
  assert.doesNotThrow(() =>
    accessSync(
      new URL(`../frontend/public${page.pageCoverImage}`, import.meta.url),
    ),
  );
  assert.equal(page.membersCount, 2);
  assert.equal("members" in page, false);
});

test("member counting handles populated objects, plain IDs, and empty data", () => {
  assert.equal(
    uniqueMemberCount([
      "member-1",
      { _id: "member-1", username: "one" },
      { _id: "member-2", username: "two" },
    ]),
    2,
  );
  assert.equal(uniqueMemberCount(undefined), 0);
  assert.equal(uniqueMemberCount([]), 0);
});
