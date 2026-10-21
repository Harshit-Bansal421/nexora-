export function resolveCommunityMemberCount(community) {
  if (Number.isInteger(community?.membersCount) && community.membersCount >= 0) {
    return community.membersCount;
  }

  if (!Array.isArray(community?.members)) return null;

  const ids = community.members
    .map((member) => member && typeof member === "object" ? member._id : member)
    .filter((id) => id !== undefined && id !== null)
    .map(String);
  return new Set(ids).size;
}
