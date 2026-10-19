import ApiError from "./ApiError.js";
import { Page } from "../models/Page.model.js";
import { Post } from "../models/post.model.js";

export const postVisibilityStagesForUser = (userId) => {
  const inaccessiblePageStages = [{ $match: { type: "private" } }];
  if (userId) {
    inaccessiblePageStages.push({
      $match: {
        $expr: {
          $not: {
            $or: [
              { $eq: ["$owner", userId] },
              { $in: [userId, { $ifNull: ["$members", []] }] },
              { $in: [userId, { $ifNull: ["$moderators", []] }] },
            ],
          },
        },
      },
    });
  }
  inaccessiblePageStages.push({ $project: { _id: 1 } });

  return [
    {
      $lookup: {
        from: "pages",
        localField: "pages",
        foreignField: "_id",
        pipeline: inaccessiblePageStages,
        as: "_inaccessiblePrivatePages",
      },
    },
    {
      $match: {
        $expr: {
          $eq: [{ $size: { $ifNull: ["$_inaccessiblePrivatePages", []] } }, 0],
        },
      },
    },
    { $unset: "_inaccessiblePrivatePages" },
  ];
};

export const publicPostVisibilityStages = () =>
  postVisibilityStagesForUser(null);

export const assertPostAccess = async (postId, userId) => {
  const post = await Post.findById(postId).select("_id owner pages");
  if (!post) throw new ApiError(404, "Post not found");
  const privatePages = await Page.find({
    _id: { $in: post.pages },
    type: "private",
  }).select("owner members moderators");

  const hasAccess = privatePages.every(
    (page) =>
      userId &&
      (page.owner.equals(userId) ||
        page.members.some((member) => member.equals(userId)) ||
        page.moderators.some((moderator) => moderator.equals(userId))),
  );
  if (!hasAccess) throw new ApiError(404, "Post not found");
  return post;
};
