import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import PostCard from '../components/PostCard';
import { useAuth } from '../context/authContextValue';
import { useToast } from '../context/toastContextValue';
import { postApi, authApi } from '../api/client';
import { getSocket, joinUserRoom, leaveUserRoom } from '../api/socket';
import Avatar from '../components/Avatar';

export default function UserProfilePage() {
  const { username } = useParams();
  const { currentUser, isAuthenticated } = useAuth();
  const { success, error, info } = useToast();

  const isOwnProfile = currentUser && currentUser.username?.toLowerCase() === username?.toLowerCase();

  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'saved'
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchUserData = async () => {
      setLoading(true);
      try {
        // Fetch posts of user to extract author details
        const res = await postApi.getUserPosts(username, { page: 1, limit: 20 });
        if (isMounted) {
          const data = res?.data || res || {};
          const postList = Array.isArray(data) ? data : (data?.posts || []);

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
                post.owner && typeof post.owner === 'object'
                  ? post.owner
                  : userObj,
            })),
          );

          const followers = userObj.followers || [];
          const following = userObj.following || [];
          setFollowerCount(followers.length);
          setFollowingCount(following.length);
          setIsFollowing(currentUser && followers.includes(currentUser._id));
        }
      } catch (err) {
        console.warn('Error fetching user posts:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUserData();
    return () => { isMounted = false; };
  }, [username, isOwnProfile, currentUser]);

  // Load saved posts if own profile
  useEffect(() => {
    if (isOwnProfile && activeTab === 'saved') {
      const fetchSaved = async () => {
        setLoadingPosts(true);
        try {
          const res = await postApi.getSavedPosts({ page: 1, limit: 20 });
          const data = res?.data || res || {};
          setSavedPosts(
            Array.isArray(data) ? data : (data?.savedPost || data?.posts || []),
          );
        } catch (err) {
          console.warn('Error fetching saved posts:', err);
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

    const handleFollowed = () => {
      setFollowerCount((prev) => prev + 1);
    };
    const handleUnfollowed = () => {
      setFollowerCount((prev) => Math.max(0, prev - 1));
    };

    socket.on('followed-user', handleFollowed);
    socket.on('unfollowed-user', handleUnfollowed);

    return () => {
      leaveUserRoom(profileUser._id);
      socket.off('followed-user', handleFollowed);
      socket.off('unfollowed-user', handleUnfollowed);
    };
  }, [profileUser?._id]);

  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      info('Please log in to follow creators.');
      return;
    }
    if (!profileUser?._id) return;

    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowerCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (nextState) {
        await authApi.followUser(profileUser._id);
        success(`You are now following ${profileUser.username}`);
      } else {
        await authApi.unfollowUser(profileUser._id);
        info(`Unfollowed ${profileUser.username}`);
      }
    } catch (err) {
      setIsFollowing(!nextState);
      setFollowerCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
      error(err?.message || 'Failed to update follow status.');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6" role="status" aria-label="Loading profile">
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
          <span className="material-symbols-outlined text-5xl text-outline" aria-hidden="true">person_search</span>
          <h1 className="mt-3 text-xl font-bold">Profile not found</h1>
          <p className="mt-2 text-sm text-on-surface-variant">This account may have been removed or the address may be incorrect.</p>
          <Link to="/feed" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-on-primary">Back to feed</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-24">
        {/* Cover Banner */}
        <section className="relative">
          <div className="h-44 sm:h-56 md:h-64 w-full bg-gradient-to-r from-primary via-primary-dim to-primary-fixed relative overflow-hidden">
            <div className="absolute inset-0 bg-black/15" />
          </div>

          {/* Profile Info Header */}
          <div className="px-4 sm:px-6 -mt-12 sm:-mt-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6 relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              {/* Avatar */}
              <div className="relative">
                <div className="p-1.5 bg-surface rounded-[2rem] shadow-stitch-ambient">
                  <Avatar
                    src={profileUser?.profileImage}
                    name={profileUser?.username || 'User'}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-[1.5rem] object-cover"
                  />
                </div>
                <div className="absolute bottom-2 right-2 bg-secondary text-on-secondary px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border-2 border-surface">
                  {profileUser?.title || 'Newcomer'}
                </div>
              </div>

              {/* Names */}
              <div className="pb-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-headline tracking-tight text-on-surface">
                  {profileUser?.username}
                </h1>
                <p className="text-on-surface-variant font-medium text-sm">
                  @{profileUser?.username}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pb-2">
              {isOwnProfile ? (
                <Link
                  to="/profile/edit"
                  className="bg-surface-container-highest hover:bg-surface-dim text-on-surface px-6 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  Edit Profile
                </Link>
              ) : (
                <button
                  onClick={handleFollowToggle}
                  className={`px-8 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm flex items-center gap-1.5 ${
                    isFollowing
                      ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                      : 'bg-gradient-to-br from-primary to-primary-dim text-white hover:brightness-105'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {isFollowing ? 'check' : 'person_add'}
                  </span>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>

          {/* Stats & Bio Bento Grid */}
          <div className="px-4 sm:px-6 mt-8 grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Bio Card */}
            <div className="md:col-span-8 bg-surface-container-low p-6 rounded-2xl border border-outline-variant/15">
              <h3 className="font-headline font-bold text-base mb-2 text-on-surface">About</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                {profileUser?.bio || 'No bio added yet.'}
              </p>
              <div className="flex flex-wrap gap-4 mt-5 text-xs text-on-surface-variant">
                {profileUser?.createdAt && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">calendar_month</span>
                    Joined {new Date(profileUser.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="md:col-span-4 grid grid-cols-2 gap-3">
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 flex flex-col items-center justify-center text-center shadow-stitch-soft">
                <span className="text-2xl font-extrabold font-headline text-primary">
                  {followerCount}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">
                  Followers
                </span>
              </div>

              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 flex flex-col items-center justify-center text-center shadow-stitch-soft">
                <span className="text-2xl font-extrabold font-headline text-primary">
                  {followingCount}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">
                  Following
                </span>
              </div>

              <div className="col-span-2 bg-gradient-to-r from-tertiary-container to-tertiary-fixed p-5 rounded-2xl flex items-center justify-between shadow-stitch-soft text-on-tertiary-container">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest opacity-80">
                    Community Reputation
                  </span>
                  <span className="text-2xl font-extrabold font-headline">
                    {profileUser?.point || 0} pts
                  </span>
                </div>
                <span className="material-symbols-outlined text-4xl filled">stars</span>
              </div>
            </div>
          </div>
        </section>

        {/* Profile Tabs */}
        <section className="px-4 sm:px-6 mt-10">
          <div className="flex border-b border-outline-variant/20 mb-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors text-center ${
                activeTab === 'posts'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Contributions ({userPosts.length})
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('saved')}
                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors text-center ${
                  activeTab === 'saved'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Saved Vault ({savedPosts.length})
              </button>
            )}
          </div>

          {/* Posts Feed */}
          {activeTab === 'posts' ? (
            userPosts.length > 0 ? (
              <div className="space-y-4">
                {userPosts.map((post) => (
                  <PostCard key={post._id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">article</span>
                <h4 className="font-bold text-on-surface">No posts published yet</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  {isOwnProfile
                    ? 'Start sharing knowledge with the community by asking your first question.'
                    : `@${username} hasn't published any questions yet.`}
                </p>
                {isOwnProfile && (
                  <Link
                    to="/posts/new"
                    className="mt-4 inline-flex items-center gap-1.5 px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm hover:bg-primary-dim transition-all"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Create First Post
                  </Link>
                )}
              </div>
            )
          ) : (
            // Saved Vault
            loadingPosts ? (
              <div className="space-y-4" role="status" aria-label="Loading saved posts">
                {[0, 1].map((key) => <div key={key} className="h-48 rounded-2xl bg-surface-container-low animate-pulse" />)}
              </div>
            ) : savedPosts.length > 0 ? (
              <div className="space-y-4">
                {savedPosts.map((post) => (
                  <PostCard key={post._id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">bookmark_border</span>
                <h4 className="font-bold text-on-surface">Your saved vault is empty</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  Click the bookmark button on any post to save it for quick reference later.
                </p>
              </div>
            )
          )}
        </section>
      </div>
    </Layout>
  );
}
