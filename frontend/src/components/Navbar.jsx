import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';
import { useToast } from '../context/toastContextValue';
import Avatar from './Avatar';

export default function Navbar() {
  const { currentUser, isAuthenticated, logout, unreadNotificationsCount } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    success('Logged out successfully');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="w-full sticky top-0 z-50 bg-surface/95 backdrop-blur-md border-b border-outline-variant/15 px-4 sm:px-6 py-3 shadow-stitch-soft">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link to={isAuthenticated ? '/feed' : '/'} className="flex items-center gap-2 group">
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
                isActive('/feed') || isActive('/home')
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Feed
            </Link>
            <Link
              to="/pages/explore"
              className={`font-semibold transition-colors ${
                isActive('/pages/explore')
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Explore Hubs
            </Link>
            <Link
              to="/posts/new"
              className={`font-semibold transition-colors flex items-center gap-1 ${
                isActive('/posts/new')
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              New Post
            </Link>
          </nav>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-md hidden sm:block">
          <form onSubmit={handleSearchSubmit} className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts, hubs, or topics..."
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-transparent rounded-full text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
            />
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
                <span className="material-symbols-outlined text-2xl">notifications</span>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-error text-on-error rounded-full ring-2 ring-surface text-[10px] font-bold flex items-center justify-center">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
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
                    name={currentUser?.username || 'User'}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-outline-variant/30"
                  />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-2xl shadow-stitch-modal border border-outline-variant/20 py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-4 py-2.5 border-b border-outline-variant/15">
                      <p className="font-bold text-sm text-on-surface truncate">
                        {currentUser?.username || 'User'}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">
                        {currentUser?.email}
                      </p>
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-container/40 text-primary">
                        <span>{currentUser?.title || 'Newcomer'}</span>
                        <span>•</span>
                        <span>{currentUser?.point || 0} pts</span>
                      </div>
                    </div>

                    <Link
                      to={`/profile/${currentUser?.username}`}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">person</span>
                      My Profile
                    </Link>
                    <Link
                      to="/profile/edit"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                      Edit Profile
                    </Link>
                    <Link
                      to="/settings/security?tab=saved"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">bookmark</span>
                      Saved Posts
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">settings</span>
                      Settings
                    </Link>

                    <div className="my-1 border-t border-outline-variant/15"></div>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error-container/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-lg">logout</span>
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
