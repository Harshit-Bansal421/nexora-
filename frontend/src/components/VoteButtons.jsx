import React, { useState } from "react";

const countValue = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

export default function VoteButtons({
  upvoteCount = 0,
  downvoteCount = 0,
  userVote = null,
  onVote,
  onError,
  className = "",
}) {
  const normalizedUpvotes = countValue(upvoteCount);
  const normalizedDownvotes = countValue(downvoteCount);
  const normalizedUserVote = userVote === "up" || userVote === "down" ? userVote : null;
  const propStateKey = `${normalizedUpvotes}:${normalizedDownvotes}:${normalizedUserVote || "none"}`;
  const [localState, setLocalState] = useState(null);
  const stateIsCurrent = localState?.propStateKey === propStateKey;
  const counts = stateIsCurrent
    ? localState.counts
    : { up: normalizedUpvotes, down: normalizedDownvotes };
  const vote = stateIsCurrent ? localState.vote : normalizedUserVote;
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (target) => {
    if (isVoting || !onVote) return;
    const previous = { counts, vote };
    const requestStateKey = propStateKey;
    const nextVote = vote === target ? null : target;
    const nextCounts = { ...counts };
    if (vote) nextCounts[vote] = Math.max(0, nextCounts[vote] - 1);
    if (nextVote) nextCounts[nextVote] += 1;
    setIsVoting(true);
    setLocalState({ propStateKey: requestStateKey, counts: nextCounts, vote: nextVote });
    try {
      const response = await onVote(target);
      const data = response?.data || response || {};
      setLocalState({
        propStateKey: requestStateKey,
        counts: {
          up: countValue(data.upvoteCount ?? data.upvotesCount ?? nextCounts.up),
          down: countValue(data.downvoteCount ?? data.downvotesCount ?? nextCounts.down),
        },
        vote: data.userVote === "up" || data.userVote === "down" ? data.userVote : null,
      });
    } catch (error) {
      setLocalState({ propStateKey: requestStateKey, ...previous });
      onError?.(error);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button type="button" disabled={isVoting} onClick={() => handleVote("up")} title="Like" aria-label={`Like, ${counts.up}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors disabled:opacity-60 ${vote === "up" ? "text-blue-600" : "text-on-surface-variant hover:text-blue-600"}`}>
        <span className={`material-symbols-outlined text-base ${vote === "up" ? "filled" : ""}`}>thumb_up</span>
        <span className="text-xs font-bold">{counts.up}</span>
      </button>
      <button type="button" disabled={isVoting} onClick={() => handleVote("down")} title="Dislike" aria-label={`Dislike, ${counts.down}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors disabled:opacity-60 ${vote === "down" ? "text-red-600" : "text-on-surface-variant hover:text-red-600"}`}>
        <span className={`material-symbols-outlined text-base ${vote === "down" ? "filled" : ""}`}>thumb_down</span>
        <span className="text-xs font-bold">{counts.down}</span>
      </button>
    </div>
  );
}
