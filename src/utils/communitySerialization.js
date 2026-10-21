import ApiResponse from "./ApiResponse.js";

export const uniqueMemberCount = (members = []) =>
  new Set(
    (Array.isArray(members) ? members : [])
      .map((member) => String(member?._id ?? member))
      .filter((id) => id !== "undefined" && id !== "null"),
  ).size;

export const serializeCommunityCard = (page) => ({
  _id: page._id,
  owner: {
    username: page.owner?.username,
    profileImage: page.owner?.profileImage,
  },
  pageProfileImage: page.pageProfileImage,
  pageCoverImage: page.pageCoverImage,
  pageName: page.pageName,
  pageDescription: page.pageDescription,
  title: page.title,
  type: page.type,
  membersCount: uniqueMemberCount(page.members),
});

export const createCommunityListResponse = (pages, pagination) =>
  new ApiResponse(
    200,
    { pages: pages.map(serializeCommunityCard), pagination },
    "Pages retrieved successfully",
  );
