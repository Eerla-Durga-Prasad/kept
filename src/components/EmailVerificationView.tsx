import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Mail } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { KeptAuthUser, resendConfirmationEmail } from '../lib/auth';

export interface EmailVerificationViewProps {
  onVerificationComplete: (user: KeptAuthUser) => void;
  onNavigateToSignIn: () => void;
}

type VerificationStatus = 'verifying' | 'success' | 'no-session-success' | 'error';

export const EmailVerificationView: React.FC<EmailVerificationViewProps> = ({
  onVerificationComplete,
  onNavigateToSignIn,
}) => {
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<KeptAuthUser | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [showResendInput, setShowResendInput] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    async function processVerification() {
      if (!isSupabaseConfigured || !supabase) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage('Authentication service is not configured.');
        return;
      }

      // 1. Inspect search params and hash params
      const searchParams = new URLSearchParams(window.location.search);
      const hashString = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashString);

      // Check for error in query or hash (e.g. otp_expired, access_denied)
      const errorParam = searchParams.get('error') || hashParams.get('error');
      const errorCode = searchParams.get('error_code') || hashParams.get('error_code');
      const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

      if (errorParam || errorCode) {
        if (!isMounted) return;
        setStatus('error');
        const desc = errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, ' ')) : '';
        if (errorCode === 'otp_expired' || desc.toLowerCase().includes('expired')) {
          setErrorMessage('This email confirmation link has expired. Please sign in or request a new confirmation email.');
        } else if (desc.toLowerCase().includes('already') || desc.toLowerCase().includes('invalid')) {
          setErrorMessage('This confirmation link is invalid or has already been used. If your account is already active, please sign in.');
        } else {
          setErrorMessage(desc || 'Unable to verify email link. Please try signing in or request a new confirmation email.');
        }
        return;
      }

      try {
        // 2. PKCE code exchange if ?code= is present
        const code = searchParams.get('code');
        if (code) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!isMounted) return;
            setStatus('error');
            const msg = exchangeError.message.toLowerCase();
            if (msg.includes('expired') || msg.includes('invalid') || exchangeError.status === 400) {
              setErrorMessage('This verification link has expired or has already been used. Please request a new confirmation email.');
            } else {
              setErrorMessage(exchangeError.message || 'Verification code exchange failed.');
            }
            return;
          }

          if (exchangeData.user) {
            const user: KeptAuthUser = {
              id: exchangeData.user.id,
              email: exchangeData.user.email,
              phone: exchangeData.user.phone,
              full_name: exchangeData.user.user_metadata?.full_name ?? exchangeData.user.user_metadata?.name ?? null,
              avatar_url: exchangeData.user.user_metadata?.avatar_url ?? null,
            };

            // Clean URL query and hash
            if (typeof window !== 'undefined' && window.history?.replaceState) {
              window.history.replaceState(null, '', '/');
            }

            if (!isMounted) return;
            setVerifiedUser(user);
            setStatus('success');

            // Automatic redirect after short delay
            redirectTimer = setTimeout(() => {
              if (isMounted) {
                onVerificationComplete(user);
              }
            }, 2600);
            return;
          }
        }

        // 3. Implicit token flow / existing session check
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        // Also verify actual authenticated user object
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const activeUser = currentUser || session?.user;

        if (activeUser) {
          const verified: KeptAuthUser = {
            id: activeUser.id,
            email: activeUser.email,
            phone: activeUser.phone,
            full_name: activeUser.user_metadata?.full_name ?? activeUser.user_metadata?.name ?? null,
            avatar_url: activeUser.user_metadata?.avatar_url ?? null,
          };

          // Clean URL tokens
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState(null, '', '/');
          }

          if (!isMounted) return;
          setVerifiedUser(verified);
          setStatus('success');

          redirectTimer = setTimeout(() => {
            if (isMounted) {
              onVerificationComplete(verified);
            }
          }, 2600);
          return;
        }

        // 4. Verification completed on server but session is absent in current client
        // (e.g. cross-browser verification or restricted cookie context)
        if (hashParams.get('type') === 'signup' || searchParams.get('type') === 'signup' || window.location.pathname.includes('/auth/verified')) {
          if (!isMounted) return;
          setStatus('no-session-success');
          return;
        }

        // 5. Default fallback if opened directly without tokens or session
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage('No email confirmation tokens were found in the URL. Please click the link inside your confirmation email or sign in.');
      } catch (err: unknown) {
        if (!isMounted) return;
        setStatus('error');
        const msg = err instanceof Error ? err.message : 'An error occurred while confirming your email.';
        setErrorMessage(msg);
      }
    }

    processVerification();

    return () => {
      isMounted = false;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [onVerificationComplete]);

  // Resend confirmation email handler
  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim() || isResending) return;

    setIsResending(true);
    setResendSuccess(false);
    try {
      await resendConfirmationEmail(resendEmail.trim());
      setResendSuccess(true);
    } catch {
      // Handled gracefully in UI
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8EF] flex items-center justify-center p-3 sm:p-6 md:p-8 selection:bg-[#C94F13]/20 font-sans">
      {/* Background Ambience / Subtle Botanical Sprigs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-12 -right-12 w-72 h-72 rounded-full bg-[#F5E2D2]/40 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-[#F5E2D2]/30 blur-3xl" />
      </div>

      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-[#EBD9C8] shadow-[0_6px_32px_-4px_rgba(201,79,19,0.08),0_1px_3px_rgba(40,32,25,0.04)] p-6 sm:p-8 relative overflow-hidden z-10 transition-all duration-300 text-center">
        {/* Subtle Decorative Botanical Accent on Top-Right */}
        <div className="absolute -top-3 -right-3 w-20 h-20 pointer-events-none opacity-25 text-[#C94F13]">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <path d="M100,0 C70,12 45,45 35,75 C55,65 85,45 100,0 Z" />
          </svg>
        </div>

        {/* Kept Brand Logo */}
        <div className="mb-6">
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
        {/* STATE 1: VERIFYING IN PROGRESS                                */}
        {/* ------------------------------------------------------------- */}
        {status === 'verifying' && (
          <div className="py-6 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5E2D2] text-[#C94F13]">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#282019] tracking-tight">
              Verifying your email…
            </h1>
            <p className="text-xs sm:text-sm text-[#82776C] leading-relaxed max-w-xs mx-auto">
              Confirming your security credentials with Supabase. Please hold on a moment.
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 2: SUCCESS — EMAIL VERIFIED                             */}
        {/* ------------------------------------------------------------- */}
        {status === 'success' && (
          <div className="py-2 space-y-4">
            {/* Green Animated Checkmark Icon */}
            <div className="mx-auto relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50 shadow-sm transition-transform duration-500 scale-100 animate-in zoom-in-75">
              <CheckCircle2 className="h-11 w-11 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#282019] tracking-tight">
                Email Verified Successfully!
              </h1>
              <p className="text-xs sm:text-sm text-[#82776C] leading-relaxed max-w-[320px] mx-auto">
                Your Kept account is ready. Welcome to Kept!
              </p>
            </div>

            {/* Loading Indicator with "Opening your kitchen..." */}
            <div className="pt-4 flex flex-col items-center justify-center gap-2.5">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF7F2] border border-[#EBD9C8] text-xs font-medium text-[#282019]">
                <RefreshCw className="w-3.5 h-3.5 text-[#C94F13] animate-spin" />
                <span>Opening your kitchen...</span>
              </div>

              {/* Instant Action Button if user doesn't want to wait */}
              <button
                type="button"
                onClick={() => verifiedUser && onVerificationComplete(verifiedUser)}
                className="mt-2 text-xs font-semibold text-[#C94F13] hover:underline cursor-pointer"
              >
                Go directly to Kitchen →
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 3: VERIFIED BUT NO SESSION CREATED                      */}
        {/* ------------------------------------------------------------- */}
        {status === 'no-session-success' && (
          <div className="py-2 space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
              <CheckCircle2 className="h-11 w-11 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#282019] tracking-tight">
                Email Verified Successfully!
              </h1>
              <p className="text-xs sm:text-sm text-[#82776C] leading-relaxed max-w-[320px] mx-auto">
                Your Kept account is confirmed and ready. Please sign in with your password to access your household kitchen.
              </p>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={onNavigateToSignIn}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Sign In to Kept</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 4: ERROR / EXPIRED / INVALID LINK                       */}
        {/* ------------------------------------------------------------- */}
        {status === 'error' && (
          <div className="py-2 space-y-4 text-left">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <AlertCircle className="h-8 w-8" />
            </div>

            <div className="text-center space-y-1.5">
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#282019] tracking-tight">
                Verification Link Expired or Invalid
              </h1>
              <p className="text-xs sm:text-sm text-[#82776C] leading-relaxed">
                {errorMessage || 'This email confirmation link has expired or has already been used.'}
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={onNavigateToSignIn}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <span>Continue to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {!showResendInput ? (
                <button
                  type="button"
                  onClick={() => setShowResendInput(true)}
                  className="w-full text-center text-xs text-[#82776C] hover:text-[#C94F13] font-medium py-1 transition-colors cursor-pointer"
                >
                  Need a new confirmation email?
                </button>
              ) : (
                <form onSubmit={handleResend} className="pt-2 space-y-2 border-t border-[#EBD9C8]/80">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C]">
                    Email address
                  </label>
                  <div className="relative rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="name@family.com"
                      className="w-full bg-transparent py-3 pl-10 pr-3.5 text-xs sm:text-sm text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isResending || !resendEmail.trim()}
                    className="w-full py-2.5 px-4 rounded-xl border border-[#EBD9C8] bg-white hover:bg-[#FFFAF4] text-[#282019] text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isResending ? 'Sending...' : 'Resend confirmation link'}
                  </button>
                  {resendSuccess && (
                    <p className="text-center text-xs text-emerald-700 font-medium">
                      ✓ A fresh link has been sent to your email.
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

