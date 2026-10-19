import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { pageApi } from "../api/client";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import Avatar from "../components/Avatar";
import ImageWithFallback from "../components/ImageWithFallback";

export default function PageInfoPage() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [page, setPage] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersCount, setMembersCount] = useState(null);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("about"); // 'about' | 'members' | 'requests'
  const [loading, setLoading] = useState(true);

  // Edit Page Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    pageName: "",
    title: "",
    pageDescription: "",
  });
  const [updating, setUpdating] = useState(false);

  const fetchPageDetails = useCallback(async () => {
    setLoading(true);
    setMembersCount(null);
    setMembers([]);
    setRequests([]);
    try {
      const res = await pageApi.getPageById(pageId);
      const pageData = res?.data || res;
      setPage(pageData);
      setEditForm({
        pageName: pageData?.pageName || "",
        title: pageData?.title || "",
        pageDescription: pageData?.pageDescription || "",
      });

      const canViewMembers = ["member", "moderator", "owner"].includes(
        pageData?.userRole,
      );
      if (canViewMembers) {
        try {
          const memRes = await pageApi.getPageMembers(pageId, { limit: 100 });
          const memData = memRes?.data || memRes || [];
          const memberRows = Array.isArray(memData)
            ? memData
            : memData?.membeList?.members || memData?.members || [];
          setMembers(memberRows);
          setMembersCount(
            memData?.membeList?.membersCount ?? memberRows.length,
          );
        } catch (e) {
          console.warn("Could not load community members:", e);
          error(e?.message || "Could not load community members.");
        }
      } else {
        setMembers([]);
        setMembersCount(null);
      }

      // If owner or moderator, try fetching join requests
      const isOwnerOrMod =
        currentUser &&
        (["owner", "moderator"].includes(pageData?.userRole) ||
          pageData?.owner === currentUser._id ||
          pageData?.owner?._id === currentUser._id ||
          pageData?.moderators?.includes(currentUser._id));
      if (isOwnerOrMod && pageData?.type === "private") {
        try {
          const reqRes = await pageApi.getJoinRequests(pageId);
          const reqData = reqRes?.data || reqRes || [];
          setRequests(
            Array.isArray(reqData)
              ? reqData
              : reqData?.pendingRequest || reqData?.requests || [],
          );
        } catch (e) {
          error(e?.message || "Could not load join requests.");
        }
      }
    } catch (err) {
      error(err?.message || "Could not load community information.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, error, pageId]);

  useEffect(() => {
    // Route data is synchronized with the selected community.
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchPageDetails();
  }, [fetchPageDetails]);

  const isOwner =
    currentUser &&
    (page?.userRole === "owner" ||
      page?.owner === currentUser._id ||
      page?.owner?._id === currentUser._id);
  const isModerator =
    currentUser &&
    (page?.userRole === "moderator" ||
      page?.moderators?.includes(currentUser._id));

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const formData = new FormData();
      formData.append("pageName", editForm.pageName);
      formData.append("title", editForm.title);
      formData.append("pageDescription", editForm.pageDescription);

      await pageApi.updatePage(pageId, formData);
      success("Community information updated!");
      setShowEditModal(false);
      fetchPageDetails();
    } catch (err) {
      error(err?.message || "Failed to update community details.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAppointModerator = async (userId) => {
    try {
      await pageApi.addModerator(pageId, userId);
      success("Member appointed as moderator.");
      fetchPageDetails();
    } catch (err) {
      error(err?.message || "Failed to appoint moderator.");
    }
  };

  const handleRevokeModerator = async (userId) => {
    try {
      await pageApi.removeModerator(pageId, userId);
      info("Moderator privileges revoked.");
      fetchPageDetails();
    } catch (err) {
      error(err?.message || "Failed to revoke moderator privileges.");
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (
      window.confirm(
        "Are you sure you want to remove this member from the hub?",
      )
    ) {
      try {
        await pageApi.removeMember(pageId, memberId);
        info("Member removed from community.");
        fetchPageDetails();
      } catch (err) {
        error(err?.message || "Failed to remove member.");
      }
    }
  };

  const handleJoinRequestDecision = async (requestId, decision) => {
    try {
      const request = requests.find((entry) => entry._id === requestId);
      const requestedBy = request?.requestedBy?._id || request?.requestedBy;
      if (!requestedBy) {
        throw new Error("The selected join request has no associated user.");
      }
      await pageApi.handleJoinRequest(pageId, requestedBy, decision);
      success(
        `Join request ${decision === "approved" ? "approved" : "rejected"}.`,
      );
      fetchPageDetails();
    } catch (err) {
      error(err?.message || "Failed to process request.");
    }
  };

  const handleDeletePage = async () => {
    if (
      window.confirm(
        "DANGER: Are you sure you want to permanently delete this community hub? This cannot be undone.",
      )
    ) {
      try {
        await pageApi.deletePage(pageId);
        success("Community hub deleted.");
        navigate("/pages/explore");
      } catch (err) {
        error(err?.message || "Failed to delete community hub.");
      }
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto py-24 text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-on-surface-variant">
            Loading community info...
          </p>
        </div>
      </Layout>
    );
  }

  const ownerObj = typeof page?.owner === "object" ? page?.owner : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-24 space-y-6">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            to={`/pages/${pageId}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              arrow_back
            </span>
            Back to Hub Feed
          </Link>

          {isOwner && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-1.5 rounded-xl bg-surface-container-highest hover:bg-surface-variant text-on-surface text-xs font-bold flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit Info
              </button>
              <button
                onClick={handleDeletePage}
                className="px-3 py-1.5 rounded-xl bg-error-container/20 text-error hover:bg-error-container/30 text-xs font-bold transition-all"
                title="Delete Page"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Community Banner & Hero */}
        <section className="bg-surface-container-lowest rounded-3xl overflow-hidden border border-outline-variant/15 shadow-stitch-soft">
          <div className="h-40 sm:h-52 w-full overflow-hidden bg-surface-container relative">
            <ImageWithFallback
              src={
                page?.pageProfileImage ||
                "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&auto=format&fit=crop&q=80"
              }
              alt={page?.pageName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/25" />
          </div>

          <div className="p-6 sm:p-8 -mt-10 relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dim text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-3xl">hub</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold font-headline tracking-tight text-on-surface">
                  {page?.pageName}
                </h1>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {page?.title || "Community Learning Hub"}
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-outline-variant/15 mt-6">
              <button
                onClick={() => setActiveTab("about")}
                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors text-center ${
                  activeTab === "about"
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                About & Roles
              </button>
              <button
                onClick={() => setActiveTab("members")}
                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors text-center ${
                  activeTab === "members"
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Members ({membersCount ?? "—"})
              </button>
              {(isOwner || isModerator) && page?.type === "private" && (
                <button
                  onClick={() => setActiveTab("requests")}
                  className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors text-center ${
                    activeTab === "requests"
                      ? "text-primary border-b-2 border-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Join Requests ({requests.length})
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Tab 1: About & Roles */}
        {activeTab === "about" && (
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/15 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary">
                About Community
              </h3>
              <p className="text-sm text-on-surface/90 leading-relaxed">
                {page?.pageDescription ||
                  "Welcome to our peer-driven collaborative learning hub."}
              </p>
            </div>

            {/* Owner & Moderators Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Owner */}
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 shadow-stitch-soft space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Community Owner
                  </span>
                  <span className="material-symbols-outlined text-tertiary text-lg filled">
                    stars
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar
                    src={ownerObj?.profileImage}
                    name={ownerObj?.username || "Community Founder"}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
                  />
                  <div>
                    <p className="font-bold text-sm text-on-surface">
                      {ownerObj?.username || "Community Founder"}
                    </p>
                    <p className="text-xs text-secondary font-semibold">
                      Founder & Host
                    </p>
                  </div>
                </div>
              </div>

              {/* Moderators Preview */}
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 shadow-stitch-soft space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Moderator Team
                  </span>
                  <span className="text-[10px] font-bold text-primary bg-primary-container/40 px-2 py-0.5 rounded-full">
                    {page?.moderators?.length || 0} Assigned
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Responsible for content quality, approving join requests, and
                  mentoring members.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Member Roster */}
        {activeTab === "members" && (
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-stitch-soft space-y-4">
            <h3 className="font-headline font-bold text-base text-on-surface">
              Member Roster
            </h3>
            {members.length > 0 ? (
              <div className="divide-y divide-outline-variant/10">
                {members.map((member) => {
                  const mId = member._id || member;
                  const mUsername =
                    member.username || `Member ${mId.toString().slice(-4)}`;
                  const isUserMod = page?.moderators?.includes(mId);
                  const isUserOwner =
                    page?.owner === mId || page?.owner?._id === mId;

                  return (
                    <div
                      key={mId}
                      className="py-3.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={member.profileImage}
                          name={mUsername}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-bold text-sm text-on-surface">
                            {mUsername}
                          </p>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            {isUserOwner
                              ? "Owner"
                              : isUserMod
                                ? "Moderator"
                                : "Member"}
                          </span>
                        </div>
                      </div>

                      {/* Governance controls for Owner */}
                      {isOwner && !isUserOwner && (
                        <div className="flex items-center gap-2">
                          {isUserMod ? (
                            <button
                              onClick={() => handleRevokeModerator(mId)}
                              className="px-3 py-1 bg-surface-container text-xs font-semibold rounded-lg hover:bg-surface-container-high transition-colors"
                            >
                              Revoke Mod
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAppointModerator(mId)}
                              className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-lg hover:bg-primary/20 transition-colors"
                            >
                              Make Mod
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveMember(mId)}
                            className="p-1 rounded-lg hover:bg-error-container/20 text-error transition-colors"
                            title="Remove from hub"
                          >
                            <span className="material-symbols-outlined text-base">
                              person_remove
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant py-4 text-center">
                {membersCount === null
                  ? "Join this hub to view its member roster."
                  : `${membersCount} members are currently part of this learning hub.`}
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Pending Join Requests */}
        {activeTab === "requests" && (
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-stitch-soft space-y-4">
            <h3 className="font-headline font-bold text-base text-on-surface">
              Pending Join Requests
            </h3>
            {requests.length > 0 ? (
              <div className="divide-y divide-outline-variant/10">
                {requests.map((req) => (
                  <div
                    key={req._id}
                    className="py-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-sm text-on-surface">
                        {req.requestedBy?.username || "User"}
                      </p>
                      {req.message && (
                        <p className="text-xs text-on-surface-variant mt-0.5 italic">
                          "{req.message}"
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleJoinRequestDecision(req._id, "approved")
                        }
                        className="px-4 py-1.5 bg-secondary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-secondary-dim transition-all"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          handleJoinRequestDecision(req._id, "reject")
                        }
                        className="px-4 py-1.5 bg-surface-container text-on-surface text-xs font-bold rounded-xl hover:bg-surface-container-high transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant py-8 text-center">
                No pending join requests at this time.
              </p>
            )}
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface-container-lowest rounded-3xl max-w-md w-full p-6 shadow-stitch-modal border border-outline-variant/20 space-y-4">
              <h3 className="font-headline font-bold text-lg text-on-surface">
                Update Community Details
              </h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Hub Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.pageName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, pageName: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl text-sm border-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Tagline
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm({ ...editForm, title: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl text-sm border-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={editForm.pageDescription}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        pageDescription: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl text-sm border-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dim shadow-sm disabled:opacity-50"
                  >
                    {updating ? "Saving..." : "Save Changes"}
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
