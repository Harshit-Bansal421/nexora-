import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';
import { useToast } from '../context/toastContextValue';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { success, info } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password) {
      setErrorMessage('Please provide both username and password.');
      return;
    }

    setLoading(true);

    try {
      await login({ username: username.trim().toLowerCase(), password });
      success('Logged in successfully! Welcome back.');
      const returnTo = location.state?.from || '/feed';
      navigate(returnTo, { replace: true });
    } catch (err) {
      const msg = err?.message || err?.error || 'Invalid credentials. Please verify your username and password.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialClick = (provider) => {
    info(`${provider} login is coming soon. Please sign in with your username and password.`);
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface flex flex-col justify-between">
      {/* Top Bar */}
      <header className="w-full sticky top-0 z-50 bg-surface/95 backdrop-blur-md flex justify-between items-center px-6 py-4 shadow-stitch-soft border-b border-outline-variant/15">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-lg">hub</span>
          </div>
          <span className="text-xl font-extrabold text-primary font-headline tracking-tight">
            Nexora
          </span>
        </Link>
        <Link
          to="/signup"
          className="text-xs font-bold text-primary hover:underline px-3 py-1.5 rounded-full hover:bg-primary-container/20 transition-colors"
        >
          Need an account? Sign Up
        </Link>
      </header>

      {/* Main Content Card */}
      <main className="flex-grow flex flex-col items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[420px] space-y-8 relative z-10">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold font-headline tracking-tight text-on-surface">
              Welcome back
            </h1>
            <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
              Join the community of knowledge seekers and helpers.
            </p>
          </div>

          <div className="bg-surface-container-lowest p-7 sm:p-8 rounded-[1.75rem] shadow-stitch-ambient border border-outline-variant/15 space-y-6">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-error-container/20 border border-error/20 text-error text-xs font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1" htmlFor="username">
                  Username
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">
                    person
                  </span>
                  <input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username (not email)"
                    className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-transparent rounded-xl focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest text-sm text-on-surface placeholder:text-outline/60 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="password">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-primary hover:text-primary-dim transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">
                    lock
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-3.5 bg-surface-container-low border border-transparent rounded-xl focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest text-sm text-on-surface placeholder:text-outline/60 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-gradient-to-br from-primary to-primary-dim text-on-primary font-semibold rounded-xl text-base hover:brightness-105 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Login to Nexora</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Social Login Divider */}
            <div className="relative flex items-center gap-4 py-1">
              <div className="h-px flex-grow bg-outline-variant opacity-25" />
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                or continue with
              </span>
              <div className="h-px flex-grow bg-outline-variant opacity-25" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSocialClick('Google')}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-low hover:bg-surface-container-high rounded-xl transition-all text-xs font-semibold text-on-surface border border-outline-variant/10 active:scale-95"
              >
                <img
                  alt="Google"
                  className="w-4 h-4"
                  src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
                />
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialClick('GitHub')}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-low hover:bg-surface-container-high rounded-xl transition-all text-xs font-semibold text-on-surface border border-outline-variant/10 active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">terminal</span>
                <span>GitHub</span>
              </button>
            </div>
          </div>

          <div className="text-center text-sm text-on-surface-variant">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-bold hover:underline ml-1">
              Sign up
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="hidden lg:block fixed -bottom-20 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden lg:block fixed -top-20 -right-20 w-96 h-96 bg-tertiary/5 rounded-full blur-3xl pointer-events-none" />
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-on-surface-variant/60 text-xs">
        <p>© 2026 Nexora. All rights reserved.</p>
      </footer>
    </div>
  );
}
