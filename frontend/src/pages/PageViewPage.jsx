import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import PostCard from "../components/PostCard";
import { pageApi, postApi } from "../api/client";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import { joinPageRoom, leavePageRoom } from "../api/socket";
import ImageWithFallback from "../components/ImageWithFallback";

export default function PageViewPage() {
  const { pageId } = useParams();
  const { currentUser, isAuthenticated } = useAuth();
  const { success, error, info } = useToast();

  const [page, setPage] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isMember, setIsMember] = useState(false);
  const [membersCount, setMembersCount] = useState(null);
  const [requestPending, setRequestPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchPageData = async () => {
      setLoading(true);
      setMembersCount(null);
      setRequestPending(false);
      try {
        const [pageRes, postsRes] = await Promise.allSettled([
          pageApi.getPageById(pageId),
          postApi.getPagePosts(pageId, { page: 1, limit: 20 }),
        ]);

        if (isMounted) {
          if (pageRes.status === "fulfilled") {
            let pageData = pageRes.value?.data || pageRes.value;
            const memberRole = ["member", "moderator", "owner"].includes(
              pageData?.userRole,
            );
            if (memberRole) {
              try {
                const membersRes = await pageApi.getPageMembers(pageId, {
                  limit: 100,
                });
                const membersData = membersRes?.data || membersRes;
                const memberList = membersData?.membeList;
                if (isMounted && memberList) {
                  setMembersCount(
                    memberList.membersCount ??
                      memberList.members?.length ??
                      null,
                  );
                  pageData = {
                    ...pageData,
                    membersCount: memberList.membersCount,
                  };
                }
              } catch (err) {
                console.warn("Could not load community member count:", err);
              }
            }
            if (isMounted) {
              setPage(pageData);
              setIsMember(memberRole);
            }
          }

          if (postsRes.status === "fulfilled") {
            const postsData = postsRes.value?.data || postsRes.value || [];
            setPosts(
              Array.isArray(postsData) ? postsData : postsData?.posts || [],
            );
          }
        }
      } catch (err) {
        console.warn("Error fetching page view data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPageData();
    if (isAuthenticated) joinPageRoom(pageId);

    return () => {
      isMounted = false;
      if (isAuthenticated) leavePageRoom(pageId);
    };
  }, [pageId, currentUser, isAuthenticated]);

  const handleJoinToggle = async () => {
    if (!isAuthenticated) {
      info("Please log in to join this community hub.");
      return;
    }

    if (page?.userRole === "owner" || isOwner) {
      info("Page owners cannot leave their own community.");
      return;
    }

    if (!isMember && page?.type === "private") {
      setJoining(true);
      try {
        await pageApi.joinPage(pageId);
        setRequestPending(true);
        success("Your request to join has been sent.");
      } catch (err) {
        error(err?.message || "Failed to send a join request.");
      } finally {
        setJoining(false);
      }
      return;
    }

    setJoining(true);
    const nextState = !isMember;
    setIsMember(nextState);

    try {
      if (nextState) {
        await pageApi.joinPage(pageId);
        setMembersCount((count) => (count === null ? null : count + 1));
        success(`You joined ${page?.pageName || "the community"}!`);
      } else {
        await pageApi.leavePage(pageId);
        setMembersCount((count) =>
          count === null ? null : Math.max(0, count - 1),
        );
        info(`You left ${page?.pageName || "the community"}.`);
      }
    } catch (err) {
      setIsMember(!nextState);
      error(err?.message || "Failed to update membership.");
    } finally {
      setJoining(false);
    }
  };

  const isOwner =
    currentUser &&
    (page?.owner === currentUser._id || page?.owner?._id === currentUser._id);
  const memberCount =
    membersCount ?? (page?.membersCount > 0 ? page.membersCount : null);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto py-24 text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-on-surface-variant">
            Loading community hub...
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-24 space-y-8">
        {/* Community Banner & Header */}
        <section className="overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-stitch-soft">
          <div className="h-40 sm:h-52 w-full overflow-hidden bg-surface-container-highest relative">
            <ImageWithFallback
              src={
                page?.pageProfileImage ||
                "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80"
              }
              alt={page?.pageName}
              className="w-full h-full object-cover"
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary-fixed text-white" aria-hidden="true">
                  <span className="material-symbols-outlined text-6xl">groups</span>
                </div>
              }
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />
          </div>

          <div className="flex flex-col gap-5 p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="-mt-12 h-20 w-20 shrink-0 rounded-2xl bg-surface-container-lowest p-1.5 shadow-stitch-ambient sm:-mt-14 sm:h-24 sm:w-24">
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-4xl">
                    groups
                  </span>
                </div>
              </div>

              <div className="min-w-0 pb-1">
                <h1 className="break-words text-2xl sm:text-3xl font-headline font-extrabold text-on-surface tracking-tight">
                  {page?.pageName || "Community Hub"}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
                  <span className="text-on-surface-variant font-medium flex items-center gap-1 text-xs">
                    <span className="material-symbols-outlined text-sm">
                      groups
                    </span>
                    {memberCount === null
                      ? "Member count unavailable"
                      : `${memberCount} members`}
                  </span>
                  <span className="text-on-surface-variant font-medium flex items-center gap-1 text-xs">
                    <span className="material-symbols-outlined text-sm">
                      public
                    </span>
                    {page?.type || "Open"} Hub
                  </span>
                </div>
              </div>
            </div>

            {/* Actions: Join & Info */}
            <div className="flex items-center gap-3 md:shrink-0">
              <button
                onClick={handleJoinToggle}
                disabled={joining || isOwner}
                className={`min-h-11 rounded-xl px-6 py-2.5 font-bold text-xs transition-all shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${
                  isMember || isOwner
                    ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                    : "bg-primary text-white hover:bg-primary-dim"
                }`}
              >
                {joining
                  ? "..."
                  : isOwner
                    ? "Owner"
                    : isMember
                      ? "Leave Hub"
                      : requestPending
                        ? "Requested"
                        : page?.type === "private"
                          ? "Request to Join"
                          : "Join Hub"}
              </button>

              <Link
                to={`/pages/${pageId}/info`}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-highest text-on-surface shadow-sm transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Hub Info & Roster"
              >
                <span className="material-symbols-outlined text-lg">info</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Content Section: Quick Post Box & Feed */}
        {page?.type === "private" && !isMember && !isOwner ? (
          <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-8 text-center shadow-stitch-soft">
            <span className="material-symbols-outlined text-4xl text-primary" aria-hidden="true">
              lock
            </span>
            <h2 className="mt-3 font-headline text-xl font-bold text-on-surface">
              Private community
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-on-surface-variant">
              You can view this community and its details. Request to join to access its posts and participate; a moderator or owner must approve your request.
            </p>
            {!isAuthenticated && (
              <p className="mt-3 text-sm font-semibold text-on-surface-variant">
                Sign in to request access.
              </p>
            )}
          </section>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Post Prompt */}
            <Link
              to={`/posts/new?pageId=${pageId}`}
              className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 flex gap-3.5 items-center shadow-stitch-soft hover:shadow-stitch-ambient transition-all group"
            >
              <div className="h-10 w-10 rounded-full bg-primary-container/40 flex-shrink-0 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">edit</span>
              </div>
              <div className="flex-grow bg-surface-container-low rounded-xl px-4 py-2.5 text-on-surface-variant text-xs sm:text-sm group-hover:bg-surface-container transition-colors">
                Ask a question or share an update in {page?.pageName}...
              </div>
              <span className="material-symbols-outlined text-primary text-xl">
                image
              </span>
            </Link>

            {/* Hub Posts Feed */}
            {posts.length > 0 ? (
              <div className="space-y-5">
                {posts.map((post) => (
                  <PostCard key={post._id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">
                  forum
                </span>
                <h3 className="font-headline font-bold text-lg text-on-surface">
                  No questions yet in this hub
                </h3>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1 mb-5">
                  Start the discussion! Ask questions or share reference
                  material with community members.
                </p>
                <Link
                  to={`/posts/new?pageId=${pageId}`}
                  className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm hover:bg-primary-dim transition-all inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">
                    add
                  </span>
                  Post First Question
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar Info Column */}
          <div className="space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-stitch-soft space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                About Community
              </h3>
              <p className="text-xs text-on-surface/90 leading-relaxed">
                {page?.pageDescription ||
                  "A collaborative learning hub dedicated to student success."}
              </p>

              <div className="pt-3 border-t border-outline-variant/10 space-y-2 text-xs">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Community Type</span>
                  <span className="font-bold text-on-surface capitalize">
                    {page?.type || "Open"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Members</span>
                  <span className="font-bold text-on-surface">
                    {memberCount ?? "—"}
                  </span>
                </div>
              </div>

              <Link
                to={`/pages/${pageId}/info`}
                className="w-full mt-2 py-2.5 bg-surface-container-low hover:bg-surface-container text-primary font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>View Full Details & Roster</span>
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </Link>
            </div>
          </div>
        </div>
        )}
      </div>
    </Layout>
  );
}
