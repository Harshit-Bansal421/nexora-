import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";
import { authApi } from "../api/client";
import Avatar from "../components/Avatar";

export default function EditProfilePage() {
  const { currentUser, refreshUser } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState(currentUser?.username || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || username.length < 4 || username.length > 20) {
      error("Username must be between 4 and 20 characters.");
      return;
    }

    setSaving(true);
    try {
      if (
        username.trim().toLowerCase() !== currentUser?.username?.toLowerCase()
      ) {
        await authApi.updateUsername({
          username: username.trim().toLowerCase(),
        });
      }
      await authApi.updateProfile({ bio: bio.trim() });
      await refreshUser();
      success("Profile updated successfully!");
      navigate(`/profile/${username.trim().toLowerCase()}`);
    } catch (err) {
      error(err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4">
          <Link
            to={currentUser ? `/profile/${currentUser.username}` : "/feed"}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              arrow_back
            </span>
            Back to Profile
          </Link>

          <h1 className="font-headline font-extrabold text-xl text-on-surface">
            Edit Profile
          </h1>

          <div className="w-16" />
        </div>

        {/* Profile Picture Section */}
        <section className="bg-surface-container-low rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 border border-outline-variant/10 shadow-stitch-soft">
          <div className="relative group">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-surface-container-lowest shadow-md">
              <Avatar
                src={currentUser?.profileImage}
                name={currentUser?.username || "User"}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div className="absolute bottom-1 right-1 bg-primary text-white p-2 rounded-full border-2 border-white shadow-sm">
              <span className="material-symbols-outlined text-sm">
                photo_camera
              </span>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <h2 className="text-lg font-bold font-headline text-on-surface">
              Avatar Picture
            </h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your profile picture appears across your published questions,
              solutions, and community hubs.
            </p>
            <div className="pt-2 flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="text-[11px] font-bold text-secondary bg-secondary-container/30 px-3 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-xs filled">
                  verified
                </span>
                Verified Member
              </span>
            </div>
          </div>
        </section>

        {/* Form Grid */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant/15 shadow-stitch-soft space-y-5">
            {/* Display / Username */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                Username / Display Name *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-lg">
                  alternate_email
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alex_helper"
                  className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest font-medium transition-all"
                />
              </div>
              <p className="text-[11px] text-on-surface-variant ml-1">
                4 to 20 characters, lowercase. Used for your profile URL and
                mentions.
              </p>
            </div>

            {/* Bio Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  About Bio
                </label>
                <span className="text-[11px] text-on-surface-variant">
                  {bio.length}/150
                </span>
              </div>
              <textarea
                rows={4}
                maxLength={150}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your learning goals, skills you enjoy helping with, or projects you're building..."
                className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all resize-none font-medium leading-relaxed"
              />
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                Account Email
              </label>
              <input
                type="text"
                disabled
                value={currentUser?.email || ""}
                className="w-full px-4 py-3 bg-surface-container border border-outline-variant/15 rounded-xl text-sm text-on-surface-variant opacity-75 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              to={currentUser ? `/profile/${currentUser.username}` : "/feed"}
              className="px-6 py-3 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-gradient-to-br from-primary to-primary-dim text-white text-xs font-bold rounded-xl shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? "Saving changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
