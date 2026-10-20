import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { notificationApi } from "../api/client";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import { getSocket } from "../api/socket";
import Avatar from "../components/Avatar";

const COMMUNITY_NOTIFICATION_TYPES = new Set([
  "page_join",
  "page_removed",
  "page_deleted",
  "mod_appointed",
  "mod_removed",
  "join_request",
  "request_approved",
  "request_rejected",
]);

export default function NotificationsPage() {
  const { setUnreadNotificationsCount } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all"); // 'all' | 'reply' | 'page' | 'vote'
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.getNotifications({
        page: 1,
        limit: 30,
      });
      const data = res?.data || res || [];
      const notifList = Array.isArray(data)
        ? data
        : data?.notifications || data?.data?.notifications || [];
      setNotifications((current) => {
        const fetchedIds = new Set(
          notifList.map(notificationId).filter(Boolean),
        );
        const liveOnly = current.filter((item) => {
          const id = notificationId(item);
          return id ? !fetchedIds.has(id) : false;
        });
        return [...liveOnly, ...notifList];
      });
      setUnreadNotificationsCount(notifList.filter((n) => !n.isRead).length);
    } catch (err) {
      error(err?.message || "Couldn't load notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [error, setUnreadNotificationsCount]);

  useEffect(() => {
    // Fetching notifications is an external synchronization triggered by route entry.
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchNotifications();

    const socket = getSocket();
    const handleLiveNotification = (newNotif) => {
      if (!newNotif || typeof newNotif !== "object") return;
      setNotifications((prev) => {
        const id = notificationId(newNotif);
        if (id && prev.some((item) => notificationId(item) === id)) return prev;
        return [newNotif, ...prev];
      });
    };

    socket.on("notification", handleLiveNotification);
    return () => {
      socket.off("notification", handleLiveNotification);
    };
  }, [fetchNotifications, setUnreadNotificationsCount]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotificationsCount(0);
      success("All notifications marked as read.");
    } catch (err) {
      error(err?.message || "Failed to mark notifications as read.");
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead && notif._id) {
      try {
        await notificationApi.markAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)),
        );
        setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        error(err?.message || "Couldn't mark this notification as read.");
      }
    }

    const target = getNotificationTarget(notif);
    if (target) {
      navigate(target.path);
    } else if (notif.type === "follow") {
      const username = notif.sender?.username || notif.user?.username;
      if (username) navigate(`/profile/${encodeURIComponent(username)}`);
    }
  };

  const filteredNotifs = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "reply")
      return n.type?.includes("comment") || n.type?.includes("reply");
    if (filter === "page")
      return (
        n.type?.includes("page") ||
        n.type?.includes("community") ||
        COMMUNITY_NOTIFICATION_TYPES.has(n.type)
      );
    if (filter === "vote")
      return n.type?.includes("vote") || n.type?.includes("helpful");
    return true;
  });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-6">
        {/* Editorial Header */}
        <div className="flex items-end justify-between border-b border-outline-variant/15 pb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-headline tracking-tight text-on-surface">
              Alerts & Inbox
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Stay updated with your questions, solutions, and community hubs.
            </p>
          </div>

          <button
            onClick={handleMarkAllRead}
            className="min-h-11 text-primary font-bold text-xs hover:underline px-4 py-2 bg-primary-container/30 rounded-xl transition-colors"
          >
            Mark all as read
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setFilter("all")}
            className={`min-h-11 px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
              filter === "all"
                ? "bg-primary text-white shadow-primary/20"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            All Activity
          </button>
          <button
            onClick={() => setFilter("reply")}
            className={`min-h-11 px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
              filter === "reply"
                ? "bg-primary text-white shadow-primary/20"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            Replies & Comments
          </button>
          <button
            onClick={() => setFilter("vote")}
            className={`min-h-11 px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
              filter === "vote"
                ? "bg-primary text-white shadow-primary/20"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            Votes & Helpful
          </button>
          <button
            onClick={() => setFilter("page")}
            className={`min-h-11 px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
              filter === "page"
                ? "bg-primary text-white shadow-primary/20"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            Community Hubs
          </button>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-on-surface-variant">
              Checking notifications...
            </p>
          </div>
        ) : filteredNotifs.length > 0 ? (
          <div className="space-y-3">
            {filteredNotifs.map((notif, index) => {
              const sender = notif.sender ||
                notif.user || { username: "A member" };
              const isUnread = !notif.isRead;

              return (
                <div
                  key={notificationId(notif) ?? index}
                  onClick={() => handleNotificationClick(notif)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void handleNotificationClick(notif);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-stitch-soft hover:shadow-stitch-ambient ${
                    isUnread
                      ? "bg-surface-container-lowest border-l-4 border-l-primary border-outline-variant/20"
                      : "bg-surface-container-low/60 border-outline-variant/10 opacity-85"
                  }`}
                >
                  <div className="flex gap-4 items-start">
                    <div className="relative flex-shrink-0">
                      <Avatar
                        src={sender.profileImage}
                        name={sender.username || "A member"}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-primary-container"
                      />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">
                        <span className="material-symbols-outlined text-xs">
                          {notif.type === "join_request"
                            ? "person_add"
                            : notif.type === "request_approved"
                              ? "check_circle"
                              : notif.type === "request_rejected"
                                ? "person_remove"
                                : COMMUNITY_NOTIFICATION_TYPES.has(notif.type)
                                  ? "groups"
                                  : notif.type?.includes("helpful")
                                    ? "verified"
                                    : notif.type?.includes("vote")
                                      ? "thumb_up"
                                      : "reply"}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-on-surface leading-snug truncate">
                          <strong className="text-primary font-bold">
                            {sender.username}
                          </strong>{" "}
                          {notif.message || notificationMessage(notif.type)}
                        </p>
                        <span className="text-[11px] text-on-surface-variant font-medium whitespace-nowrap">
                          {notif.createdAt
                            ? formatRelativeTime(notif.createdAt)
                            : "Recent"}
                        </span>
                      </div>

                      {notif.contentSnippet && (
                        <p className="text-xs text-on-surface-variant mt-1.5 p-2 rounded-xl bg-surface-container line-clamp-2 italic">
                          "{notif.contentSnippet}"
                        </p>
                      )}
                      {(notif.post?.title || notif.page?.pageName) && (
                        <p className="mt-1.5 truncate text-xs font-medium text-on-surface-variant">
                          {notif.post?.title || notif.page?.pageName}
                        </p>
                      )}
                      {getNotificationTarget(notif) ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-primary">
                          {getNotificationTarget(notif).label}
                          <span
                            className="material-symbols-outlined text-sm"
                            aria-hidden="true"
                          >
                            arrow_outward
                          </span>
                        </span>
                      ) : notif.type === "follow" &&
                        (sender.username || notif.user?.username) ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-primary">
                          View profile
                          <span
                            className="material-symbols-outlined text-sm"
                            aria-hidden="true"
                          >
                            arrow_outward
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
            <span className="material-symbols-outlined text-5xl text-outline mb-2">
              notifications_none
            </span>
            <h3 className="font-headline font-bold text-lg text-on-surface">
              You're all caught up!
            </h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1">
              When peers answer your questions, upvote your guides, or request
              hub access, alerts will appear here.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

function notificationId(notification) {
  const id = notification?._id || notification?.id;
  return id == null ? null : String(id);
}

function getNotificationTarget(notification) {
  const idOf = (value) => value?._id || value?.id || value;
  // Older community notifications sometimes stored their page id in `post`.
  const pageId =
    idOf(notification?.page) ||
    (COMMUNITY_NOTIFICATION_TYPES.has(notification?.type)
      ? idOf(notification?.post)
      : null);
  if (pageId) {
    const pagePath = `/pages/${pageId}`;
    return {
      path:
        notification.type === "join_request"
          ? `${pagePath}/info?tab=requests`
          : pagePath,
      label:
        notification.type === "join_request"
          ? "Review community request"
          : "View community",
    };
  }
  const postId = idOf(notification?.post);
  if (postId)
    return {
      path: `/posts/${postId}/comments`,
      label: "View post and discussion",
    };
  return null;
}

function notificationMessage(type) {
  const messages = {
    comment: "commented on your post",
    reply: "replied to your comment",
    post_upvote: "upvoted your post",
    post_downvote: "downvoted your post",
    comment_upvote: "upvoted your comment",
    helpful: "marked your comment helpful",
    pinned: "pinned your comment",
    follow: "started following you",
    page_join: "joined your community",
    page_removed: "removed you from a community",
    page_deleted: "deleted a community you belonged to",
    mod_appointed: "made you a community moderator",
    mod_removed: "removed your community moderator role",
    join_request: "requested to join your community",
    request_approved: "approved your community request",
    request_rejected: "declined your community request",
  };
  return messages[type] || "sent you an update";
}

function formatRelativeTime(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Recent";
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60_000),
  );
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
