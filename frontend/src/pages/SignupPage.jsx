import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useToast } from '../context/toastContextValue';

export default function SignupPage() {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        error('Profile image must be less than 4MB');
        return;
      }
      setProfileImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const getPasswordStrength = () => {
    const p = formData.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 6) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!formData.username.trim() || formData.username.length < 4 || formData.username.length > 20) {
      setValidationError('Username must be between 4 and 20 characters.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    if (!formData.password || formData.password.length < 5) {
      setValidationError('Password must be at least 5 characters long.');
      return;
    }
    if (!profileImageFile) {
      setValidationError('Please upload a profile avatar picture to complete registration.');
      return;
    }
    if (!agreedToTerms) {
      setValidationError('Please agree to the Terms of Service to continue.');
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      data.append('username', formData.username.trim().toLowerCase());
      data.append('email', formData.email.trim().toLowerCase());
      data.append('password', formData.password);
      data.append('profileImage', profileImageFile);

      const res = await authApi.signup(data);
      success(res?.data || 'Verification code sent to your email!');
      navigate(`/verify-email?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`);
    } catch (err) {
      const msg = err?.message || err?.error || 'Registration failed. Please check your details.';
      error(msg);
      setValidationError(msg);
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center">
      <div className="w-full max-w-6xl mx-auto min-h-[90vh] grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-surface-container-lowest sm:rounded-3xl shadow-stitch-ambient sm:border border-outline-variant/15 sm:my-6">
        {/* Left Editorial Visual Section */}
        <div className="hidden lg:flex lg:col-span-5 relative bg-primary-container overflow-hidden p-12 flex-col justify-between">
          <div className="absolute inset-0 z-0">
            <img
              alt="Community working together"
              className="w-full h-full object-cover opacity-25 mix-blend-multiply"
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80"
            />
          </div>

          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-2 mb-8 group">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary">
                <span className="material-symbols-outlined text-xl">hub</span>
              </div>
              <span className="text-2xl font-extrabold text-primary font-headline tracking-tight">Nexora</span>
            </Link>

            <h2 className="text-4xl font-headline font-extrabold text-on-primary-container leading-tight mt-6">
              Join the<br />Collaborative Canvas.
            </h2>
            <p className="mt-4 text-on-primary-container/80 text-base leading-relaxed max-w-sm font-medium">
              Where knowledge finds its home and every question meets a helping hand.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-4 bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/30">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-lg">verified_user</span>
              </div>
              <div>
                <p className="text-on-primary-container font-bold text-sm">Verified Network</p>
                <p className="text-on-primary-container/70 text-xs">Access trusted peers and experienced mentors</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/30">
              <div className="w-10 h-10 rounded-full bg-tertiary flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-lg">volunteer_activism</span>
              </div>
              <div>
                <p className="text-on-primary-container font-bold text-sm">Real Impact</p>
                <p className="text-on-primary-container/70 text-xs">Help others solve blockers and earn reputation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Section */}
        <div className="lg:col-span-7 p-6 sm:p-12 md:p-16 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            {/* Header */}
            <div className="mb-8">
              <span className="inline-block px-3 py-1 rounded-full bg-primary-container/40 text-primary text-xs font-bold uppercase tracking-wider mb-3">
                Get Started
              </span>
              <h1 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">
                Create Your Account
              </h1>
              <p className="text-on-surface-variant font-body text-sm mt-1">
                Join thousands of helpers making an impact.
              </p>
            </div>

            {validationError && (
              <div className="mb-6 p-4 rounded-xl bg-error-container/20 border border-error/20 text-error text-xs font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Profile Avatar Upload with Instant Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                  Profile Avatar *
                </label>
                <div className="flex items-center gap-4 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/20">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden bg-surface-container-highest flex-shrink-0 border-2 border-white shadow-sm">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Avatar preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline">
                        <span className="material-symbols-outlined text-2xl">person</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-block px-4 py-2 bg-surface-container-lowest text-primary text-xs font-bold rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors cursor-pointer">
                      <span>{imagePreview ? 'Change Avatar' : 'Select Picture'}</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-on-surface-variant/70 mt-1">JPG, PNG, or WEBP up to 4MB</p>
                  </div>
                </div>
              </div>

              {/* Username Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                  Username *
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">
                    person
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. alex_helper"
                    className="w-full bg-surface-container-low border border-transparent rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-sm text-on-surface placeholder:text-outline/60 font-medium"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">
                  Email Address *
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full bg-surface-container-low border border-transparent rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-sm text-on-surface placeholder:text-outline/60 font-medium"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Password *
                  </label>
                  {formData.password && (
                    <span className="text-[11px] font-bold text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">
                        {strength >= 3 ? 'verified' : 'info'}
                      </span>
                      {strength >= 3 ? 'Strong' : strength === 2 ? 'Medium' : 'Weak'}
                    </span>
                  )}
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full bg-surface-container-low border border-transparent rounded-xl py-3 pl-11 pr-11 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-sm text-on-surface placeholder:text-outline/60 font-medium"
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

                {/* Password Strength Indicator */}
                <div className="flex gap-1.5 mt-2">
                  <div className={`h-1 flex-1 rounded-full transition-all ${strength >= 1 ? 'bg-secondary' : 'bg-outline-variant/30'}`} />
                  <div className={`h-1 flex-1 rounded-full transition-all ${strength >= 2 ? 'bg-secondary' : 'bg-outline-variant/30'}`} />
                  <div className={`h-1 flex-1 rounded-full transition-all ${strength >= 3 ? 'bg-secondary' : 'bg-outline-variant/30'}`} />
                  <div className={`h-1 flex-1 rounded-full transition-all ${strength >= 4 ? 'bg-secondary' : 'bg-outline-variant/30'}`} />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 pt-1">
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 rounded border-outline-variant text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="terms" className="text-xs text-on-surface-variant leading-relaxed select-none cursor-pointer">
                  I agree to Nexora's{' '}
                  <span className="text-primary font-semibold hover:underline">Terms of Service</span> and{' '}
                  <span className="text-primary font-semibold hover:underline">Privacy Policy</span>.
                </label>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 bg-gradient-to-br from-primary to-primary-dim text-white font-semibold rounded-xl text-base shadow-lg shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending verification code...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer link to Login */}
            <div className="text-center mt-8 pt-6 border-t border-outline-variant/15 text-sm text-on-surface-variant">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline ml-1">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
