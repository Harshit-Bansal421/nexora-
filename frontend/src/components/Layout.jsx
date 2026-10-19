import React from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

export default function Layout({ children, hideNav = false }) {
  const location = useLocation();
  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface antialiased">
      {!hideNav && <Navbar />}
      <main className="flex-1 w-full pb-20 md:pb-8">
        <div key={location.pathname} className="page-transition">
          {children}
        </div>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
