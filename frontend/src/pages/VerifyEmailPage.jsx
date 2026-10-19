import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../api/client";
import { useAuth } from "../context/authContextValue";
import { useToast } from "../context/toastContextValue";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { success, error } = useToast();

  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef([]);

  useEffect(() => {
    // Focus first input box
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index, value) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    // Auto-advance
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim().slice(0, 6);
    if (/^\d+$/.test(pasted)) {
      const newOtp = [...otp];
      newOtp.fill("");
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i];
      }
      setOtp(newOtp);
      inputRefs.current[Math.min(5, pasted.length - 1)]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      error("Please enter the full 6-digit verification code.");
      return;
    }
    if (!email) {
      error("Please provide the registered email address.");
      return;
    }

    setLoading(true);

    try {
      await authApi.verifyEmail({
        email: email.trim().toLowerCase(),
        otp: fullOtp,
      });
      success("Email successfully verified! Welcome to Nexora.");
      await refreshUser();
      navigate("/feed");
    } catch (err) {
      error(
        err?.message ||
          err?.error ||
          "Verification failed. Code may be invalid or expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    if (!email) {
      error("Please specify your registered email address first.");
      return;
    }

    try {
      await authApi.resendEmail({
        email: email.trim().toLowerCase(),
        type: "email_verify",
      });
      success(
        "A fresh 6-digit verification code has been dispatched to your email.",
      );
      setResendCooldown(60);
    } catch (err) {
      error(err?.message || "Could not resend code. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Abstract Background Blurs */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-container rounded-full blur-[120px] opacity-20 pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary-container rounded-full blur-[120px] opacity-20 pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Branding */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-2xl">hub</span>
            </div>
            <span className="font-headline font-extrabold text-3xl tracking-tight text-primary">
              Nexora
            </span>
          </Link>
        </div>

        {/* Content Box */}
        <div className="bg-surface-container-lowest shadow-stitch-ambient rounded-[2rem] p-8 sm:p-10 text-center border border-outline-variant/15">
          {/* Illustration Icon */}
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 bg-primary/10 rounded-3xl rotate-6" />
            <div className="absolute inset-0 bg-primary/15 rounded-3xl -rotate-3" />
            <div className="relative flex items-center justify-center w-full h-full bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/15">
              <span className="material-symbols-outlined text-4xl text-primary">
                mail
              </span>
            </div>
          </div>

          <h1 className="font-headline font-extrabold text-2xl mb-3 text-on-surface">
            Verify your email
          </h1>
          <p className="text-on-surface-variant leading-relaxed mb-6 text-sm">
            We've sent a 6-digit verification code to{" "}
            <span className="font-semibold text-on-surface">
              {email || "your email"}
            </span>
            . Enter it below to activate your account.
          </p>

          {!emailParam && (
            <div className="mb-6 text-left">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                Registered Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm"
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 6 Digit Inputs */}
            <div
              className="flex justify-center gap-2 sm:gap-3"
              onPaste={handlePaste}
            >
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-11 h-14 sm:w-13 sm:h-16 text-center text-2xl font-bold rounded-xl bg-surface-container-low border border-transparent focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40 text-primary transition-all outline-none"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-br from-primary to-primary-dim text-on-primary font-semibold rounded-xl text-base shadow-lg shadow-primary/20 hover:scale-[0.99] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying code...</span>
                </>
              ) : (
                <>
                  <span>Verify Account</span>
                  <span className="material-symbols-outlined text-lg">
                    check_circle
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Resend Section */}
          <div className="mt-8 pt-6 border-t border-outline-variant/15 text-sm text-on-surface-variant">
            <p>
              Didn't receive the email?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-primary font-bold hover:underline ml-1 disabled:opacity-50 disabled:no-underline"
              >
                {resendCooldown > 0
                  ? `Resend Code in ${resendCooldown}s`
                  : "Resend Code"}
              </button>
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 flex justify-between items-center px-4 text-sm text-on-surface-variant">
          <Link
            to="/login"
            className="hover:text-primary flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              arrow_back
            </span>
            Back to login
          </Link>
          <Link to="/signup" className="hover:text-primary transition-colors">
            Create another account
          </Link>
        </div>
      </div>
    </div>
  );
}
