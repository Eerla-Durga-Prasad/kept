import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  KeptAuthUser,
  resendConfirmationEmail,
  saveProfileForUser,
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  updateUserPassword,
} from '../lib/auth';

export interface AuthFlowProps {
  onAuthenticated: (user: KeptAuthUser) => void;
  initialView?: 'signin' | 'signup' | 'reset-password';
}

type AuthView = 'signin' | 'signup' | 'confirmation-pending' | 'forgot-password' | 'reset-password';

const RESEND_COOLDOWN_SECONDS = 45;

/** Mask an email for privacy display (e.g. durga.prasad@gmail.com -> d***d@gmail.com) */
function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export const AuthFlow: React.FC<AuthFlowProps> = ({ onAuthenticated, initialView = 'signin' }) => {
  // Navigation View State
  const [view, setView] = useState<AuthView>(initialView);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status / Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);

  // Countdown timer for resend link
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle switching tabs/views
  const switchView = (newView: AuthView) => {
    setView(newView);
    setError(null);
    setSuccessNotice(null);
    setIsEmailUnconfirmed(false);
  };

  // 1. Sign In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setIsEmailUnconfirmed(false);

    if (!email.trim() || !password) {
      setError('Please provide both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await signInWithEmailPassword(email, password);
      onAuthenticated(user);
    } catch (err: unknown) {
      const errorObj = err as Error & { isEmailNotConfirmed?: boolean };
      if (errorObj.isEmailNotConfirmed) {
        setIsEmailUnconfirmed(true);
      }
      setError(errorObj.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Sign Up Handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setIsEmailUnconfirmed(false);

    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUpWithEmailPassword(email, password, fullName);

      if (result.requiresEmailConfirmation) {
        setView('confirmation-pending');
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setSuccessNotice(`We've sent a confirmation link to ${email.trim()}`);
      } else if (result.user) {
        if (fullName.trim()) {
          saveProfileForUser(result.user.id, { full_name: fullName.trim() });
        }
        onAuthenticated(result.user);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to create account. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Resend Confirmation Email Handler
  const handleResendConfirmation = async () => {
    if (resendCooldown > 0 || isSubmitting || !email.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await resendConfirmationEmail(email.trim());
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setSuccessNotice(`A fresh confirmation link was sent to ${maskEmail(email.trim())}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to resend confirmation email.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Request Password Reset Handler
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(email.trim());
      setSuccessNotice(`Password reset instructions have been sent to ${email.trim()}.`);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to send password reset email.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Update Password Handler (after clicking reset link)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUserPassword(password);
      setSuccessNotice('Your password has been successfully updated! Signing in...');
      setTimeout(() => {
        switchView('signin');
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to update password. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fallback view if Supabase client is not configured
  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="min-h-screen bg-[#FFF8EF] flex items-center justify-center p-4 selection:bg-[#C94F13]/20">
        <div className="w-full max-w-[420px] bg-white rounded-3xl border border-[#EBD9C8] p-7 sm:p-9 shadow-[0_4px_24px_-2px_rgba(201,79,19,0.06),0_1px_3px_rgba(40,32,25,0.04)] text-center relative overflow-hidden">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5E2D2] text-[#C94F13] shadow-subtle">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <span className="font-serif text-3xl font-semibold tracking-tight text-[#282019]">Kept</span>
          <p className="mt-2 font-serif text-xl text-[#282019]">Connect your cloud workspace</p>
          <p className="mt-2 text-xs sm:text-sm text-[#82776C] leading-relaxed">
            To enable authentication, configure these environment variables in <code className="bg-[#FFF8EF] px-1.5 py-0.5 rounded text-[#C94F13] font-mono text-xs">.env.local</code> or your Vercel Project Settings:
          </p>

          <div className="my-5 rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] p-3 text-left font-mono text-[11px] text-[#282019]/80 space-y-1">
            <p>VITE_SUPABASE_URL=https://...supabase.co</p>
            <p>VITE_SUPABASE_ANON_KEY=sb_publishable_...</p>
          </div>

          <p className="text-[11px] text-[#82776C]">
            Obtain these from your Supabase Dashboard → Project Settings → API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8EF] flex items-center justify-center p-3 sm:p-6 md:p-8 selection:bg-[#C94F13]/20 font-sans">
      {/* Background Ambience / Subtle Botanical Sprigs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-12 -right-12 w-72 h-72 rounded-full bg-[#F5E2D2]/40 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-[#F5E2D2]/30 blur-3xl" />
      </div>

      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-[#EBD9C8] shadow-[0_6px_32px_-4px_rgba(201,79,19,0.08),0_1px_3px_rgba(40,32,25,0.04)] p-5 sm:p-8 relative overflow-hidden z-10 transition-all duration-300">
        {/* Subtle Decorative Botanical Accent on Top-Right */}
        <div className="absolute -top-3 -right-3 w-20 h-20 pointer-events-none opacity-25 text-[#C94F13]">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <path d="M100,0 C70,12 45,45 35,75 C55,65 85,45 100,0 Z" />
          </svg>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BRAND HEADER (SHARED)                                         */}
        {/* ------------------------------------------------------------- */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <span className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#282019]">
              Kept
            </span>
            {/* Signature Organic Leaf Detail */}
            <svg
              className="w-5 h-5 text-[#C94F13] transform -rotate-12 translate-y-[-4px]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
            </svg>
          </div>

          <h1 className="mt-2 font-serif text-2xl sm:text-3xl font-normal text-[#282019] tracking-tight">
            {view === 'signin' && 'Welcome back'}
            {view === 'signup' && 'Good food. Shared lives.'}
            {view === 'confirmation-pending' && 'Check your email'}
            {view === 'forgot-password' && 'Reset password'}
            {view === 'reset-password' && 'Create new password'}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[#82776C] leading-relaxed max-w-[310px] mx-auto">
            {view === 'signin' && 'Sign in to access your household grocery list & meal plans.'}
            {view === 'signup' && 'Plan meals, save recipes, shop smarter and cook together.'}
            {view === 'confirmation-pending' && 'We sent a verification link to activate your account.'}
            {view === 'forgot-password' && "Enter your email address and we'll send you recovery instructions."}
            {view === 'reset-password' && 'Choose a strong password to secure your Kept account.'}
          </p>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MODE TABS (SIGN IN / CREATE ACCOUNT)                          */}
        {/* ------------------------------------------------------------- */}
        {(view === 'signin' || view === 'signup') && (
          <div className="flex p-1 bg-[#F5E2D2]/60 rounded-2xl border border-[#EBD9C8]/70 mb-5">
            <button
              type="button"
              onClick={() => switchView('signin')}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                view === 'signin'
                  ? 'bg-white text-[#282019] font-semibold shadow-sm border border-[#EBD9C8]/80'
                  : 'text-[#82776C] hover:text-[#282019]'
              }`}
            >
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => switchView('signup')}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                view === 'signup'
                  ? 'bg-white text-[#282019] font-semibold shadow-sm border border-[#EBD9C8]/80'
                  : 'text-[#82776C] hover:text-[#282019]'
              }`}
            >
              <span>Create Account</span>
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SUCCESS NOTIFICATION BANNER                                   */}
        {/* ------------------------------------------------------------- */}
        {successNotice && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs sm:text-sm text-emerald-800 leading-snug flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* ERROR MESSAGE BANNER                                          */}
        {/* ------------------------------------------------------------- */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs sm:text-sm text-red-700 leading-snug flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <span className="text-red-500 font-bold shrink-0 mt-0.5">•</span>
              <span>{error}</span>
            </div>

            {/* Email unconfirmed action helper */}
            {isEmailUnconfirmed && (
              <div className="pt-2 border-t border-red-200/80 flex items-center justify-between text-xs">
                <span>Didn't get the link?</span>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={isSubmitting || resendCooldown > 0}
                  className="font-semibold text-[#C94F13] hover:underline disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation link'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: SIGN IN                                               */}
        {/* ------------------------------------------------------------- */}
        {view === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                Email address
              </label>
              <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="name@family.com"
                  className="w-full bg-transparent py-3.5 pl-10 pr-3.5 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchView('forgot-password')}
                  className="text-xs text-[#C94F13] hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-transparent py-3.5 pl-10 pr-10 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none font-mono"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#82776C] hover:text-[#282019] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim() || !password}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center text-xs text-[#82776C]">
              New to Kept?{' '}
              <button
                type="button"
                onClick={() => switchView('signup')}
                className="font-semibold text-[#C94F13] hover:underline"
              >
                Create an account
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: SIGN UP (CREATE ACCOUNT)                             */}
        {/* ------------------------------------------------------------- */}
        {view === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                Your full name <span className="text-[#82776C]/60 lowercase font-normal">(optional)</span>
              </label>
              <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Durga Prasad"
                  className="w-full bg-transparent py-3.5 pl-10 pr-3.5 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                Email address
              </label>
              <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="name@family.com"
                  className="w-full bg-transparent py-3.5 pl-10 pr-3.5 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                Password
              </label>
              <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="At least 8 characters"
                  className="w-full bg-transparent py-3.5 pl-10 pr-10 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none font-mono"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#82776C] hover:text-[#282019] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#82776C]">Must contain at least 8 characters.</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim() || password.length < 8}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Creating your account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center text-xs text-[#82776C]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchView('signin')}
                className="font-semibold text-[#C94F13] hover:underline"
              >
                Sign in
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 3: CONFIRMATION PENDING (CHECK YOUR EMAIL)              */}
        {/* ------------------------------------------------------------- */}
        {view === 'confirmation-pending' && (
          <div className="text-center">
            {/* Elegant Envelope Artwork */}
            <div className="relative mx-auto mb-4 h-20 w-24">
              <svg viewBox="0 0 96 80" fill="none" className="w-full h-full">
                <rect x="8" y="24" width="80" height="52" rx="12" fill="#FFFAF4" stroke="#EBD9C8" strokeWidth="2" />
                <path d="M10 26 L48 54 L86 26" stroke="#EBD9C8" strokeWidth="2" strokeLinejoin="round" />
                <rect x="18" y="10" width="60" height="34" rx="6" fill="#FFFFFF" stroke="#EBD9C8" strokeWidth="1.5" />
                <path d="M30 22 L45 22 M30 28 L58 28" stroke="#EBD9C8" strokeWidth="2" strokeLinecap="round" />
                <circle cx="48" cy="54" r="10" fill="#C94F13" />
                <circle cx="48" cy="54" r="8" fill="#B3430E" />
                <path d="M48 50 C46 47 43 49 45 52 L48 56 L51 52 C53 49 50 47 48 50 Z" fill="#FFF8EF" />
              </svg>
            </div>

            <p className="text-xs sm:text-sm text-[#82776C] leading-relaxed mb-4">
              We sent a verification link to <strong className="text-[#282019]">{email || 'your email'}</strong>. Click the link in the email to activate your Kept account and start planning meals.
            </p>

            <div className="rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] p-3 text-xs text-[#82776C] text-left mb-5">
              <p className="font-semibold text-[#282019] mb-1">💡 What to do next:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Open your email inbox</li>
                <li>Click <strong>Confirm your mail</strong></li>
                <li>You'll automatically be redirected into Kept</li>
              </ul>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={isSubmitting || resendCooldown > 0}
                className="w-full py-3 px-4 rounded-2xl border border-[#EBD9C8] bg-white hover:bg-[#FFFAF4] text-[#282019] text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-subtle flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : resendCooldown > 0 ? (
                  <span>Resend link in {resendCooldown}s</span>
                ) : (
                  <span>Resend confirmation email</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => switchView('signin')}
                className="inline-flex items-center gap-1.5 text-xs text-[#82776C] hover:text-[#C94F13] transition-colors py-1 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 4: FORGOT PASSWORD                                       */}
        {/* ------------------------------------------------------------- */}
        {view === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                Account email
              </label>
              <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="name@family.com"
                  className="w-full bg-transparent py-3.5 pl-10 pr-3.5 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim() || resendCooldown > 0}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending reset link...</span>
                </>
              ) : resendCooldown > 0 ? (
                <span>Resend in {resendCooldown}s</span>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => switchView('signin')}
                className="inline-flex items-center gap-1.5 text-xs text-[#82776C] hover:text-[#C94F13] transition-colors py-1 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 5: RESET PASSWORD (CREATE NEW PASSWORD)                 */}
        {/* ------------------------------------------------------------- */}
        {view === 'reset-password' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                New password
              </label>
              <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="At least 8 characters"
                  className="w-full bg-transparent py-3.5 pl-10 pr-10 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none font-mono"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#82776C] hover:text-[#282019] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                Confirm new password
              </label>
              <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Repeat new password"
                  className="w-full bg-transparent py-3.5 pl-10 pr-10 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none font-mono"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#82776C] hover:text-[#282019] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || password.length < 8 || password !== confirmPassword}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving new password...</span>
                </>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TRUST & SECURITY BADGE                                        */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[#82776C]">
          <Lock className="w-3.5 h-3.5 text-[#C94F13]" />
          <span>Secured by Supabase Authentication.</span>
        </div>
      </div>
    </div>
  );
};
