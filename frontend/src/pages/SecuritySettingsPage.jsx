import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import { authApi, postApi } from "../api/client";
import PostCard from "../components/PostCard";

export default function SecuritySettingsPage() {
  const { currentUser, logoutAll } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Change password states
  const [passwords, setPasswords] = useState({
    oldpassword: "",
    newpassword: "",
    confirmpassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Saved posts vault states
  const [savedPosts, setSavedPosts] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const activeTab = searchParams.get("tab") === "saved" ? "saved" : "security";
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  useEffect(() => {
    let isMounted = true;
    const fetchSaved = async () => {
      try {
        const res = await postApi.getSavedPosts({ page: 1, limit: 10 });
        if (isMounted) {
          const data = res?.data || res || [];
          const records = Array.isArray(data)
            ? data
            : data?.savedPosts || data?.savedPost || data?.posts || [];
          setSavedPosts(
            records.map((record) => ({
              ...(record?.post || record),
              isSaved: true,
            })),
          );
        }
      } catch (err) {
        console.warn("Could not load saved posts:", err);
      } finally {
        if (isMounted) setLoadingSaved(false);
      }
    };

    fetchSaved();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (
      !passwords.oldpassword ||
      !passwords.newpassword ||
      !passwords.confirmpassword
    ) {
      error("Please fill in all password fields.");
      return;
    }
    if (passwords.newpassword !== passwords.confirmpassword) {
      error("New password and confirm password do not match.");
      return;
    }
    if (passwords.newpassword.length < 5) {
      error("New password must be at least 5 characters long.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await authApi.changePassword(passwords);
      success("Password updated successfully!");
      setPasswords({ oldpassword: "", newpassword: "", confirmpassword: "" });
    } catch (err) {
      error(
        err?.message ||
          "Failed to update password. Verify your current password.",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    if (
      window.confirm(
        "Are you sure you want to log out of all active sessions across all devices?",
      )
    ) {
      await logoutAll();
      success("Logged out from all devices.");
      navigate("/login");
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-24">
        {/* Top Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-headline tracking-tight text-on-surface">
              Security & Saved Vault
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Manage your password, devices, and bookmarked community
              contributions.
            </p>
          </div>

          {/* Tab Filter */}
          <div className="flex bg-surface-container-low p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab("security")}
              aria-pressed={activeTab === "security"}
              className={`min-h-11 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "security"
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Security & Passwords
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              aria-pressed={activeTab === "saved"}
              className={`min-h-11 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "saved"
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span>Saved Vault</span>
              <span className="w-5 h-5 rounded-full bg-primary-container text-primary flex items-center justify-center text-[10px]">
                {savedPosts.length}
              </span>
            </button>
          </div>
        </div>

        {activeTab === "security" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Change Password Form */}
            <div className="lg:col-span-7 bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-stitch-soft border border-outline-variant/15 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-container/40 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl">
                    vpn_key
                  </span>
                </div>
                <div>
                  <h2 className="font-headline font-bold text-xl text-on-surface">
                    Change Password
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Keep your account secure with regular updates
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                    Current Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={passwords.oldpassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        oldpassword: e.target.value,
                      })
                    }
                    placeholder="Enter current password"
                    className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      New Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={passwords.newpassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        newpassword: e.target.value,
                      })
                    }
                    placeholder="Minimum 5 characters"
                    className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={passwords.confirmpassword}
                    onChange={(e) =>
                      setPasswords({
                        ...passwords,
                        confirmpassword: e.target.value,
                      })
                    }
                    placeholder="Re-enter new password"
                    className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full py-3.5 bg-gradient-to-br from-primary to-primary-dim text-white font-semibold rounded-xl text-sm shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {isUpdatingPassword
                    ? "Updating password..."
                    : "Update Password"}
                </button>
              </form>
            </div>

            {/* Session & Device Security Sidebar */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-stitch-soft border border-outline-variant/15 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container/40 text-secondary flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">
                      devices
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">
                      Active Devices
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Current browser session is active
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10 text-xs text-on-surface-variant space-y-2">
                  <div className="flex items-center justify-between font-bold text-on-surface">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-secondary" />
                      Current Web Session
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-secondary">
                      Active Now
                    </span>
                  </div>
                  <p>
                    Logged in as:{" "}
                    <strong className="text-on-surface">
                      {currentUser?.username}
                    </strong>
                  </p>
                  <p>JWT Secure HttpOnly Token Storage</p>
                </div>

                <button
                  onClick={handleLogoutAll}
                  className="w-full py-3 bg-error-container/20 text-error hover:bg-error-container/30 border border-error/20 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">
                    logout
                  </span>
                  Log Out From All Devices
                </button>
              </div>

              {/* Security Tips Card */}
              <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/15 space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-base">
                    shield
                  </span>
                  Security Best Practices
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Never share your account credentials or email OTP codes with
                  anyone. Nexora staff will never request your password.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Saved Posts Vault Tab
          <div className="space-y-6">
            {loadingSaved ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-on-surface-variant">
                  Loading your saved vault...
                </p>
              </div>
            ) : savedPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedPosts.map((post) => (
                  <PostCard
                    key={post._id}
                    post={post}
                    onUnsave={(postId) =>
                      setSavedPosts((current) =>
                        current.filter((saved) => saved._id !== postId),
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 p-8">
                <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-outline mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">
                    bookmark_border
                  </span>
                </div>
                <h3 className="font-headline font-bold text-lg text-on-surface mb-1">
                  Your Saved Vault is Empty
                </h3>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto mb-6">
                  Bookmark interesting posts and answers from your feed so you
                  can easily reference them later.
                </p>
                <Link
                  to="/feed"
                  className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm hover:bg-primary-dim transition-all"
                >
                  Explore Feed
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
