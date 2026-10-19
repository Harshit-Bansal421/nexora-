import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import { postApi } from "../api/client";
import Avatar from "./Avatar";
import ImageWithFallback from "./ImageWithFallback";
import VoteButtons from "./VoteButtons";
import { getSocket, joinPostRoom, leavePostRoom } from "../api/socket";

export default function PostCard({ post, onUnsave }) {
  const { currentUser, isAuthenticated } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  // Normalize author data
  const author = post?.author ||
    post?.ownerInfo ||
    post?.owner || {
      username: "anonymous",
      title: "Contributor",
    };

  const initialUpvotes = Array.isArray(post?.upvotes) ? post.upvotes.length : (post?.upvotesCount ?? post?.upvoteCount ?? 0);
  const initialDownvotes = Array.isArray(post?.downvotes) ? post.downvotes.length : (post?.downvotesCount ?? post?.downvoteCount ?? 0);
  const initialUserVote = post?.userVote ?? (post?.upvotes?.some((id) => String(id) === String(currentUser?._id)) ? "up" : post?.downvotes?.some((id) => String(id) === String(currentUser?._id)) ? "down" : null);
  const [livePostState, setLivePostState] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !post?._id) return;
    const socket = getSocket();
    const postId = String(post._id);
    joinPostRoom(postId);
    const handleVoteUpdate = (update) => {
      if (String(update?.postId) !== postId) return;
      setLivePostState((previous) => ({
        ...(String(previous?.postId) === postId ? previous : {}),
        postId,
        upvoteCount: update.upvoteCount,
        downvoteCount: update.downvoteCount,
        ...(String(update.voterId) === String(currentUser?._id)
          ? { userVote: update.userVote }
          : {}),
      }));
    };
    const handleCommentCount = (update) => {
      if (String(update?.postId) !== postId) return;
      setLivePostState((previous) => ({
        ...(String(previous?.postId) === postId ? previous : {}),
        postId,
        commentsCount: update.commentsCount,
      }));
    };
    socket.on("reacted-post", handleVoteUpdate);
    socket.on("comment-count-updated", handleCommentCount);
    return () => {
      socket.off("reacted-post", handleVoteUpdate);
      socket.off("comment-count-updated", handleCommentCount);
      leavePostRoom(postId);
    };
  }, [post?._id, isAuthenticated, currentUser?._id]);

  const postLiveState = String(livePostState?.postId) === String(post?._id)
    ? livePostState
    : null;
  const displayedUpvotes = postLiveState?.upvoteCount ?? initialUpvotes;
  const displayedDownvotes = postLiveState?.downvoteCount ?? initialDownvotes;
  const displayedUserVote = postLiveState && Object.prototype.hasOwnProperty.call(postLiveState, "userVote")
    ? postLiveState.userVote
    : initialUserVote;
  const displayedCommentsCount = postLiveState?.commentsCount ?? post?.commentsCount ?? post?.comments?.length ?? 0;

  const votePost = async (vote) => {
    if (!isAuthenticated) {
      info("Please log in to vote on posts");
      navigate("/login");
      throw new Error("Login required");
    }
    return postApi.votePost(post._id, vote);
  };
  const [isSaved, setIsSaved] = useState(
    Boolean(post?.isSaved || post?.savedPost || typeof onUnsave === "function"),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleSaveToggle = async () => {
    if (!isAuthenticated) {
      info("Please log in to save posts");
      navigate("/login");
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    try {
      if (nextSaved) {
        await postApi.savePost(post._id);
        success("Post saved to your bookmarks");
      } else {
        await postApi.unsavePost(post._id);
        onUnsave?.(post._id);
        info("Post removed from saved bookmarks");
      }
    } catch (err) {
      setIsSaved(!nextSaved);
      console.warn("Post bookmark update failed:", err);
      error("Failed to update bookmark");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    const postUrl = `${window.location.origin}/posts/${post._id}/comments`;
    try {
      await navigator.clipboard.writeText(postUrl);
      success("Post link copied to clipboard!");
    } catch (err) {
      console.warn("Unable to copy post link:", err);
      error(
        "Could not copy the post link. Check clipboard permissions and try again.",
      );
    }
  };

  // Format timestamp
  const formatTime = (dateStr) => {
    if (!dateStr) return "Just now";
    const diffHours = Math.round(
      (now - Date.parse(dateStr)) / (1000 * 60 * 60),
    );
    if (diffHours < 1) {
      const diffMins = Math.max(
        1,
        Math.round((now - Date.parse(dateStr)) / (1000 * 60)),
      );
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const images = post?.postImage || post?.PostImages || post?.images || [];
  const videos = post?.postVideo || post?.PostVideos || post?.videos || [];

  return (
    <article className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-stitch-soft border border-outline-variant/15 hover:shadow-stitch-ambient transition-all duration-300">
      <div className="p-5 sm:p-6">
        {/* Post Header */}
        <header className="flex items-start justify-between gap-3 mb-4">
          <Link
            to={`/profile/${author?.username}`}
            className="flex items-center gap-3 group"
          >
            <Avatar
              src={author?.profileImage}
              name={author?.username || "anonymous"}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-primary-container/30 group-hover:ring-primary transition-all"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-on-surface text-sm group-hover:text-primary transition-colors">
                  {author?.username}
                </h3>
                {author?.title && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary-container/40 text-secondary">
                    {author.title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span>{formatTime(post?.createdAt)}</span>
                <span>•</span>
                <span className="text-primary font-medium">
                  in {post?.topic || "General"}
                </span>
              </div>
            </div>
          </Link>

          {/* Topic Badge */}
          {post?.topic && (
            <span className="px-3 py-1 rounded-full bg-surface-container text-on-primary-fixed-variant text-xs font-semibold">
              #{post.topic}
            </span>
          )}
        </header>

        {/* Post Title & Description */}
        <div className="space-y-2 mb-4">
          <Link to={`/posts/${post?._id}/comments`} state={{ post }}>
            <h2 className="text-lg sm:text-xl font-bold font-headline leading-snug text-on-surface hover:text-primary transition-colors">
              {post?.title}
            </h2>
          </Link>
          <p className="text-on-surface/90 text-sm leading-relaxed whitespace-pre-line line-clamp-4">
            {post?.description}
          </p>
        </div>

        {/* Multi-Image Gallery */}
        {images.length > 0 && (
          <div
            className={`mb-4 rounded-xl overflow-hidden gap-2 ${
              images.length === 1
                ? "block"
                : images.length === 2
                  ? "grid grid-cols-2"
                  : "grid grid-cols-3"
            }`}
          >
            {images.slice(0, 3).map((imgUrl, idx) => (
              <div
                key={idx}
                className="relative aspect-video max-h-72 bg-surface-container overflow-hidden rounded-lg group"
              >
                <ImageWithFallback
                  src={imgUrl}
                  alt={`Post image ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        )}

        {/* Video Player */}
        {videos.length > 0 && (
          <div className="mb-4 rounded-xl overflow-hidden bg-black max-h-80 flex items-center justify-center">
            <video
              src={videos[0]}
              controls
              className="max-h-80 w-full rounded-xl"
            />
          </div>
        )}
      </div>

      {/* Post Action Footer */}
      <footer className="bg-surface-container-low/50 px-5 sm:px-6 py-3 flex items-center justify-between border-t border-outline-variant/10 text-on-surface-variant">
        <div className="flex items-center gap-4 sm:gap-6">
          <VoteButtons upvoteCount={displayedUpvotes} downvoteCount={displayedDownvotes} userVote={displayedUserVote} onVote={votePost} onError={(err) => { if (err?.message !== "Login required") { console.warn("Post vote failed:", err); error(err?.message || "Failed to register vote"); } }} className="bg-surface-container-lowest rounded-full border border-outline-variant/15 shadow-sm" />

          {/* Comment Count / Link */}
          <Link
            to={`/posts/${post?._id}/comments`}
            state={{ post }}
            className="flex items-center gap-1.5 hover:text-primary transition-colors text-xs font-semibold py-1 px-2.5 rounded-full hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-lg">
              chat_bubble
            </span>
            <span>{displayedCommentsCount}</span>
          </Link>
        </div>

        {/* Right Action Icons: Save & Share */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleSaveToggle}
            className={`p-2 rounded-full transition-colors active:scale-90 ${
              isSaved
                ? "text-primary bg-primary-container/30"
                : "hover:text-primary hover:bg-surface-container"
            }`}
            title={isSaved ? "Remove from saved" : "Save post"}
          >
            <span
              className={`material-symbols-outlined text-xl ${isSaved ? "filled" : ""}`}
            >
              bookmark
            </span>
          </button>

          <button
            onClick={handleShare}
            className="p-2 rounded-full hover:text-primary hover:bg-surface-container transition-colors active:scale-90"
            title="Share post"
          >
            <span className="material-symbols-outlined text-xl">share</span>
          </button>
        </div>
      </footer>
    </article>
  );
}
