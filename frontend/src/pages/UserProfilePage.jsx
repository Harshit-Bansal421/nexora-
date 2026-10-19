import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import { postApi, authApi } from "../api/client";
import { getSocket, joinUserRoom, leaveUserRoom } from "../api/socket";
import Avatar from "../components/Avatar";

export default function UserProfilePage() {
  const { username } = useParams();
  const { currentUser, isAuthenticated } = useAuth();
  const { success, error, info } = useToast();

  const isOwnProfile =
    currentUser &&
    currentUser.username?.toLowerCase() === username?.toLowerCase();

  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [activeTab, setActiveTab] = useState("posts"); // 'posts' | 'saved'
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isFollowingBusy, setIsFollowingBusy] = useState(false);
  const pendingFollowAction = useRef(false);
  const [followListType, setFollowListType] = useState(null);
  const [followList, setFollowList] = useState([]);
  const [followListPage, setFollowListPage] = useState(1);
  const [followListTotalPages, setFollowListTotalPages] = useState(1);
  const [followListLoading, setFollowListLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchUserData = async () => {
      setLoading(true);
      try {
        // Fetch posts of user to extract author details
        const res = await postApi.getUserPosts(username, {
          page: 1,
          limit: 20,
        });
        if (isMounted) {
          const data = res?.data || res || {};
          const postList = Array.isArray(data) ? data : data?.posts || [];

          // The endpoint returns profile data separately so empty profiles still render correctly.
          const userObj =
            data?.owner ||
            postList[0]?.author ||
            postList[0]?.owner ||
            (isOwnProfile ? currentUser : null);
          if (!userObj) {
            setProfileUser(null);
            setUserPosts([]);
            setFollowerCount(0);
            setFollowingCount(0);
            return;
          }
          setProfileUser(userObj);
          setUserPosts(
            postList.map((post) => ({
              ...post,
              owner:
                post.owner && typeof post.owner === "object"
                  ? post.owner
                  : userObj,
            })),
          );

          const followers = userObj.followers || [];
          const following = userObj.following || [];
          setFollowerCount(userObj.followersCount ?? followers.length);
          setFollowingCount(userObj.followingCount ?? following.length);
          setIsFollowing(
            Boolean(currentUser && (userObj.isFollowing ?? followers.some((follower) => String(follower?._id || follower) === String(currentUser._id)))),
          );
        }
      } catch (err) {
        console.warn("Error fetching user posts:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUserData();
    return () => {
      isMounted = false;
    };
  }, [username, isOwnProfile, currentUser]);

  // Load saved posts if own profile
  useEffect(() => {
    if (isOwnProfile && activeTab === "saved") {
      const fetchSaved = async () => {
        setLoadingPosts(true);
        try {
          const res = await postApi.getSavedPosts({ page: 1, limit: 20 });
          const data = res?.data || res || {};
          setSavedPosts(
            Array.isArray(data) ? data : data?.savedPost || data?.posts || [],
          );
        } catch (err) {
          console.warn("Error fetching saved posts:", err);
        } finally {
          setLoadingPosts(false);
        }
      };
      fetchSaved();
    }
  }, [isOwnProfile, activeTab]);

  // Real-time follow updates via socket
  useEffect(() => {
    if (!profileUser?._id) return;
    const socket = getSocket();
    joinUserRoom(profileUser._id);

    const handleFollowed = (user) => {
      if (pendingFollowAction.current) return;
      if (Array.isArray(user?.followers)) setFollowerCount(user.followers.length);
    };
    const handleUnfollowed = (user) => {
      if (pendingFollowAction.current) return;
      if (Array.isArray(user?.followers)) setFollowerCount(user.followers.length);
    };

    socket.on("followed-user", handleFollowed);
    socket.on("unfollowed-user", handleUnfollowed);

    return () => {
      leaveUserRoom(profileUser._id);
      socket.off("followed-user", handleFollowed);
      socket.off("unfollowed-user", handleUnfollowed);
    };
  }, [profileUser?._id]);

  useEffect(() => {
    if (!followListType || !profileUser?._id) return;
    let active = true;
    authApi.getFollowList(profileUser._id, followListType, { page: followListPage, limit: 20 })
      .then((response) => {
        if (!active) return;
        const data = response?.data || response || {};
        const people = data.users || [];
        setFollowList((current) => followListPage === 1 ? people : [...current, ...people]);
        setFollowListTotalPages(data.pagination?.totalPages || 1);
      })
      .catch((err) => {
        if (active) {
          if (followListPage > 1) setFollowListPage((page) => Math.max(1, page - 1));
          error(err?.message || "Could not load this list.");
        }
      })
      .finally(() => {
        if (active) setFollowListLoading(false);
      });
    return () => { active = false; };
  }, [error, followListPage, followListType, profileUser?._id]);

  const openFollowList = (type) => {
    setFollowList([]);
    setFollowListPage(1);
    setFollowListTotalPages(1);
    setFollowListLoading(true);
    setFollowListType(type);
  };

  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      info("Please log in to follow creators.");
      return;
    }
    if (!profileUser?._id) return;
    if (isFollowingBusy) return;

    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowerCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    setIsFollowingBusy(true);
    pendingFollowAction.current = true;

    try {
      if (nextState) {
        const response = await authApi.followUser(profileUser._id);
        const data = response?.data || response || {};
        if (Number.isFinite(data.followersCount)) setFollowerCount(data.followersCount);
        setIsFollowing(data.isFollowing ?? true);
        success(`You are now following ${profileUser.username}`);
      } else {
        const response = await authApi.unfollowUser(profileUser._id);
        const data = response?.data || response || {};
        if (Number.isFinite(data.followersCount)) setFollowerCount(data.followersCount);
        setIsFollowing(data.isFollowing ?? false);
        info(`Unfollowed ${profileUser.username}`);
      }
    } catch (err) {
      setIsFollowing(!nextState);
      setFollowerCount((prev) =>
        !nextState ? prev + 1 : Math.max(0, prev - 1),
      );
      error(err?.message || "Failed to update follow status.");
    } finally {
      pendingFollowAction.current = false;
      setIsFollowingBusy(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div
          className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6"
          role="status"
          aria-label="Loading profile"
        >
          <div className="h-44 sm:h-56 rounded-3xl bg-surface-container-low animate-pulse" />
          <div className="h-32 rounded-3xl bg-surface-container-low animate-pulse" />
          <div className="h-64 rounded-3xl bg-surface-container-low animate-pulse" />
        </div>
      </Layout>
    );
  }

  if (!profileUser) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <span
            className="material-symbols-outlined text-5xl text-outline"
            aria-hidden="true"
          >
            person_search
          </span>
          <h1 className="mt-3 text-xl font-bold">Profile not found</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            This account may have been removed or the address may be incorrect.
          </p>
          <Link
            to="/feed"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-on-primary"
          >
            Back to feed
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-24">
        {/* Cover Banner */}
        <section className="relative rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-stitch-soft">
          <div className="h-36 sm:h-48 md:h-56 w-full rounded-t-3xl bg-gradient-to-br from-primary via-primary-dim to-primary-fixed relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
            <div aria-hidden="true" className="absolute -right-10 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" />
          </div>

          {/* Profile Info Header */}
          <div className="px-4 sm:px-6 -mt-10 sm:-mt-14 flex flex-col md:flex-row md:items-end md:justify-between gap-5 relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              {/* Avatar */}
              <div className="relative">
                <div className="p-1.5 bg-surface rounded-[2rem] shadow-stitch-ambient">
                  <Avatar
                    src={profileUser?.profileImage}
                    name={profileUser?.username || "User"}
                  className="w-20 h-20 sm:w-28 sm:h-28 rounded-[1.5rem] object-cover"
                  />
                </div>
                <div className="absolute bottom-2 right-2 bg-secondary text-on-secondary px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border-2 border-surface">
                  {profileUser?.title || "Newcomer"}
                </div>
              </div>

              {/* Names */}
              <div className="pb-1">
                <h1 className="break-words text-2xl sm:text-3xl font-extrabold font-headline tracking-tight text-on-surface">
                  {profileUser?.username}
                </h1>
                <p className="text-on-surface-variant font-medium text-sm">
                  @{profileUser?.username}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pb-1 md:ml-auto">
              {isOwnProfile ? (
                <Link
                  to="/profile/edit"
                  className="bg-surface-container-highest hover:bg-surface-dim text-on-surface px-6 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">
                    edit
                  </span>
                  Edit Profile
                </Link>
              ) : (
                <button
                  onClick={handleFollowToggle}
                  disabled={isFollowingBusy}
                  aria-busy={isFollowingBusy}
                  className={`min-h-11 min-w-32 justify-center px-6 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${
                    isFollowing
                      ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                      : "bg-gradient-to-br from-primary to-primary-dim text-white hover:brightness-105"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {isFollowing ? "check" : "person_add"}
                  </span>
                  {isFollowingBusy ? "Updating…" : isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>

          {/* Stats & Bio Bento Grid */}
          <div className="px-4 sm:px-6 pb-6 mt-6 grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Bio Card */}
            <div className="md:col-span-8 bg-surface-container-low p-6 rounded-2xl border border-outline-variant/15">
              <h3 className="font-headline font-bold text-base mb-2 text-on-surface">
                About
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                {profileUser?.bio || "No bio added yet."}
              </p>
              <div className="flex flex-wrap gap-4 mt-5 text-xs text-on-surface-variant">
                {profileUser?.createdAt && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">
                      calendar_month
                    </span>
                    Joined{" "}
                    {new Date(profileUser.createdAt).toLocaleDateString(
                      undefined,
                      { month: "short", year: "numeric" },
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="md:col-span-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => openFollowList("followers")} className="min-h-11 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 flex flex-col items-center justify-center text-center shadow-stitch-soft hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="text-2xl font-extrabold font-headline text-primary">
                  {followerCount}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">
                  Followers
                </span>
              </button>

              <button type="button" onClick={() => openFollowList("following")} className="min-h-11 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 flex flex-col items-center justify-center text-center shadow-stitch-soft hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="text-2xl font-extrabold font-headline text-primary">
                  {followingCount}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">
                  Following
                </span>
              </button>

              <div className="col-span-2 bg-gradient-to-r from-tertiary-container to-tertiary-fixed p-5 rounded-2xl flex items-center justify-between shadow-stitch-soft text-on-tertiary-container">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest opacity-80">
                    Community Reputation
                  </span>
                  <span className="text-2xl font-extrabold font-headline">
                    {profileUser?.point || 0} pts
                  </span>
                </div>
                <span className="material-symbols-outlined text-4xl filled">
                  stars
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Profile Tabs */}
        <section className="px-4 sm:px-6 mt-10">
          <div className="flex border-b border-outline-variant/20 mb-6">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors text-center ${
                activeTab === "posts"
                  ? "text-primary border-b-2 border-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Contributions ({userPosts.length})
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab("saved")}
                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors text-center ${
                  activeTab === "saved"
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Saved Vault ({savedPosts.length})
              </button>
            )}
          </div>

          {/* Posts Feed */}
          {activeTab === "posts" ? (
            userPosts.length > 0 ? (
              <div className="space-y-4">
                {userPosts.map((post) => (
                  <PostCard key={post._id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">
                  article
                </span>
                <h4 className="font-bold text-on-surface">
                  No posts published yet
                </h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  {isOwnProfile
                    ? "Start sharing knowledge with the community by asking your first question."
                    : `@${username} hasn't published any questions yet.`}
                </p>
                {isOwnProfile && (
                  <Link
                    to="/posts/new"
                    className="mt-4 inline-flex items-center gap-1.5 px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm hover:bg-primary-dim transition-all"
                  >
                    <span className="material-symbols-outlined text-base">
                      add
                    </span>
                    Create First Post
                  </Link>
                )}
              </div>
            )
          ) : // Saved Vault
          loadingPosts ? (
            <div
              className="space-y-4"
              role="status"
              aria-label="Loading saved posts"
            >
              {[0, 1].map((key) => (
                <div
                  key={key}
                  className="h-48 rounded-2xl bg-surface-container-low animate-pulse"
                />
              ))}
            </div>
          ) : savedPosts.length > 0 ? (
            <div className="space-y-4">
              {savedPosts.map((post) => (
                <PostCard key={post._id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">
                bookmark_border
              </span>
              <h4 className="font-bold text-on-surface">
                Your saved vault is empty
              </h4>
              <p className="text-xs text-on-surface-variant mt-1">
                Click the bookmark button on any post to save it for quick
                reference later.
              </p>
            </div>
          )}
        </section>
      </div>
      {followListType && createPortal((
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setFollowListType(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="follow-list-title" className="flex max-h-[min(80vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
            <header className="flex items-center justify-between border-b border-outline-variant/15 px-5 py-4">
              <h2 id="follow-list-title" className="font-headline text-lg font-bold text-on-surface">{followListType === "followers" ? "Followers" : "Following"}</h2>
              <button type="button" aria-label="Close list" onClick={() => setFollowListType(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="material-symbols-outlined">close</span></button>
            </header>
            <div className="min-h-32 overflow-y-auto px-4 py-2">
              {followList.map((person) => (
                person.username ? (
                  <Link key={person._id} to={`/profile/${encodeURIComponent(person.username)}`} onClick={() => setFollowListType(null)} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <Avatar src={person.profileImage} name={person.username} className="h-10 w-10 rounded-full object-cover" />
                    <span className="font-semibold text-sm text-on-surface">{person.username}</span>
                    {person.badge && <span className="ml-auto rounded-full bg-secondary-container/40 px-2 py-1 text-[10px] font-bold text-secondary">{person.badge}</span>}
                  </Link>
                ) : (
                  <div key={person._id} className="flex min-h-14 items-center gap-3 px-2 py-2 text-sm text-on-surface-variant">
                    <Avatar src={person.profileImage} name="User" className="h-10 w-10 rounded-full object-cover" />
                    Unknown user
                  </div>
                )
              ))}
              {!followListLoading && followList.length === 0 && <p className="py-8 text-center text-sm text-on-surface-variant">No {followListType} yet.</p>}
              {followListLoading && <p role="status" className="py-5 text-center text-sm text-on-surface-variant">Loading…</p>}
            </div>
            {followListPage < followListTotalPages && <footer className="border-t border-outline-variant/15 p-3"><button type="button" disabled={followListLoading} onClick={() => { setFollowListLoading(true); setFollowListPage((page) => page + 1); }} className="min-h-11 w-full rounded-xl bg-primary/10 text-sm font-bold text-primary disabled:opacity-50">Load more</button></footer>}
          </section>
        </div>
      ), document.body)}
    </Layout>
  );
}
