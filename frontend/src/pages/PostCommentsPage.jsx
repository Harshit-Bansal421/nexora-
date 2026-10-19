import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import { postApi, commentApi } from "../api/client";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import { joinPostRoom, leavePostRoom, getSocket } from "../api/socket";
import Avatar from "../components/Avatar";
import ImageWithFallback from "../components/ImageWithFallback";
import VoteButtons from "../components/VoteButtons";

export default function PostCommentsPage() {
  const { postId } = useParams();
  const location = useLocation();
  const { currentUser, isAuthenticated } = useAuth();
  const { success, error, info } = useToast();

  const [post, setPost] = useState(location.state?.post || null);
  const [postLoadError, setPostLoadError] = useState("");
  const [postNotFound, setPostNotFound] = useState(false);
  const [comments, setComments] = useState([]);
  const [sortOrder, setSortOrder] = useState("top"); // 'top' | 'newest'
  const [newCommentBody, setNewCommentBody] = useState("");
  const [replyTarget, setReplyTarget] = useState(null); // { id, username }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const getCommentTree = useCallback(
    async function loadCommentTree(order, parentComment = null, depth = 0) {
      const res = await commentApi.getComments(postId, {
        sort: order === "newest" ? "latest" : order,
        page: 1,
        limit: 100,
        ...(parentComment ? { parentComment } : {}),
      });
      const data = res?.data || res || {};
      const rows = Array.isArray(data) ? data : data?.comments || [];
      if (depth >= 4) return rows;

      return Promise.all(
        rows.map(async (comment) => ({
          ...comment,
          replies: comment.replyCount
            ? await loadCommentTree(order, comment._id, depth + 1)
            : [],
        })),
      );
    },
    [postId],
  );

  const fetchComments = async (order = sortOrder) => {
    try {
      setComments(await getCommentTree(order));
    } catch (err) {
      console.warn("Error fetching comments:", err);
      error(err?.message || "Could not load discussion replies.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchPostData = async () => {
      setLoading(true);
      try {
        const [postRes, commentRes] = await Promise.allSettled([
          postApi.getPostById(postId),
          getCommentTree(sortOrder),
        ]);

        if (isMounted) {
          if (postRes.status === "fulfilled") {
            const postData = postRes.value?.data || postRes.value;
            setPost(postData);
            setPostLoadError("");
            setPostNotFound(false);
          } else {
            console.warn("Unable to load post details:", postRes.reason);
            const statusCode =
              postRes.reason?.statuscode || postRes.reason?.status;
            const notFound = statusCode === 404;
            setPostNotFound(notFound);
            setPost(notFound ? null : location.state?.post || null);
            setPostLoadError(
              notFound
                ? "This post was deleted or does not exist."
                : location.state?.post
                  ? "Showing the post from your feed; full post details are temporarily unavailable."
                  : "Could not load this post. Please retry or return to the feed.",
            );
          }
          if (commentRes.status === "fulfilled") {
            setComments(commentRes.value);
          }
        }
      } catch (err) {
        console.warn("Error fetching discussion:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPostData();

    let socket = null;
    if (isAuthenticated) {
      joinPostRoom(postId);
      socket = getSocket();
    }
    const handleNewComment = (comment) => {
      setComments((prev) => [comment, ...prev]);
    };
    const handleVoteUpdate = ({ commentId, upvoteCount, downvoteCount }) => {
      const updateTree = (items) => items.map((comment) => comment._id === commentId
        ? { ...comment, upvoteCount, downvoteCount, replies: updateTree(comment.replies || []) }
        : { ...comment, replies: updateTree(comment.replies || []) });
      setComments(updateTree);
    };

    socket?.on("new-comment", handleNewComment);
    socket?.on("comment-vote-update", handleVoteUpdate);

    return () => {
      isMounted = false;
      if (socket) {
        leavePostRoom(postId);
        socket.off("new-comment", handleNewComment);
        socket.off("comment-vote-update", handleVoteUpdate);
      }
    };
  }, [
    postId,
    sortOrder,
    location.state,
    retryCount,
    getCommentTree,
    isAuthenticated,
  ]);

  const handleSortChange = (newOrder) => {
    setSortOrder(newOrder);
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      info("Please log in to participate in this discussion.");
      return;
    }
    if (!newCommentBody.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        body: newCommentBody.trim(),
        parentComment: replyTarget ? replyTarget.id : null,
      };

      await commentApi.createComment(postId, payload);
      success("Comment posted!");
      setNewCommentBody("");
      setReplyTarget(null);
      fetchComments();
    } catch (err) {
      error(err?.message || "Failed to submit comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentVote = async (commentId, voteType) => {
    if (!isAuthenticated) {
      info("Please log in to vote on comments.");
      throw new Error("Login required");
    }
    const response = await commentApi.voteComment(commentId, voteType);
    const vote = response?.data || response || {};
    const updateTree = (items) => items.map((comment) => comment._id === commentId
      ? { ...comment, upvoteCount: vote.upvoteCount ?? vote.upvotesCount ?? comment.upvoteCount, downvoteCount: vote.downvoteCount ?? vote.downvotesCount ?? comment.downvoteCount, userVote: vote.userVote, replies: updateTree(comment.replies || []) }
      : { ...comment, replies: updateTree(comment.replies || []) });
    setComments(updateTree);
    return response;
  };
  const handleSetStatus = async (commentId, status) => {
    try {
      await commentApi.setCommentStatus(postId, commentId, status);
      success(`Comment marked as ${status}!`);
      fetchComments();
    } catch (err) {
      error(err?.message || `Could not set comment status.`);
    }
  };

  const postOwner = post?.author || post?.owner;
  const isPostOwner =
    currentUser &&
    (postOwner?._id === currentUser._id || postOwner === currentUser._id);
  const renderReplies = (replies = []) =>
    replies.map((reply) => {
      const replyAuthor = reply.author || { username: "peer" };
      return (
        <div
          key={reply._id}
          className="ml-4 sm:ml-8 border-l-2 border-outline-variant/30 pl-3"
        >
          <div className="flex items-center gap-2">
            <Avatar
              src={replyAuthor.profileImage}
              name={replyAuthor.username || "Peer"}
              className="h-7 w-7 rounded-full object-cover"
            />
            <span className="text-xs font-bold text-on-surface">
              {replyAuthor.username}
            </span>
          </div>
          <p className="py-2 pl-9 text-sm text-on-surface whitespace-pre-line">
            {reply.body}
          </p>
          <div className="flex gap-3 pl-9">
            <VoteButtons key={`${reply._id}:${reply.upvoteCount ?? reply.upvotesCount ?? 0}:${reply.downvoteCount ?? reply.downvotesCount ?? 0}:${reply.userVote}`} upvoteCount={reply.upvoteCount ?? reply.upvotesCount ?? reply.upvotes?.length ?? 0} downvoteCount={reply.downvoteCount ?? reply.downvotesCount ?? reply.downvotes?.length ?? 0} userVote={reply.userVote} onVote={(vote) => handleCommentVote(reply._id, vote)} onError={(err) => { if (err?.message !== "Login required") error("Failed to register vote."); }} />
            <button
              type="button"
              onClick={() =>
                setReplyTarget({
                  id: reply._id,
                  username: replyAuthor.username,
                })
              }
              className="min-h-11 text-xs font-semibold text-on-surface-variant hover:text-primary"
            >
              Reply
            </button>
          </div>
          {renderReplies(reply.replies)}
        </div>
      );
    });

  if (loading) {
    return (
      <Layout>
        <div
          className="max-w-3xl mx-auto px-4 py-12 space-y-4"
          role="status"
          aria-label="Loading discussion"
        >
          <div className="h-8 w-40 rounded-xl bg-surface-container animate-pulse" />
          <div className="h-56 rounded-3xl bg-surface-container-low animate-pulse" />
          <div className="h-28 rounded-2xl bg-surface-container-low animate-pulse" />
          <div className="h-28 rounded-2xl bg-surface-container-low animate-pulse" />
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">
            {postNotFound ? "article" : "error"}
          </span>
          <h1 className="mt-3 text-xl font-headline font-bold text-on-surface">
            {postNotFound ? "Post unavailable" : "Could not load this post"}
          </h1>
          <p role="alert" className="mt-2 text-sm text-on-surface-variant">
            {postLoadError}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {!postNotFound && (
              <button
                type="button"
                onClick={() => {
                  setPostLoadError("");
                  setLoading(true);
                  setRetryCount((count) => count + 1);
                }}
                className="min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary"
              >
                Retry
              </button>
            )}
            <Link
              to="/feed"
              className="inline-flex min-h-11 items-center rounded-full border border-outline-variant px-5 text-sm font-semibold text-on-surface"
            >
              Back to Feed
            </Link>
          </div>
        </main>
      </Layout>
    );
  }

  const author = post?.author || post?.owner || null;
  const pinnedComments = comments.filter(
    (c) => c.status === "pinned" || c.status === "helpful",
  );
  const regularComments = comments.filter(
    (c) => c.status !== "pinned" && c.status !== "helpful",
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-28 space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            to="/feed"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              arrow_back
            </span>
            Back to Feed
          </Link>
        </div>

        {/* Original Post Main Card */}
        <article className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 shadow-stitch-soft border border-outline-variant/15 relative overflow-hidden">
          {postLoadError && (
            <p
              role="status"
              className="mb-5 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant"
            >
              {postLoadError}
            </p>
          )}
          <header className="flex items-start justify-between gap-4 mb-5">
            {author?.username ? (
              <Link
                to={`/profile/${author.username}`}
                className="flex items-center gap-3 group"
              >
                <Avatar
                  src={author.profileImage}
                  name={author.username || "Author"}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary transition-all"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-headline font-bold text-base text-on-surface group-hover:text-primary transition-colors">
                      {author.username}
                    </h3>
                    <span className="bg-primary-container/40 text-primary text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">
                      Author
                    </span>
                  </div>
                  <p className="text-on-surface-variant text-xs">
                    Posted in{" "}
                    <span className="text-primary font-semibold">
                      #{post?.topic || "General"}
                    </span>
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-base text-on-surface">
                    Author unavailable
                  </h3>
                  <p className="text-on-surface-variant text-xs">
                    Posted in{" "}
                    <span className="text-primary font-semibold">
                      #{post?.topic || "General"}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </header>

          <h1 className="text-xl sm:text-2xl font-headline font-extrabold text-on-surface mb-3 leading-snug">
            {post?.title || "Post details unavailable"}
          </h1>

          <div className="prose max-w-none text-on-surface-variant text-sm sm:text-base leading-relaxed mb-6 whitespace-pre-line">
            {post?.description}
          </div>

          {/* Media Images */}
          {(post?.postImage || post?.PostImages || []).length > 0 && (
            <div
              className={`mb-6 rounded-2xl overflow-hidden gap-3 ${
                (post.postImage || post.PostImages).length === 1
                  ? "block"
                  : "grid grid-cols-2"
              }`}
            >
              {(post.postImage || post.PostImages).map((img, i) => (
                <ImageWithFallback
                  key={i}
                  src={img}
                  alt={`Post attachment ${i + 1}`}
                  className="w-full max-h-96 object-cover rounded-xl"
                />
              ))}
            </div>
          )}

          {/* Video Attachment */}
          {(post?.postVideo || post?.PostVideos || []).length > 0 && (
            <div className="mb-6 rounded-2xl overflow-hidden bg-black max-h-96 flex items-center justify-center">
              <video
                src={(post.postVideo || post.PostVideos)[0]}
                controls
                className="max-h-96 w-full rounded-xl"
              />
            </div>
          )}

          <footer className="flex items-center justify-between pt-5 border-t border-outline-variant/15 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-base">
                chat_bubble
              </span>
              {comments.length} Community Solutions
            </span>
            <span className="font-semibold">Nexora Verified Discussion</span>
          </footer>
        </article>

        {/* Comments Section Controls */}
        <div className="flex items-center justify-between px-1">
          <h2 className="font-headline font-bold text-lg text-on-surface">
            Community Solutions & Answers
          </h2>
          <div className="flex bg-surface-container-low p-1 rounded-2xl">
            <button
              onClick={() => handleSortChange("top")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                sortOrder === "top"
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Top Upvoted
            </button>
            <button
              onClick={() => handleSortChange("newest")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                sortOrder === "newest"
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Newest
            </button>
          </div>
        </div>

        {/* Pinned & Helpful Comment Highlights */}
        {pinnedComments.map((comment) => {
          const cAuthor = comment.author || { username: "Contributor" };
          return (
            <div key={comment._id} className="relative">
              <div className="absolute -left-2 top-0 bottom-0 w-1.5 bg-secondary rounded-full" />
              <article className="bg-surface-container-lowest rounded-2xl p-6 shadow-stitch-soft border border-secondary/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={cAuthor.profileImage}
                      name={cAuthor.username || "Contributor"}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-secondary/20"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-headline font-bold text-sm text-on-surface">
                          {cAuthor.username}
                        </h4>
                        <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs filled">
                            verified
                          </span>
                          Verified Solution
                        </span>
                      </div>
                      <p className="text-on-surface-variant text-[11px]">
                        Pinned by post creator
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-tertiary-container/20 text-tertiary px-3 py-1 rounded-xl text-xs font-bold">
                    <span className="material-symbols-outlined text-sm filled">
                      stars
                    </span>
                    <span>+50 XP</span>
                  </div>
                </div>

                <p className="text-on-surface text-sm leading-relaxed whitespace-pre-line">
                  {comment.body}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
<VoteButtons key={`${comment._id}:${comment.upvoteCount ?? comment.upvotesCount ?? 0}:${comment.downvoteCount ?? comment.downvotesCount ?? 0}:${comment.userVote}`} upvoteCount={comment.upvoteCount ?? comment.upvotesCount ?? comment.upvotes?.length ?? 0} downvoteCount={comment.downvoteCount ?? comment.downvotesCount ?? comment.downvotes?.length ?? 0} userVote={comment.userVote} onVote={(vote) => handleCommentVote(comment._id, vote)} onError={(err) => { if (err?.message !== "Login required") error("Failed to register vote."); }} />
                  {isPostOwner && (
                    <button
                      onClick={() => handleSetStatus(comment._id, "none")}
                      className="text-xs font-semibold text-on-surface-variant hover:text-error transition-colors"
                    >
                      Unpin Solution
                    </button>
                  )}
                </div>
              </article>
            </div>
          );
        })}

        {/* Regular Comments Tree */}
        <div className="space-y-4">
          {regularComments.map((comment) => {
            const cAuthor = comment.author || { username: "peer" };
            return (
              <article
                key={comment._id}
                className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/15 shadow-stitch-soft space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={cAuthor.profileImage}
                      name={cAuthor.username || "Peer"}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="font-headline font-bold text-sm text-on-surface">
                        {cAuthor.username}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant">
                        Community Member
                      </p>
                    </div>
                  </div>

                  {isPostOwner && (
                    <button
                      onClick={() => handleSetStatus(comment._id, "helpful")}
                      className="px-3 py-1 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">
                        check_circle
                      </span>
                      Mark Helpful
                    </button>
                  )}
                </div>

                <p className="text-on-surface text-sm leading-relaxed whitespace-pre-line pl-12">
                  {comment.body}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs">
                  <div className="flex items-center gap-3 pl-12">
<VoteButtons key={`${comment._id}:${comment.upvoteCount ?? comment.upvotesCount ?? 0}:${comment.downvoteCount ?? comment.downvotesCount ?? 0}:${comment.userVote}`} upvoteCount={comment.upvoteCount ?? comment.upvotesCount ?? comment.upvotes?.length ?? 0} downvoteCount={comment.downvoteCount ?? comment.downvotesCount ?? comment.downvotes?.length ?? 0} userVote={comment.userVote} onVote={(vote) => handleCommentVote(comment._id, vote)} onError={(err) => { if (err?.message !== "Login required") error("Failed to register vote."); }} />

                    <button
                      onClick={() => {
                        setReplyTarget({
                          id: comment._id,
                          username: cAuthor.username,
                        });
                      }}
                      className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors font-bold"
                    >
                      <span className="material-symbols-outlined text-base">
                        reply
                      </span>
                      <span>Reply</span>
                    </button>
                  </div>
                </div>
                {renderReplies(comment.replies)}
              </article>
            );
          })}

          {comments.length === 0 && (
            <div className="text-center py-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-6">
              <span className="material-symbols-outlined text-4xl text-outline mb-1">
                chat
              </span>
              <p className="text-sm font-bold text-on-surface">
                No answers yet
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Be the first helper to answer this question and earn credibility
                points!
              </p>
            </div>
          )}
        </div>

        {/* Sticky Comment / Reply Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/15 z-40 shadow-stitch-ambient">
          <div className="max-w-4xl mx-auto space-y-2">
            {replyTarget && (
              <div className="flex items-center justify-between text-xs bg-primary-container/30 px-3 py-1.5 rounded-xl text-primary font-bold">
                <span>Replying to @{replyTarget.username}</span>
                <button
                  onClick={() => setReplyTarget(null)}
                  className="hover:underline text-[11px]"
                >
                  Cancel Reply
                </button>
              </div>
            )}

            <form
              onSubmit={handleCommentSubmit}
              className="flex gap-2 items-center"
            >
              <input
                type="text"
                value={newCommentBody}
                onChange={(e) => setNewCommentBody(e.target.value)}
                placeholder={
                  replyTarget
                    ? `Reply to @${replyTarget.username}...`
                    : "Write a helpful solution or guide..."
                }
                className="flex-1 bg-surface-container-low border border-transparent rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all outline-none"
              />
              <button
                type="submit"
                disabled={submitting || !newCommentBody.trim()}
                className="px-6 py-3 bg-gradient-to-br from-primary to-primary-dim text-white font-bold text-xs rounded-full shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Post</span>
                <span className="material-symbols-outlined text-base">
                  send
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
