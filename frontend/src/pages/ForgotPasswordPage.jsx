import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/client";
import { useToast } from "../context/toastContextValue";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      error("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.forgotPassword({
        email: email.trim().toLowerCase(),
      });
      success(res?.data || "Password recovery OTP sent to your email!");
      navigate(
        `/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`,
      );
    } catch (err) {
      error(
        err?.message ||
          "Failed to dispatch recovery email. Please check your address.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full sticky top-0 z-50 bg-surface/95 backdrop-blur-md flex justify-between items-center px-6 py-4 shadow-stitch-soft border-b border-outline-variant/15">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-lg">hub</span>
          </div>
          <span className="text-xl font-extrabold text-primary font-headline tracking-tight">
            Nexora
          </span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 relative">
        <div className="w-full max-w-md relative z-10">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-surface-container-low mb-4 shadow-stitch-soft border border-outline-variant/15">
              <span className="material-symbols-outlined text-4xl text-primary">
                lock_reset
              </span>
            </div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
              Forgot password?
            </h1>
            <p className="text-on-surface-variant text-sm leading-relaxed px-4">
              Don’t worry, it happens to the best of us. We’ll send you a
              6-digit recovery code to reset your password.
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-stitch-ambient border border-outline-variant/15 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1"
                  htmlFor="email"
                >
                  Registered Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">
                      mail
                    </span>
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="block w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-transparent rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all placeholder:text-outline/60 font-medium"
                  />
                </div>
              </div>

              {/* Informational Hint */}
              <div className="p-4 bg-surface-container rounded-xl flex gap-3 text-xs leading-5 text-on-primary-container border border-outline-variant/10">
                <span className="material-symbols-outlined text-primary text-base mt-0.5">
                  info
                </span>
                <p>
                  Check your inbox (and spam folder) for a recovery OTP. The
                  code will remain valid for 10 minutes.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-br from-primary to-primary-dim text-on-primary py-4 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Recovery OTP</span>
                    <span className="material-symbols-outlined text-lg">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-on-surface-variant font-medium hover:text-primary transition-colors group"
            >
              <span className="material-symbols-outlined text-base group-hover:-translate-x-1 transition-transform">
                arrow_back
              </span>
              Back to Login
            </Link>
          </div>
        </div>

        {/* Ambient glow */}
        <div className="fixed top-1/4 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="fixed bottom-1/4 -right-20 w-80 h-80 bg-tertiary/5 rounded-full blur-[100px] pointer-events-none" />
      </main>

      <footer className="py-6 text-center text-xs text-on-surface-variant/60">
        <p>© 2026 Nexora Secure Recovery System</p>
      </footer>
    </div>
  );
}
