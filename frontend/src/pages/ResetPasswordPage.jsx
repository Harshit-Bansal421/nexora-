import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';
import { useToast } from '../context/toastContextValue';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1: Verify Reset OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!email.trim() || !otp.trim()) {
      error('Please enter both your registered email and the 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyResetOtp({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      success('Recovery OTP verified! You can now set your new password.');
      setOtpVerified(true);
    } catch (err) {
      error(err?.message || 'Invalid or expired OTP. Please try again or request a new code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 5) {
      error('New password must be at least 5 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      error('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({
        newpassword: newPassword,
        confirmNewPassword: confirmPassword,
      });
      success('Password successfully reset! Please sign in with your new password.');
      navigate('/login');
    } catch (err) {
      error(err?.message || 'Failed to update password. Session may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
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

      <main className="flex-grow flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-container-high rounded-3xl mb-4 shadow-sm border border-outline-variant/15">
              <span className="material-symbols-outlined text-primary text-3xl">lock_reset</span>
            </div>
            <h2 className="text-3xl font-extrabold text-on-surface font-headline tracking-tight mb-2">
              {otpVerified ? 'Create New Password' : 'Verify Recovery Code'}
            </h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              {otpVerified
                ? 'Enter and confirm your new secure password.'
                : 'Enter the recovery OTP sent to your email to continue.'}
            </p>
          </div>

          <div className="bg-surface-container-lowest p-8 rounded-[1.75rem] shadow-stitch-ambient border border-outline-variant/15">
            {!otpVerified ? (
              // Step 1: OTP verification
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                    6-Digit Recovery OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-center text-xl font-bold tracking-widest text-primary focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-br from-primary to-primary-dim text-white font-semibold rounded-xl text-base shadow-lg shadow-primary/20 hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
            ) : (
              // Step 2: New Password form
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 5 characters"
                      className="w-full px-4 pr-11 py-3 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all font-medium"
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

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-br from-primary to-primary-dim text-white font-semibold rounded-xl text-base shadow-lg shadow-primary/20 hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Resetting...' : 'Set New Password'}
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
              Cancel and return to login
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-on-surface-variant/60">
        <p>© 2026 Nexora. All rights reserved.</p>
      </footer>
    </div>
  );
}
