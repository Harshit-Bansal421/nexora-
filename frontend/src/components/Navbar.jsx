import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { authApi, pageApi, postApi } from "../api/client";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import Avatar from "./Avatar";

export default function Navbar() {
  const { currentUser, isAuthenticated, logout, unreadNotificationsCount } =
    useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState({
    users: [],
    posts: [],
    pages: [],
  });
  const [searchLoading, setSearchLoading] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        !dropdownRef.current?.contains(event.target) &&
        !searchRef.current?.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults({ users: [], posts: [], pages: [] });
      setSearchLoading(false);
      return;
    }
    let active = true;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      const [usersRes, postsRes, pagesRes] = await Promise.allSettled([
        authApi.searchUsers(query),
        postApi.searchPosts(query),
        pageApi.getPages({ search: query, page: 1, limit: 5 }),
      ]);
      if (!active) return;
      const payload = (result) =>
        result.status === "fulfilled"
          ? result.value?.data || result.value || {}
          : {};
      const usersData = payload(usersRes);
      const postsData = payload(postsRes);
      const pagesData = payload(pagesRes);
      setSearchResults({
        users: usersData.users || [],
        posts: postsData.posts || (Array.isArray(postsData) ? postsData : []),
        pages: pagesData.pages || [],
      });
      setSearchLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setDropdownOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    success("Logged out successfully");
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="w-full sticky top-0 z-50 bg-surface/95 backdrop-blur-md border-b border-outline-variant/15 px-4 sm:px-6 py-3 shadow-stitch-soft">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link
            to={isAuthenticated ? "/feed" : "/"}
            className="flex items-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center text-on-primary shadow-sm group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-xl">hub</span>
            </div>
            <span className="text-2xl font-extrabold text-primary font-headline tracking-tight">
              Nexora
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-headline">
            <Link
              to="/feed"
              className={`font-semibold transition-colors ${
                isActive("/feed") || isActive("/home")
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              Feed
            </Link>
            <Link
              to="/pages/explore"
              className={`font-semibold transition-colors ${
                isActive("/pages/explore")
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              Explore Hubs
            </Link>
            <Link
              to="/posts/new"
              className={`font-semibold transition-colors flex items-center gap-1 ${
                isActive("/posts/new")
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-base">
                add_circle
              </span>
              New Post
            </Link>
          </nav>
        </div>

        {/* Global Search Bar */}
        <div
          className="flex-1 max-w-md hidden sm:block"
          style={location.pathname === "/search" ? { display: "none" } : undefined}
          ref={searchRef}
        >
          <form
            onSubmit={handleSearchSubmit}
            className="relative"
            role="search"
          >
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setDropdownOpen(false);
              }}
              placeholder="Search people (@username), posts, hubs, or topics..."
              aria-label="Search people, posts, communities, and topics"
              aria-expanded={dropdownOpen && searchQuery.trim().length >= 2}
              aria-controls="global-search-results"
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-transparent rounded-full text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
            />
            {dropdownOpen && searchQuery.trim().length >= 2 && (
              <div
                id="global-search-results"
                className="absolute left-0 right-0 top-full mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-2 shadow-stitch-modal z-[60]"
              >
                {searchLoading ? (
                  <p className="px-3 py-4 text-sm text-on-surface-variant">
                    Searching…
                  </p>
                ) : (
                  <>
                    <SearchGroup
                      title="People"
                      icon="person"
                      empty="No profiles found"
                    >
                      {searchResults.users.slice(0, 4).map((user) => (
                        <Link
                          key={user._id}
                          to={`/profile/${encodeURIComponent(user.username)}`}
                          onClick={() => {
                            setDropdownOpen(false);
                            setSearchQuery("");
                          }}
                          className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-container-low"
                        >
                          <Avatar
                            src={user.profileImage}
                            name={user.username}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-on-surface">
                              @{user.username}
                            </span>
                            <span className="block truncate text-xs text-on-surface-variant">
                              {user.title || "Community member"}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </SearchGroup>
                    <SearchGroup
                      title="Posts"
                      icon="article"
                      empty="No matching posts"
                    >
                      {searchResults.posts.slice(0, 3).map((post) => (
                        <Link
                          key={post._id}
                          to={`/posts/${post._id}/comments`}
                          state={{ post }}
                          onClick={() => {
                            setDropdownOpen(false);
                            setSearchQuery("");
                          }}
                          className="block rounded-xl px-3 py-2 hover:bg-surface-container-low"
                        >
                          <span className="block truncate text-sm font-bold text-on-surface">
                            {post.title || "Untitled post"}
                          </span>
                          <span className="block truncate text-xs text-on-surface-variant">
                            {post.topic ? `#${post.topic} · ` : ""}
                            {post.description || "Open discussion"}
                          </span>
                        </Link>
                      ))}
                    </SearchGroup>
                    <SearchGroup
                      title="Communities"
                      icon="groups"
                      empty="No matching communities"
                    >
                      {searchResults.pages.slice(0, 3).map((page) => (
                        <Link
                          key={page._id}
                          to={`/pages/${page._id}`}
                          onClick={() => {
                            setDropdownOpen(false);
                            setSearchQuery("");
                          }}
                          className="block rounded-xl px-3 py-2 hover:bg-surface-container-low"
                        >
                          <span className="block truncate text-sm font-bold text-on-surface">
                            {page.pageName}
                          </span>
                          <span className="block truncate text-xs text-on-surface-variant">
                            {page.pageDescription || "Community hub"}
                          </span>
                        </Link>
                      ))}
                    </SearchGroup>
                    {[
                      ...new Set(
                        searchResults.posts
                          .map((post) => post.topic)
                          .filter(Boolean),
                      ),
                    ].length > 0 && (
                      <SearchGroup title="Topics" icon="tag" empty="">
                        {[
                          ...new Set(
                            searchResults.posts
                              .map((post) => post.topic)
                              .filter(Boolean),
                          ),
                        ]
                          .slice(0, 4)
                          .map((topic) => (
                            <Link
                              key={topic}
                              to={`/search?q=${encodeURIComponent(topic)}`}
                              onClick={() => {
                                setDropdownOpen(false);
                                setSearchQuery("");
                              }}
                              className="inline-flex m-1 rounded-full bg-primary-container/40 px-3 py-1 text-xs font-semibold text-primary"
                            >
                              #{topic}
                            </Link>
                          ))}
                      </SearchGroup>
                    )}
                    {!searchResults.users.length &&
                      !searchResults.posts.length &&
                      !searchResults.pages.length && (
                        <p className="px-3 py-2 text-sm text-on-surface-variant">
                          No results yet. Try another name or keyword.
                        </p>
                      )}
                    <button
                      type="submit"
                      className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-primary hover:bg-primary-container/30"
                    >
                      See all results for “{searchQuery.trim()}”
                    </button>
                  </>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Right Action Icons / Auth Controls */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {/* Notification Bell */}
              <Link
                to="/notifications"
                className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                title="Notifications"
              >
                <span className="material-symbols-outlined text-2xl">
                  notifications
                </span>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-error text-on-error rounded-full ring-2 ring-surface text-[10px] font-bold flex items-center justify-center">
                    {unreadNotificationsCount > 99
                      ? "99+"
                      : unreadNotificationsCount}
                  </span>
                )}
              </Link>

              {/* User Avatar with Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label="Open profile menu"
                  aria-expanded={dropdownOpen}
                  className="flex min-h-11 min-w-11 items-center justify-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-primary/40 transition-all focus:outline-none"
                >
                  <Avatar
                    src={currentUser?.profileImage}
                    name={currentUser?.username || "User"}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-outline-variant/30"
                  />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-2xl shadow-stitch-modal border border-outline-variant/20 py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-4 py-2.5 border-b border-outline-variant/15">
                      <p className="font-bold text-sm text-on-surface truncate">
                        {currentUser?.username || "User"}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">
                        {currentUser?.email}
                      </p>
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-container/40 text-primary">
                        <span>{currentUser?.title || "Newcomer"}</span>
                        <span>•</span>
                        <span>{currentUser?.point || 0} pts</span>
                      </div>
                    </div>

                    <Link
                      to={`/profile/${currentUser?.username}`}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        person
                      </span>
                      My Profile
                    </Link>
                    <Link
                      to="/profile/edit"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        edit
                      </span>
                      Edit Profile
                    </Link>
                    <Link
                      to="/settings/security?tab=saved"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        bookmark
                      </span>
                      Saved Posts
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        settings
                      </span>
                      Settings
                    </Link>

                    <div className="my-1 border-t border-outline-variant/15"></div>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error-container/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-lg">
                        logout
                      </span>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-container/20 rounded-full transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2 text-sm font-semibold bg-gradient-to-br from-primary to-primary-dim text-white rounded-full shadow-sm hover:brightness-105 active:scale-95 transition-all"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SearchGroup({ title, icon, empty, children }) {
  const items = React.Children.toArray(children);
  if (!items.length && !empty) return null;
  return (
    <section className="py-1">
      <h3 className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant">
        <span className="material-symbols-outlined text-sm">{icon}</span>
        {title}
      </h3>
      {items.length ? (
        items
      ) : (
        <p className="px-3 py-1 text-xs text-on-surface-variant">{empty}</p>
      )}
    </section>
  );
}
