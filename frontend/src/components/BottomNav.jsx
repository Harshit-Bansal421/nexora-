import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';

export default function BottomNav() {
  const { currentUser, isAuthenticated } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] bg-surface-container-lowest/95 backdrop-blur-md shadow-stitch-soft border-t border-outline-variant/15 z-40 rounded-t-3xl">
      <Link
        to="/feed"
        className={`min-w-14 min-h-11 flex flex-col items-center justify-center px-2 py-1.5 rounded-2xl transition-all duration-200 ${
          isActive('/feed') || isActive('/home')
            ? 'bg-primary-container/40 text-primary font-bold'
            : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-2xl">home</span>
        <span className="text-[11px] font-medium mt-0.5">Home</span>
      </Link>

      <Link
        to="/pages/explore"
        className={`min-w-14 min-h-11 flex flex-col items-center justify-center px-2 py-1.5 rounded-2xl transition-all duration-200 ${
          isActive('/pages/explore')
            ? 'bg-primary-container/40 text-primary font-bold'
            : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-2xl">explore</span>
        <span className="text-[11px] font-medium mt-0.5">Explore</span>
      </Link>

      <Link
        to="/posts/new"
        className="min-w-14 min-h-11 flex flex-col items-center justify-center -mt-3"
      >
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-dim text-white flex items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-2xl">add</span>
        </div>
        <span className="text-[11px] font-medium mt-1 text-on-surface-variant">Create</span>
      </Link>

      <Link
        to="/search"
        className={`min-w-14 min-h-11 flex flex-col items-center justify-center px-2 py-1.5 rounded-2xl transition-all duration-200 ${
          isActive('/search')
            ? 'bg-primary-container/40 text-primary font-bold'
            : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-2xl">search</span>
        <span className="text-[11px] font-medium mt-0.5">Search</span>
      </Link>

      <Link
        to={isAuthenticated ? `/profile/${currentUser?.username}` : '/login'}
        className={`min-w-14 min-h-11 flex flex-col items-center justify-center px-2 py-1.5 rounded-2xl transition-all duration-200 ${
          isAuthenticated && isActive(`/profile/${currentUser?.username}`)
            ? 'bg-primary-container/40 text-primary font-bold'
            : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-2xl">person</span>
        <span className="text-[11px] font-medium mt-0.5">Profile</span>
      </Link>
    </nav>
  );
}
