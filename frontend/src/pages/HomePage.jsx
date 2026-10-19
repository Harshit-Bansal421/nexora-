import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import TopicPills from "../components/TopicPills";
import PostCard from "../components/PostCard";
import { postApi } from "../api/client";
import { getSocket } from "../api/socket";

export default function HomePage() {
  const [activeTopic, setActiveTopic] = useState("all");
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch posts by topic or default
  const fetchPosts = useCallback(
    async (selectedTopic, pageNum = 1, append = false) => {
      try {
        let res;
        if (selectedTopic === "all") {
          res = await postApi.getPosts({ page: pageNum, limit: 10 });
        } else {
          res = await postApi.getTopicPosts(selectedTopic, {
            page: pageNum,
            limit: 10,
          });
        }

        const data = res?.data || res || {};
        const postList = Array.isArray(data) ? data : data?.posts || [];

        if (append) {
          setPosts((prev) => [...prev, ...postList]);
        } else {
          setPosts(postList);
        }

        setHasMore(
          typeof data?.pagination?.hasNextPage === "boolean"
            ? data.pagination.hasNextPage
            : postList.length >= 10,
        );
        setPage(pageNum);
      } catch (err) {
        console.warn("Error fetching posts:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // Reload when topic changes
  useEffect(() => {
    // Feed results are synchronized with the selected topic.
    // oxlint-disable-next-line react/set-state-in-effect
    fetchPosts(activeTopic, 1, false);
  }, [activeTopic, fetchPosts]);

  // Socket listener for real-time post creation
  useEffect(() => {
    const socket = getSocket();
    const handleNewPost = (newPost) => {
      if (newPost && (activeTopic === "all" || newPost.topic === activeTopic)) {
        setPosts((prev) => [newPost, ...prev]);
      }
    };

    socket.on("post-created", handleNewPost);
    return () => {
      socket.off("post-created", handleNewPost);
    };
  }, [activeTopic]);

  const handleSelectTopic = (topicId) => {
    setLoading(true);
    setActiveTopic(topicId);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchPosts(activeTopic, page + 1, true);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-24 space-y-6">
        {/* Bento Hero / Quick Actions */}
        <section className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-8 bg-gradient-to-br from-primary to-primary-dim p-6 rounded-2xl text-on-primary shadow-stitch-ambient relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-2xl font-extrabold font-headline mb-2 leading-tight">
                Need a hand today?
              </h2>
              <p className="text-primary-container text-xs sm:text-sm leading-relaxed mb-5 max-w-sm">
                Ask fellow students for help with coursework, projects, and
                career questions.
              </p>
              <Link
                to="/posts/new"
                className="bg-surface-container-lowest text-primary px-6 py-2.5 rounded-full font-bold text-xs shadow-sm hover:bg-primary-container/20 hover:text-white transition-all inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">
                  edit_square
                </span>
                Start a Request
              </Link>
            </div>
            {/* Background Lightbulb Accent */}
            <div className="absolute -right-4 -bottom-4 opacity-15 pointer-events-none">
              <span className="material-symbols-outlined text-[140px] filled">
                lightbulb
              </span>
            </div>
          </div>

          <Link
            to="/pages/explore"
            className="col-span-12 md:col-span-4 bg-tertiary-container p-6 rounded-2xl text-on-tertiary-container flex flex-col justify-between shadow-stitch-soft hover:shadow-stitch-ambient transition-shadow"
          >
            <div className="flex items-center justify-between">
              <span className="material-symbols-outlined text-3xl">groups</span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-black/10 px-2 py-0.5 rounded-full">
                Explore
              </span>
            </div>
            <div className="mt-4">
              <p className="text-[11px] font-bold font-headline uppercase tracking-wider opacity-85">
                Find your people
              </p>
              <p className="text-base font-extrabold font-headline leading-snug">
                Join a community hub
              </p>
            </div>
          </Link>
        </section>

        {/* Filter Bar */}
        <TopicPills
          activeTopic={activeTopic}
          onSelectTopic={handleSelectTopic}
        />

        {/* Dynamic Feed Posts */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-surface-container-lowest rounded-2xl p-6 shadow-stitch-soft border border-outline-variant/10 animate-pulse space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-surface-container-high rounded" />
                    <div className="h-3 w-20 bg-surface-container-high rounded" />
                  </div>
                </div>
                <div className="h-5 w-3/4 bg-surface-container-high rounded" />
                <div className="h-16 w-full bg-surface-container-high rounded" />
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-5">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} />
            ))}

            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="min-h-11 px-6 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold rounded-full transition-all active:scale-95 disabled:opacity-50"
                >
                  {loadingMore
                    ? "Loading more discussions..."
                    : "Load More Posts"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
            <div className="w-14 h-14 rounded-full bg-primary-container/30 flex items-center justify-center text-primary mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">forum</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-1">
              No discussions yet in this category
            </h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto mb-5">
              Be the first to ask a question or share your knowledge with fellow
              students!
            </p>
            <Link
              to="/posts/new"
              className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm hover:bg-primary-dim transition-all inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Create Post
            </Link>
          </div>
        )}

        {/* Mobile Floating Action Button (FAB) */}
        <div className="md:hidden fixed bottom-20 right-5 z-30">
          <Link
            to="/posts/new"
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dim text-white flex items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-transform"
            title="Create Post"
          >
            <span className="material-symbols-outlined text-2xl">add</span>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
