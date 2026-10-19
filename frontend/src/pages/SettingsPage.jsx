import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";

export default function SettingsPage() {
  const { logout, logoutAll } = useAuth();
  const { success, info } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    success("Logged out successfully");
    navigate("/login");
  };

  const handleLogoutAll = async () => {
    if (
      window.confirm(
        "Are you sure you want to log out of all active sessions across all devices?",
      )
    ) {
      await logoutAll();
      success("Logged out from all devices");
      navigate("/login");
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-8">
        {/* Editorial Header */}
        <section>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-headline tracking-tight text-on-surface">
            Settings
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Manage your account preferences, profile identity, and security.
          </p>
        </section>

        {/* Bento Grid Settings Hub */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
          {/* Edit Info (Hero Card) */}
          <Link
            to="/profile/edit"
            className="md:col-span-4 bg-surface-container-lowest rounded-3xl p-7 shadow-stitch-soft border border-outline-variant/15 hover:shadow-stitch-ambient transition-all group relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="w-14 h-14 bg-primary-container text-on-primary-container rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-3xl">
                  person_edit
                </span>
              </div>
              <h2 className="text-2xl font-bold font-headline mb-2 text-on-surface">
                Edit Profile
              </h2>
              <p className="text-on-surface-variant text-sm max-w-sm mb-6 leading-relaxed">
                Update your display username, bio description, and profile
                picture avatar.
              </p>
              <span className="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-2 group-hover:bg-primary-dim transition-colors shadow-sm">
                <span>Manage Profile</span>
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </span>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
          </Link>

          {/* Password & Security Card */}
          <Link
            to="/settings/security"
            className="md:col-span-2 bg-surface-container-low rounded-3xl p-7 hover:bg-surface-container transition-colors border border-outline-variant/10 shadow-stitch-soft flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 bg-surface-container-highest text-primary rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-2xl">
                  lock_reset
                </span>
              </div>
              <h3 className="text-xl font-bold font-headline mb-2 text-on-surface">
                Security & Passwords
              </h3>
              <p className="text-on-surface-variant text-xs leading-relaxed">
                Secure your account with fresh password credentials and monitor
                sessions.
              </p>
            </div>
            <span className="text-primary font-bold text-xs group-hover:underline inline-flex items-center gap-1 mt-6">
              Change now{" "}
              <span className="material-symbols-outlined text-sm">
                chevron_right
              </span>
            </span>
          </Link>

          {/* Saved Posts Vault Card */}
          <Link
            to="/settings/security?tab=saved"
            className="md:col-span-3 bg-surface-container-lowest border border-outline-variant/15 rounded-3xl p-7 shadow-stitch-soft hover:shadow-stitch-ambient transition-all group"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-tertiary-container/40 text-tertiary rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl filled">
                  bookmark
                </span>
              </div>
              <span className="px-3 py-1 bg-tertiary-container/20 text-tertiary rounded-full text-[10px] font-bold uppercase tracking-wider">
                Bookmarks
              </span>
            </div>
            <h3 className="text-xl font-bold font-headline mb-2 text-on-surface">
              Saved Posts
            </h3>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              Review and manage your bookmarked community questions, guides, and
              solutions.
            </p>
          </Link>

          {/* Community Guidelines Card */}
          <button
            type="button"
            onClick={() =>
              info(
                "Nexora encourages constructive peer learning, helpful solutions, and polite feedback.",
              )
            }
            className="md:col-span-3 w-full text-left bg-surface-container-low border border-outline-variant/10 rounded-3xl p-7 hover:bg-surface-container transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-secondary-container/40 text-secondary rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">
                  verified
                </span>
              </div>
              <span className="px-3 py-1 bg-secondary-container/20 text-secondary rounded-full text-[10px] font-bold uppercase tracking-wider">
                Trust & Safety
              </span>
            </div>
            <h3 className="text-xl font-bold font-headline mb-2 text-on-surface">
              Community Guidelines
            </h3>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              Learn how our reputational score works and how to become a
              Verified Mentor.
            </p>
          </button>
        </div>

        {/* Account Maintenance Section */}
        <section className="pt-6 border-t border-outline-variant/15 space-y-4">
          <h2 className="text-xl font-bold font-headline text-on-surface">
            Session & Account
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-primary text-2xl">
                  logout
                </span>
                <div>
                  <p className="font-bold text-sm text-on-surface">
                    Sign Out of Nexora
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    End your current session on this browser.
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-5 py-2 bg-surface-container-lowest hover:bg-white text-on-surface border border-outline-variant/20 rounded-xl text-xs font-bold transition-all"
              >
                Sign Out
              </button>
            </div>

            <div className="flex items-center justify-between p-5 bg-error-container/10 rounded-2xl border border-error/20">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-error text-2xl">
                  power_settings_new
                </span>
                <div>
                  <p className="font-bold text-sm text-error">
                    Logout All Devices
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Revoke all active tokens across mobile and desktop.
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogoutAll}
                className="px-5 py-2 bg-error text-white rounded-xl text-xs font-bold hover:bg-error-dim transition-all shadow-sm"
              >
                Logout All
              </button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
