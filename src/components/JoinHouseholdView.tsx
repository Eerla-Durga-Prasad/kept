import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  User,
  Loader2,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { invitationService, InvitationDetails } from '../services/invitationService';
import { syncEngine } from '../sync/syncEngine';

interface JoinHouseholdViewProps {
  token: string;
  onJoinSuccess: (householdId: string) => void;
  onCancel?: () => void;
}

export const JoinHouseholdView: React.FC<JoinHouseholdViewProps> = ({
  token,
  onJoinSuccess,
  onCancel,
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authentication state
  const [authUser, setAuthUser] = useState<{ id: string; email?: string } | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Join status
  const [isJoined, setIsJoined] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  // 1. Validate invitation and verify existing session on mount
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setLoading(true);
      setErrorMsg(null);

      try {
        // Check invitation info
        const info = await invitationService.getInvitationInfo(token);
        if (!isMounted) return;

        if (!info.valid) {
          if (info.reason === 'expired') {
            setErrorMsg('This invitation link has expired. Please ask the household owner for a new one.');
          } else if (info.reason === 'revoked') {
            setErrorMsg('This invitation link has been revoked by the household owner.');
          } else if (info.reason === 'already_accepted') {
            setErrorMsg('This invitation has already been used.');
          } else {
            setErrorMsg('This invitation link is invalid or no longer exists.');
          }
          setDetails(null);
          setLoading(false);
          return;
        }

        setDetails(info);

        // Check auth status
        if (isSupabaseConfigured && supabase) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user) {
            setAuthUser({
              id: sessionData.session.user.id,
              email: sessionData.session.user.email,
            });
            const userMeta = sessionData.session.user.user_metadata;
            if (userMeta?.full_name || userMeta?.name) {
              setDisplayName(userMeta.full_name || userMeta.name);
            }
          }
        } else {
          // Local simulation mode: check if active user is defined in syncEngine
          const localUserId = syncEngine.getCurrentUserId();
          if (localUserId) {
            setAuthUser({ id: localUserId });
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setErrorMsg((err as Error)?.message || 'Failed to verify invitation.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Handle Supabase Auth (or simulated local auth)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        if (authMode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password.trim(),
            options: {
              data: {
                full_name: displayName.trim() || undefined,
              },
            },
          });
          if (error) throw error;
          if (data.user) {
            setAuthUser({ id: data.user.id, email: data.user.email });
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
          });
          if (error) throw error;
          if (data.user) {
            setAuthUser({ id: data.user.id, email: data.user.email });
            if (data.user.user_metadata?.full_name) {
              setDisplayName(data.user.user_metadata.full_name);
            }
          }
        }
      } else {
        // Local simulation fallback
        if (!displayName.trim()) {
          throw new Error('Please enter your name to proceed.');
        }
        const generatedId = `usr_${displayName.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).substring(2, 6)}`;
        setAuthUser({ id: generatedId, email: `${generatedId}@kept.local` });
      }
    } catch (err: unknown) {
      setAuthError((err as Error)?.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Accept the invitation
  const handleAccept = async () => {
    if (!details || !authUser) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const finalName =
        displayName.trim() ||
        (authUser.email ? authUser.email.split('@')[0] : 'Family Member');

      const result = await invitationService.acceptInvitation({
        token,
        userId: authUser.id,
        memberName: finalName,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to accept invitation.');
      }

      if (result.already_member) {
        setAlreadyMember(true);
      } else {
        setIsJoined(true);
      }

      // Update sync engine with the joining user ID
      syncEngine.setCurrentUserId(authUser.id);

      setTimeout(() => {
        onJoinSuccess(result.household_id || details.household_id || 'h_default_household_01');
      }, 1600);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to join household.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-borderWarm p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-cream-200 border border-borderWarm flex items-center justify-center mx-auto text-terracotta-500 animate-pulse">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-2xl font-normal text-ink-900">
            Verifying Invitation...
          </h2>
          <p className="text-sm text-ink-500">
            Checking household security and link credentials.
          </p>
          <div className="flex justify-center pt-2">
            <Loader2 className="w-5 h-5 text-terracotta-500 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Expired / Revoked State
  if (errorMsg && !details) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-borderWarm p-8 shadow-card text-center space-y-5 animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-2xl font-normal text-ink-900">
              Invitation Unavailable
            </h2>
            <p className="text-sm text-ink-600 leading-relaxed">
              {errorMsg}
            </p>
          </div>
          <div className="pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-3 bg-cream-200 hover:bg-cream-300 text-ink-900 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Return to Kept
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Success / Already Member State
  if (isJoined || alreadyMember) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-borderWarm p-8 shadow-card text-center space-y-5 animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl bg-botanical-50 border border-botanical-200 flex items-center justify-center mx-auto text-botanical-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-ink-900">
              {alreadyMember ? 'Already a Member!' : 'Welcome to the Household!'}
            </h2>
            <p className="text-sm text-ink-600 leading-relaxed">
              {alreadyMember
                ? `You are already part of ${details?.household_name || 'this household'}. Redirecting you to your shared lists...`
                : `You are now connected to ${details?.household_name || 'the household'}. Your groceries and meals will sync in real time across all devices.`}
            </p>
          </div>
          <div className="pt-4 flex justify-center">
            <Loader2 className="w-5 h-5 text-botanical-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // 4. Main Invitation View
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-borderWarm shadow-card overflow-hidden animate-fadeIn">
        {/* Top Header Card */}
        <div className="bg-cream-50/80 p-6 sm:p-8 border-b border-borderWarm text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-terracotta-50 border border-terracotta-200 text-terracotta-600 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-terracotta-600 block">
            Household Invitation
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-normal text-ink-900 leading-snug break-words">
            Join {details?.household_name || 'Prasad Household'}
          </h1>
          <p className="text-xs sm:text-sm text-ink-600 max-w-sm mx-auto font-normal leading-relaxed">
            <span className="font-medium text-ink-900">{details?.inviter_name || 'A family member'}</span> invited you to share grocery lists, meal plans, and kitchen inventory.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Metadata badges */}
          <div className="flex items-center justify-between p-3.5 bg-cream-50 rounded-xl border border-borderWarm text-xs text-ink-700">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-botanical-600 shrink-0" />
              <span>Role: <strong className="font-semibold text-ink-900">{details?.role || 'Member'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-ink-500">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Valid for 7 days</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Conditional: If User is Not Authenticated, show Clean Auth / Identity Form */}
          {!authUser ? (
            <div className="space-y-4">
              <div className="border-t border-borderWarm pt-4">
                <div className="flex items-center gap-2 mb-2 text-ink-900">
                  <Lock className="w-4 h-4 text-terracotta-500" />
                  <h3 className="font-serif text-lg font-medium">
                    {isSupabaseConfigured
                      ? authMode === 'signup'
                        ? 'Create your account to join'
                        : 'Sign in to join'
                      : 'Enter your name to join'}
                  </h3>
                </div>
                <p className="text-xs text-ink-500">
                  {isSupabaseConfigured
                    ? 'Authenticate your profile to link this household invitation to your account.'
                    : 'Provide your name so other family members recognize your contributions.'}
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                {(!isSupabaseConfigured || authMode === 'signup') && (
                  <div>
                    <label className="block text-[11px] font-semibold text-ink-700 uppercase tracking-wider mb-1">
                      Your Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-ink-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Durga Prasad"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-cream-50 border border-borderWarm rounded-xl text-sm text-ink-900 focus:outline-none focus:border-terracotta-500"
                      />
                    </div>
                  </div>
                )}

                {isSupabaseConfigured && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-700 uppercase tracking-wider mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-ink-400 absolute left-3 top-3" />
                        <input
                          type="email"
                          required
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 bg-cream-50 border border-borderWarm rounded-xl text-sm text-ink-900 focus:outline-none focus:border-terracotta-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-ink-700 uppercase tracking-wider mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-ink-400 absolute left-3 top-3" />
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 bg-cream-50 border border-borderWarm rounded-xl text-sm text-ink-900 focus:outline-none focus:border-terracotta-500"
                        />
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-subtle mt-2"
                >
                  {authLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {isSupabaseConfigured
                          ? authMode === 'signup'
                            ? 'Continue to Invitation'
                            : 'Sign In and Continue'
                          : 'Continue to Join'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {isSupabaseConfigured && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                      setAuthError(null);
                    }}
                    className="text-xs text-ink-500 hover:text-terracotta-600 transition-colors"
                  >
                    {authMode === 'signup'
                      ? 'Already have an account? Sign In'
                      : "Don't have an account? Sign Up"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* User is Authenticated: Show Clean Confirmation & Join Action */
            <div className="space-y-4">
              <div className="p-3.5 bg-cream-50 rounded-xl border border-borderWarm space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 block">
                  Joining As
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center text-ink-700 text-xs font-semibold font-serif">
                      {(displayName || authUser.email || 'You').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-ink-900 block">
                        {displayName || authUser.email || 'Family Member'}
                      </span>
                      {authUser.email && (
                        <span className="text-[11px] text-ink-500 font-mono block">
                          {authUser.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
              </div>

              {!displayName && (
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 uppercase tracking-wider mb-1">
                    Display Name in Household
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maya"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-cream-50 border border-borderWarm rounded-xl text-sm text-ink-900 focus:outline-none focus:border-terracotta-500"
                  />
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={submitting}
                  className="w-full py-3.5 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-subtle"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Joining Household...</span>
                    </>
                  ) : (
                    <>
                      <span>Accept Invitation & Join</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {onCancel && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs text-ink-400 hover:text-ink-700 transition-colors"
                  >
                    Decline / Return to app
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
