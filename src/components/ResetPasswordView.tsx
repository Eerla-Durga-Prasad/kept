import React, { useEffect, useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Mail,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  updateUserPassword,
  validatePassword,
  signOutCurrentUser,
  sendPasswordResetEmail,
} from '../lib/auth';

export interface ResetPasswordViewProps {
  isRecoverySessionValid?: boolean;
  onPasswordResetComplete: () => void;
  onNavigateToSignIn: () => void;
}

type ResetStatus = 'checking' | 'ready' | 'success' | 'error';

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({
  isRecoverySessionValid = false,
  onPasswordResetComplete,
  onNavigateToSignIn,
}) => {
  const [status, setStatus] = useState<ResetStatus>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Link Request Form state in case of expired link
  const [showRequestLink, setShowRequestLink] = useState(false);
  const [requestEmail, setRequestEmail] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function evaluateRecoverySession() {
      if (!isSupabaseConfigured || !supabase) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage('Authentication service is not configured.');
        return;
      }

      // 1. Inspect URL parameters
      const searchParams = new URLSearchParams(window.location.search);
      const hashString = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashString);

      // Check if error is present in query or hash
      const errorParam = searchParams.get('error') || hashParams.get('error');
      const errorCode = searchParams.get('error_code') || hashParams.get('error_code');
      const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

      if (errorParam || errorCode) {
        if (!isMounted) return;
        setStatus('error');
        const desc = errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, ' ')) : '';
        if (errorCode === 'otp_expired' || desc.toLowerCase().includes('expired')) {
          setErrorMessage('This password reset link has expired. Please request a fresh reset link below.');
        } else {
          setErrorMessage(desc || 'This password reset link is invalid or has already been used.');
        }
        return;
      }

      // 2. PKCE code exchange if present
      const code = searchParams.get('code');
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          if (!isMounted) return;
          setStatus('error');
          setErrorMessage('Unable to verify password reset link. It may have expired or already been used.');
          return;
        }

        // Clean query from address bar
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', '/reset-password');
        }

        if (!isMounted) return;
        setStatus('ready');
        return;
      }

      // 3. Implicit recovery hash check (#access_token=...&type=recovery)
      const isRecoveryType = hashParams.get('type') === 'recovery';
      if (isRecoveryType) {
        // Wait briefly for Supabase client to parse hash
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState(null, '', '/reset-password');
          }
          if (!isMounted) return;
          setStatus('ready');
          return;
        }
      }

      // 4. Prop confirmation from App onAuthStateChange (PASSWORD_RECOVERY event)
      if (isRecoverySessionValid) {
        if (!isMounted) return;
        setStatus('ready');
        return;
      }

      // 5. Existing session check — ensure it's not a normal session masquerading as recovery
      // A recovery session must originate from an incoming recovery token or event
      const { data: { session } } = await supabase.auth.getSession();
      if (session && (window.location.hash.includes('type=recovery') || isRecoveryType)) {
        if (!isMounted) return;
        setStatus('ready');
        return;
      }

      // If user navigated to /reset-password without a valid recovery token/session
      if (!isMounted) return;
      setStatus('error');
      setErrorMessage('No active password reset request found. If you forgot your password, please request a reset link.');
    }

    evaluateRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [isRecoverySessionValid]);

  // Handle password submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validatePassword(password);
    if (!validation.isValid) {
      setFormError(validation.message || 'Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUserPassword(password);
      setStatus('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to update password. Please try again.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete and sign out the temporary recovery session
  const handleContinueToSignIn = async () => {
    try {
      await signOutCurrentUser();
    } catch {
      // Ignore signout error
    }
    onPasswordResetComplete();
  };

  // Resend reset email
  const handleRequestResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestEmail.trim() || isRequesting) return;

    setIsRequesting(true);
    setRequestSuccess(false);
    try {
      await sendPasswordResetEmail(requestEmail.trim());
      setRequestSuccess(true);
    } catch {
      // Handled in UI
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8EF] flex items-center justify-center p-3 sm:p-6 md:p-8 selection:bg-[#C94F13]/20 font-sans">
      {/* Background Ambience / Subtle Botanical Sprigs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-12 -right-12 w-72 h-72 rounded-full bg-[#F5E2D2]/40 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-[#F5E2D2]/30 blur-3xl" />
      </div>

      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-[#EBD9C8] shadow-[0_6px_32px_-4px_rgba(201,79,19,0.08),0_1px_3px_rgba(40,32,25,0.04)] p-6 sm:p-8 relative overflow-hidden z-10 transition-all duration-300">
        {/* Subtle Decorative Botanical Accent on Top-Right */}
        <div className="absolute -top-3 -right-3 w-20 h-20 pointer-events-none opacity-25 text-[#C94F13]">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <path d="M100,0 C70,12 45,45 35,75 C55,65 85,45 100,0 Z" />
          </svg>
        </div>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <span className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#282019]">
              Kept
            </span>
            <svg
              className="w-5 h-5 text-[#C94F13] transform -rotate-12 translate-y-[-4px]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
            </svg>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STATE 1: CHECKING RECOVERY SESSION                            */}
        {/* ------------------------------------------------------------- */}
        {status === 'checking' && (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5E2D2] text-[#C94F13]">
              <RefreshCw className="h-7 w-7 animate-spin" />
            </div>
            <p className="font-serif text-xl text-[#282019]">Validating reset request…</p>
            <p className="text-xs text-[#82776C]">Checking your security recovery link.</p>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 2: VALID RECOVERY SESSION — CREATE NEW PASSWORD FORM     */}
        {/* ------------------------------------------------------------- */}
        {status === 'ready' && (
          <div>
            <div className="text-center mb-6">
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#282019] tracking-tight">
                Create New Password
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#82776C] leading-relaxed max-w-[300px] mx-auto">
                Choose a new, secure password to protect your household account.
              </p>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs sm:text-sm text-red-700 leading-snug flex items-start gap-2">
                <span className="text-red-500 font-bold shrink-0 mt-0.5">•</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                  New Password
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
                      setFormError(null);
                    }}
                    placeholder="At least 8 characters"
                    className="w-full bg-transparent py-3.5 pl-10 pr-10 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none font-mono"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#82776C] hover:text-[#282019] transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#82776C]">Must be at least 8 characters.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                  Confirm New Password
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
                      setFormError(null);
                    }}
                    placeholder="Repeat new password"
                    className="w-full bg-transparent py-3.5 pl-10 pr-10 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none font-mono"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#82776C] hover:text-[#282019] transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onNavigateToSignIn}
                  className="inline-flex items-center gap-1.5 text-xs text-[#82776C] hover:text-[#C94F13] transition-colors py-1 font-medium cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cancel and back to Sign In</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 3: PASSWORD UPDATED SUCCESSFULLY                        */}
        {/* ------------------------------------------------------------- */}
        {status === 'success' && (
          <div className="py-2 text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50 shadow-sm animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="h-11 w-11 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#282019] tracking-tight">
                Password Updated Successfully!
              </h1>
              <p className="text-xs sm:text-sm text-[#82776C] leading-relaxed max-w-[320px] mx-auto">
                Your password has been changed. You can now sign in with your new credentials.
              </p>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={handleContinueToSignIn}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 4: ERROR / EXPIRED / INVALID RECOVERY SESSION            */}
        {/* ------------------------------------------------------------- */}
        {status === 'error' && (
          <div className="py-2 text-left space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <AlertCircle className="h-8 w-8" />
            </div>

            <div className="text-center space-y-1.5">
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#282019] tracking-tight">
                Password Reset Link Expired
              </h1>
              <p className="text-xs sm:text-sm text-[#82776C] leading-relaxed">
                {errorMessage || 'This password reset link is invalid or has expired.'}
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={onNavigateToSignIn}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <span>Back to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {!showRequestLink ? (
                <button
                  type="button"
                  onClick={() => setShowRequestLink(true)}
                  className="w-full text-center text-xs text-[#82776C] hover:text-[#C94F13] font-medium py-1 transition-colors cursor-pointer"
                >
                  Request a new password reset link
                </button>
              ) : (
                <form onSubmit={handleRequestResetLink} className="pt-2 space-y-2 border-t border-[#EBD9C8]/80">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C]">
                    Your Account Email
                  </label>
                  <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="name@family.com"
                      className="w-full bg-transparent py-3 pl-10 pr-3.5 text-xs sm:text-sm text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isRequesting || !requestEmail.trim()}
                    className="w-full py-2.5 px-4 rounded-xl border border-[#EBD9C8] bg-white hover:bg-[#FFFAF4] text-[#282019] text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isRequesting ? 'Sending...' : 'Send fresh reset link'}
                  </button>
                  {requestSuccess && (
                    <p className="text-center text-xs text-emerald-700 font-medium">
                      ✓ A new reset link was sent to your email.
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

