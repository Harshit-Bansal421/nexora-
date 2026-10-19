import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { pageApi } from "../api/client";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import ImageWithFallback from "../components/ImageWithFallback";

export default function PageExplorePage() {
  const { currentUser, isAuthenticated } = useAuth();
  const { success, error, info } = useToast();

  const [pages, setPages] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [joiningPageId, setJoiningPageId] = useState(null);
  const [pendingRequestIds, setPendingRequestIds] = useState(() => new Set());

  // Modal for creating a new community page
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    pageName: "",
    title: "",
    pageDescription: "",
    type: "open",
  });
  const [createImageFile, setCreateImageFile] = useState(null);
  const [creating, setCreating] = useState(false);

  const fetchPages = async (searchTerm = "") => {
    try {
      const res = await pageApi.getPages({ search: searchTerm, limit: 30 });
      const data = res?.data || res || [];
      const pageRows = Array.isArray(data) ? data : data?.pages || [];
      const enrichedPages = await Promise.all(
        pageRows.map(async (page) => {
          try {
            const detailRes = await pageApi.getPageById(page._id);
            const details = detailRes?.data || detailRes;
            const enriched = { ...page, ...details };
            if (["member", "moderator", "owner"].includes(details?.userRole)) {
              const membersRes = await pageApi.getPageMembers(page._id, {
                limit: 100,
              });
              const memberData = membersRes?.data || membersRes;
              const members =
                memberData?.membeList?.members || memberData?.members;
              if (Array.isArray(members)) {
                enriched.members = members.map((member) =>
                  typeof member === "string" ? member : member._id,
                );
                enriched.membersCount =
                  memberData?.membeList?.membersCount ?? members.length;
              }
            }
            return enriched;
          } catch (err) {
            console.warn(
              `Could not load membership details for ${page.pageName}:`,
              err,
            );
            return page;
          }
        }),
      );
      setPages(enrichedPages);
    } catch (err) {
      console.warn("Error fetching pages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Community data is loaded when the explore route opens.
    // oxlint-disable-next-line react/set-state-in-effect
    fetchPages();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    fetchPages(search.trim());
  };

  const handleJoinToggle = async (page) => {
    if (!isAuthenticated) {
      info("Please log in to join community hubs.");
      return;
    }

    const isMember =
      ["member", "moderator", "owner"].includes(page.userRole) ||
      page.members?.includes(currentUser?._id);
    if (
      page.userRole === "owner" ||
      page.owner?._id === currentUser?._id ||
      page.owner === currentUser?._id
    ) {
      info("Page owners cannot leave their own community.");
      return;
    }

    setJoiningPageId(page._id);
    try {
      if (isMember) {
        await pageApi.leavePage(page._id);
        info(`Left ${page.pageName}`);
      } else if (page.type === "private") {
        await pageApi.joinPage(page._id);
        setPendingRequestIds((current) => new Set(current).add(page._id));
        success(`Join request sent to ${page.pageName}.`);
      } else {
        await pageApi.joinPage(page._id);
        success(`Successfully joined ${page.pageName}!`);
      }
      if (isMember || page.type !== "private") {
        fetchPages(search.trim());
      }
    } catch (err) {
      error(err?.message || "Could not update membership.");
    } finally {
      setJoiningPageId(null);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCreateImageFile(file);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (
      !createForm.pageName.trim() ||
      !createForm.title.trim() ||
      !createForm.pageDescription.trim()
    ) {
      error("Please fill in all required fields.");
      return;
    }

    setCreating(true);
    try {
      const formData = new FormData();
      formData.append("pageName", createForm.pageName.trim());
      formData.append("title", createForm.title.trim());
      formData.append("pageDescription", createForm.pageDescription.trim());
      formData.append("type", createForm.type);
      if (createImageFile) {
        formData.append("pageProfileImage", createImageFile);
      }

      await pageApi.createPage(formData);
      success("Community hub created successfully!");
      setShowCreateModal(false);
      setCreateForm({
        pageName: "",
        title: "",
        pageDescription: "",
        type: "open",
      });
      setCreateImageFile(null);
      fetchPages();
    } catch (err) {
      error(err?.message || "Failed to create community hub.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-8">
        {/* Header & Create Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-headline tracking-tight text-on-surface">
              Explore Community Hubs
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Find dedicated communities to learn, solve questions, and share
              knowledge.
            </p>
          </div>

          <button
            onClick={() => {
              if (!isAuthenticated) {
                info("Please sign in to create a community hub.");
                return;
              }
              setShowCreateModal(true);
            }}
            className="px-6 py-3 bg-gradient-to-br from-primary to-primary-dim text-white font-bold text-xs rounded-full shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 w-fit"
          >
            <span className="material-symbols-outlined text-lg">
              add_circle
            </span>
            <span>Create Community Hub</span>
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-outline">
            <span className="material-symbols-outlined text-xl">search</span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find your community hub by name or topic..."
            className="w-full bg-surface-container-lowest border border-outline-variant/20 h-14 sm:h-16 pl-14 pr-6 rounded-2xl shadow-stitch-soft focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all text-sm sm:text-base font-medium"
          />
        </form>

        {/* Hubs Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-on-surface-variant">
              Loading learning hubs...
            </p>
          </div>
        ) : pages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pages.map((page) => {
              const isMember =
                currentUser &&
                (["member", "moderator", "owner"].includes(page.userRole) ||
                  page.members?.includes(currentUser._id));
              const isOwner =
                currentUser &&
                (page.owner === currentUser._id ||
                  page.owner?._id === currentUser._id);
              const memberCount =
                page.membersCount > 0
                  ? page.membersCount
                  : Array.isArray(page.members)
                    ? page.members.length
                    : null;

              return (
                <div
                  key={page._id}
                  className="bg-surface-container-lowest rounded-3xl overflow-hidden border border-outline-variant/15 shadow-stitch-soft hover:shadow-stitch-ambient transition-all duration-300 flex flex-col justify-between group"
                >
                  {/* Banner / Cover */}
                  <div className="h-40 relative overflow-hidden bg-surface-container">
                    <ImageWithFallback
                      src={
                        page.pageProfileImage ||
                        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80"
                      }
                      alt={page.pageName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/80 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-on-surface uppercase tracking-wider backdrop-blur-sm">
                      {page.type || "Open"}
                    </div>
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="text-white font-headline font-bold text-xl drop-shadow-sm truncate">
                        {page.pageName}
                      </h3>
                      <p className="text-white/80 text-xs truncate">
                        {page.title || "Learning Community"}
                      </p>
                    </div>
                  </div>

                  {/* Body & Actions */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                      {page.pageDescription ||
                        "Welcome to this hub for collaboration and discussions."}
                    </p>

                    <div className="pt-3 border-t border-outline-variant/10 flex items-center justify-between">
                      <span className="text-xs text-on-surface-variant font-medium flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">
                          groups
                        </span>
                        {memberCount === null
                          ? "Member count unavailable"
                          : `${memberCount} members`}
                      </span>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/pages/${page._id}`}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-primary hover:bg-primary-container/20 transition-colors"
                        >
                          Visit
                        </Link>
                        <button
                          onClick={() => handleJoinToggle(page)}
                          disabled={
                            joiningPageId === page._id ||
                            isOwner ||
                            pendingRequestIds.has(page._id)
                          }
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                            isMember || isOwner
                              ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                              : "bg-primary text-white hover:bg-primary-dim"
                          }`}
                        >
                          {joiningPageId === page._id
                            ? "..."
                            : isOwner
                              ? "Owner"
                              : isMember
                                ? "Joined"
                                : pendingRequestIds.has(page._id)
                                  ? "Requested"
                                  : page.type === "private"
                                    ? "Request to Join"
                                    : "Join"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
            <span className="material-symbols-outlined text-5xl text-outline mb-2">
              groups
            </span>
            <h3 className="font-headline font-bold text-xl text-on-surface">
              No community hubs found
            </h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1 mb-5">
              Be the leader to build the first collaborative hub for your peers!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm hover:bg-primary-dim transition-all"
            >
              Create Community Hub
            </button>
          </div>
        )}

        {/* Create Hub Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface-container-lowest rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-stitch-modal border border-outline-variant/20 space-y-6">
              <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-2xl text-primary">
                    add_circle
                  </span>
                  <h3 className="font-headline font-bold text-xl text-on-surface">
                    Create Community Hub
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">
                    close
                  </span>
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Hub Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.pageName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, pageName: e.target.value })
                    }
                    placeholder="e.g. Next.js Builders"
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Tagline / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, title: e.target.value })
                    }
                    placeholder="e.g. For React developers solving architecture challenges"
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Description *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={createForm.pageDescription}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        pageDescription: e.target.value,
                      })
                    }
                    placeholder="Describe what members will learn, ask, and share here..."
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Hub Access Type
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value="open"
                        checked={createForm.type === "open"}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, type: e.target.value })
                        }
                        className="text-primary focus:ring-primary/20"
                      />
                      <span>Open (Anyone can join)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value="private"
                        checked={createForm.type === "private"}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, type: e.target.value })
                        }
                        className="text-primary focus:ring-primary/20"
                      />
                      <span>Private (Approval required)</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Hub Cover Image (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="block w-full text-xs text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary file:text-white hover:file:bg-primary-dim cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dim transition-all shadow-sm disabled:opacity-50"
                  >
                    {creating ? "Creating Hub..." : "Create Hub"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
