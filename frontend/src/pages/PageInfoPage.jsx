import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { pageApi } from "../api/client";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import Avatar from "../components/Avatar";
import ImageWithFallback from "../components/ImageWithFallback";

export default function PageInfoPage() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { success, error } = useToast();

  const [page, setPage] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersCount, setMembersCount] = useState(null);
  const [memberMatchingCount, setMemberMatchingCount] = useState(0);
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotalPages, setMemberTotalPages] = useState(1);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchInput, setMemberSearchInput] = useState("");
  const [memberBusyId, setMemberBusyId] = useState(null);
  const [memberAction, setMemberAction] = useState(null);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "requests" ? "requests" : "about",
  ); // 'about' | 'members' | 'requests'
  const [loading, setLoading] = useState(true);
  const loadedPageId = useRef(null);

  // Edit Page Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    pageName: "",
    title: "",
    pageDescription: "",
    type: "open",
  });
  const [updating, setUpdating] = useState(false);

  const fetchPageDetails = useCallback(async () => {
    const isNewPage = loadedPageId.current !== pageId;
    if (isNewPage) {
      loadedPageId.current = pageId;
      setLoading(true);
      setMembersCount(null);
      setMemberMatchingCount(0);
      setMembers([]);
      setRequests([]);
    }
    try {
      const res = await pageApi.getPageById(pageId);
      const pageData = res?.data || res;
      setPage(pageData);
      setEditForm({
        pageName: pageData?.pageName || "",
        title: pageData?.title || "",
        pageDescription: pageData?.pageDescription || "",
        type: pageData?.type || "open",
      });

      const canViewMembers = ["member", "moderator", "owner"].includes(
        pageData?.userRole,
      );
      if (canViewMembers) {
        try {
          const memRes = await pageApi.getPageMembers(pageId, { limit: 10, page: memberPage, search: memberSearch });
          const memData = memRes?.data || memRes || [];
          const memberRows = Array.isArray(memData)
            ? memData
            : memData?.membeList?.members || memData?.members || [];
          setMembers(memberRows);
          setMembersCount(
            memData?.membeList?.membersCount ?? memData?.pagination?.total ?? memberRows.length,
          );
          setMemberTotalPages(memData?.pagination?.totalPages ?? 1);
          setMemberMatchingCount(memData?.pagination?.total ?? memberRows.length);
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
  }, [currentUser, error, pageId, memberPage, memberSearch]);

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
      formData.append("type", editForm.type);

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

  const updateRosterFromResponse = (response, userId, changes = {}) => {
    const data = response?.data || response || {};
    setMembers((current) => current.map((member) =>
      String(member?._id || member) === String(userId) ? { ...member, ...changes, ...(data.member || {}) } : member,
    ));
    if (Number.isFinite(data.membersCount)) {
      setMembersCount(data.membersCount);
      setPage((current) => ({ ...current, membersCount: data.membersCount }));
    }
    if (Number.isFinite(data.moderatorsCount)) {
      setPage((current) => ({ ...current, moderatorsCount: data.moderatorsCount }));
    }
  };

  const handleAppointModerator = async (member) => {
    const userId = member?._id || member;
    setMemberBusyId(String(userId));
    try {
      const response = await pageApi.addModerator(pageId, userId);
      updateRosterFromResponse(response, userId, { isModerator: true });
      success(`${member.username} is now a moderator`);
    } catch (err) {
      error(err?.message || "Failed to appoint moderator.");
    } finally {
      setMemberBusyId(null);
    }
  };

  const handleRevokeModerator = async (member) => {
    const userId = member?._id || member;
    setMemberBusyId(String(userId));
    try {
      const response = await pageApi.removeModerator(pageId, userId);
      updateRosterFromResponse(response, userId, { isModerator: false });
      setMemberAction(null);
      success(`${member.username} is no longer a moderator`);
    } catch (err) {
      error(err?.message || "Failed to revoke moderator privileges.");
    } finally {
      setMemberBusyId(null);
    }
  };

  const handleRemoveMember = async (member) => {
    const memberId = member?._id || member;
    setMemberBusyId(String(memberId));
    try {
      const response = await pageApi.removeMember(pageId, memberId);
      const data = response?.data || response || {};
      setMembers((current) => current.filter((row) => String(row?._id || row) !== String(memberId)));
      setMemberMatchingCount((count) => Math.max(0, count - 1));
      if (Number.isFinite(data.membersCount)) {
        setMembersCount(data.membersCount);
        setPage((current) => ({ ...current, membersCount: data.membersCount }));
      } else {
        setMembersCount((count) => Math.max(0, (count ?? members.length) - 1));
      }
      setMemberAction(null);
      success(`${member.username} was removed from the community`);
    } catch (err) {
      error(err?.message || "Failed to remove member.");
    } finally {
      setMemberBusyId(null);
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
                page?.pageCoverImage
              }
              alt={`${page?.pageName || "Community"} cover`}
              className="w-full h-full object-cover"
              fallback={<div role="img" aria-label={`${page?.pageName || "Community"} cover`} className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-secondary text-white"><span className="text-4xl font-extrabold tracking-widest">{page?.pageName?.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "N"}</span></div>}
            />
            <div className="absolute inset-0 bg-black/25" />
          </div>

          <div className="p-6 sm:p-8 -mt-10 relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dim text-white flex items-center justify-center shadow-md">
                <ImageWithFallback src={page?.pageProfileImage} alt={`${page?.pageName || "Community"} icon`} className="w-full h-full rounded-2xl object-cover" fallback={<span className="font-bold text-xl">{page?.pageName?.slice(0, 2)?.toUpperCase() || "N"}</span>} />
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
                    {page?.moderatorsCount ?? page?.moderators?.length ?? 0} Assigned
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
            <input
              type="search"
              value={memberSearchInput}
              onChange={(event) => {
                setMemberSearchInput(event.target.value);
                setMemberSearch(event.target.value.trim());
                setMemberPage(1);
              }}
              placeholder="Search members by username"
              aria-label="Search members by username"
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            {members.length > 0 ? (
              <div className="divide-y divide-outline-variant/10">
                {members.map((member) => {
                  const mId = member._id || member;
                  const mUsername = member.username;
                  const isUserMod = Boolean(member.isModerator) || page?.moderators?.some((id) => String(id?._id || id) === String(mId));
                  const isUserOwner = String(page?.owner?._id || page?.owner) === String(mId) || Boolean(member.isOwner);
                  const isSelf = String(currentUser?._id) === String(mId);
                  const rowBusy = memberBusyId === String(mId);

                  return (
                    <div
                      key={mId}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      {mUsername ? (
                        <Link to={`/profile/${encodeURIComponent(mUsername)}`} className="inline-flex min-h-11 min-w-11 items-center gap-3 rounded-xl pr-2 text-on-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                          <Avatar src={member.profileImage} name={mUsername} className="w-10 h-10 rounded-full object-cover" />
                          <span className="min-w-0">
                            <span className="block truncate font-bold text-sm">{mUsername}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                              {isUserOwner ? "Owner" : isUserMod ? <><span>Member</span><span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">MOD</span></> : "Member"}
                            </span>
                          </span>
                        </Link>
                      ) : (
                        <div className="inline-flex min-h-11 min-w-11 items-center gap-3 rounded-xl pr-2">
                          <Avatar src={member.profileImage} name="Member" className="w-10 h-10 rounded-full object-cover" />
                          <span className="font-bold text-sm text-on-surface">Member</span>
                        </div>
                      )}

                      {/* Governance controls for Owner */}
                      {isOwner && !isUserOwner && !isSelf && (
                        <div className="flex items-center gap-2">
                          {isUserMod ? (
                            <button
                              disabled={rowBusy}
                              onClick={() => setMemberAction({ type: "moderator", member })}
                              className="min-h-11 rounded-lg bg-surface-container px-3 text-xs font-semibold hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                            >
                              Remove Mod
                            </button>
                          ) : (
                            <button
                              disabled={rowBusy}
                              onClick={() => handleAppointModerator(member)}
                              className="min-h-11 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                            >
                              {rowBusy ? "Working…" : "Make Mod"}
                            </button>
                          )}
                          <button
                            disabled={rowBusy}
                            onClick={() => setMemberAction({ type: "member", member })}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-error transition-colors hover:bg-error-container/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error disabled:opacity-50"
                            title={`Remove ${mUsername || "member"} from hub`}
                            aria-label={`Remove ${mUsername || "member"} from hub`}
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
                {memberSearch
                  ? "No members match this username."
                  : membersCount === null
                  ? "Join this hub to view its member roster."
                  : `${membersCount} members are currently part of this learning hub.`}
              </p>
            )}
            {memberMatchingCount > 0 && (
              <div className="flex items-center justify-between gap-3 pt-2 text-sm">
                <span className="text-on-surface-variant">{memberSearch ? `${memberMatchingCount} matching members` : `${membersCount} members`}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={memberPage <= 1} onClick={() => setMemberPage((pageNumber) => pageNumber - 1)} className="min-h-11 rounded-lg px-3 hover:bg-surface-container disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Previous</button>
                  <span aria-live="polite">{memberPage} / {memberTotalPages}</span>
                  <button type="button" disabled={memberPage >= memberTotalPages} onClick={() => setMemberPage((pageNumber) => pageNumber + 1)} className="min-h-11 rounded-lg px-3 hover:bg-surface-container disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Next</button>
                </div>
              </div>
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

        {memberAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <section role="dialog" aria-modal="true" aria-labelledby="member-action-title" className="w-full max-w-sm space-y-4 rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
              <h2 id="member-action-title" className="font-headline text-lg font-bold text-on-surface">
                {memberAction.type === "member" ? "Remove member?" : "Remove moderator?"}
              </h2>
              <p className="text-sm text-on-surface-variant">
                {memberAction.member.username || "This member"} will {memberAction.type === "member" ? "lose access to this community" : "no longer have moderator permissions"}.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setMemberAction(null)} className="min-h-11 rounded-lg px-4 font-semibold hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Cancel</button>
                <button type="button" disabled={memberBusyId === String(memberAction.member?._id || memberAction.member)} onClick={() => memberAction.type === "member" ? handleRemoveMember(memberAction.member) : handleRevokeModerator(memberAction.member)} className="min-h-11 rounded-lg bg-error px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error disabled:opacity-50">{memberBusyId ? "Working…" : "Confirm"}</button>
              </div>
            </section>
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

                <fieldset className="space-y-2">
                  <legend className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Community access
                  </legend>
                  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-on-surface">
                    <input
                      type="radio"
                      name="community-access"
                      value="open"
                      checked={editForm.type === "open"}
                      onChange={() => setEditForm({ ...editForm, type: "open" })}
                    />
                    Public (anyone can join)
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-on-surface">
                    <input
                      type="radio"
                      name="community-access"
                      value="private"
                      checked={editForm.type === "private"}
                      onChange={() => setEditForm({ ...editForm, type: "private" })}
                    />
                    Private (approval required)
                  </label>
                  <p className="text-xs text-on-surface-variant">
                    Private communities remain discoverable, but only members can view their posts.
                  </p>
                </fieldset>

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
