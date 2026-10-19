import React, { useRef, useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import PostCard from "../components/PostCard";
import { postApi, pageApi } from "../api/client";
import ImageWithFallback from "../components/ImageWithFallback";

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery =
    searchParams.get("q") || searchParams.get("search") || "";

  const searchInput = useRef(null);
  const [activeTab, setActiveTab] = useState("posts"); // 'posts' | 'pages'
  const [postsResults, setPostsResults] = useState([]);
  const [pagesResults, setPagesResults] = useState([]);
  const [resultsQuery, setResultsQuery] = useState("");
  const loading = Boolean(initialQuery && resultsQuery !== initialQuery);

  const performSearch = useCallback(async (searchTerm) => {
    if (!searchTerm.trim()) return;

    try {
      const [postsRes, pagesRes] = await Promise.allSettled([
        postApi.searchPosts(searchTerm),
        pageApi.getPages({ search: searchTerm }),
      ]);

      if (postsRes.status === "fulfilled") {
        const postsData = postsRes.value?.data || postsRes.value || [];
        setPostsResults(
          Array.isArray(postsData) ? postsData : postsData?.posts || [],
        );
      } else {
        setPostsResults([]);
      }

      if (pagesRes.status === "fulfilled") {
        const pagesData = pagesRes.value?.data || pagesRes.value || [];
        setPagesResults(
          Array.isArray(pagesData) ? pagesData : pagesData?.pages || [],
        );
      } else {
        setPagesResults([]);
      }
    } catch (err) {
      console.warn("Search error:", err);
    } finally {
      setResultsQuery(searchTerm);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      // This effect synchronizes browser history changes with the search API.
      // oxlint-disable-next-line react/set-state-in-effect
      void performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const query = String(new FormData(e.currentTarget).get("q") || "").trim();
    if (query) {
      setResultsQuery("");
      if (query === initialQuery) {
        void performSearch(query);
      } else {
        setSearchParams({ q: query });
      }
    }
  };

  const handleClear = () => {
    if (searchInput.current) searchInput.current.value = "";
    setPostsResults([]);
    setPagesResults([]);
    setResultsQuery("");
    setSearchParams({});
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-6">
        {/* Search Header */}
        <div className="space-y-4">
          <form
            key={initialQuery}
            onSubmit={handleSubmit}
            className="relative group"
          >
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline">
              <span className="material-symbols-outlined text-xl">search</span>
            </div>
            <input
              ref={searchInput}
              type="text"
              name="q"
              defaultValue={initialQuery}
              placeholder="Search for questions, keywords, or learning hubs..."
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl py-4 pl-12 pr-24 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-stitch-soft text-base transition-all"
            />
            {initialQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute inset-y-0 right-4 flex items-center text-xs font-bold text-outline hover:text-on-surface transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          {/* Results Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("posts")}
              className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                activeTab === "posts"
                  ? "bg-primary text-on-primary shadow-primary/20"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              <span>Discussions & Questions</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px]">
                {postsResults.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("pages")}
              className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                activeTab === "pages"
                  ? "bg-primary text-on-primary shadow-primary/20"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              <span>Community Hubs</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px]">
                {pagesResults.length}
              </span>
            </button>
          </div>
        </div>

        {/* Results Body */}
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-on-surface-variant">
              Searching Nexora knowledge base...
            </p>
          </div>
        ) : activeTab === "posts" ? (
          // Posts Results
          postsResults.length > 0 ? (
            <div className="space-y-4">
              {postsResults.map((post) => (
                <PostCard key={post._id} post={post} />
              ))}
            </div>
          ) : initialQuery ? (
            <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">
                search_off
              </span>
              <h3 className="font-headline font-bold text-lg text-on-surface">
                No discussions found
              </h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1">
                We couldn't find any questions matching "{initialQuery}". Try
                different keywords or start a new request!
              </p>
              <Link
                to="/posts/new"
                className="mt-4 inline-flex items-center gap-1 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm hover:bg-primary-dim transition-all"
              >
                <span>Ask about this</span>
                <span className="material-symbols-outlined text-base">
                  arrow_forward
                </span>
              </Link>
            </div>
          ) : (
            <div className="text-center py-16 text-on-surface-variant text-sm">
              Type keywords above to discover answers and discussions across all
              topics.
            </div>
          )
        ) : // Pages Results
        pagesResults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pagesResults.map((page) => (
              <div
                key={page._id}
                className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-stitch-soft hover:shadow-stitch-ambient transition-all flex items-start gap-4"
              >
                <ImageWithFallback
                  src={
                    page.pageProfileImage ||
                    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=200&auto=format&fit=crop&q=80"
                  }
                  alt={page.pageName}
                  className="w-14 h-14 rounded-xl object-cover ring-1 ring-outline-variant/30 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-base text-on-surface truncate font-headline">
                      {page.pageName}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-primary">
                      {page.type || "Open"}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-2 mt-1">
                    {page.pageDescription || "Community page"}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">
                        groups
                      </span>
                      {page.members?.length || 1} members
                    </span>
                    <Link
                      to={`/pages/${page._id}`}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Visit Page →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : initialQuery ? (
          <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">
              hub
            </span>
            <h3 className="font-headline font-bold text-lg text-on-surface">
              No community hubs found
            </h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1">
              No existing pages match "{initialQuery}". You can create a new
              learning hub!
            </p>
            <Link
              to="/pages/explore"
              className="mt-4 inline-flex items-center gap-1 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm hover:bg-primary-dim transition-all"
            >
              <span>Explore all hubs</span>
            </Link>
          </div>
        ) : (
          <div className="text-center py-16 text-on-surface-variant text-sm">
            Search by community hub name or description.
          </div>
        )}
      </div>
    </Layout>
  );
}
