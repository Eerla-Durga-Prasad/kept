import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  KeptAuthUser,
  saveProfileForUser,
  sendEmailOtp,
  sendPhoneOtp,
  signInWithOAuth,
  verifyEmailOtp,
  verifyPhoneOtp,
} from '../lib/auth';

export interface AuthFlowProps {
  onAuthenticated: (user: KeptAuthUser) => void;
}

type AuthMode = 'email' | 'mobile';
type AuthStep = 'welcome' | 'otp' | 'profile';

interface CountryCode {
  code: string;
  name: string;
  flag: string;
  placeholder: string;
  formatLength: number;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: '+91', name: 'India', flag: '🇮🇳', placeholder: '98765 43210', formatLength: 10 },
  { code: '+1', name: 'US / Canada', flag: '🇺🇸', placeholder: '(555) 000-0000', formatLength: 10 },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', placeholder: '7911 123456', formatLength: 10 },
  { code: '+971', name: 'UAE', flag: '🇦🇪', placeholder: '50 123 4567', formatLength: 9 },
  { code: '+61', name: 'Australia', flag: '🇦🇺', placeholder: '412 345 678', formatLength: 9 },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', placeholder: '9123 4567', formatLength: 8 },
  { code: '+49', name: 'Germany', flag: '🇩🇪', placeholder: '151 12345678', formatLength: 10 },
];

const OTP_LENGTH = 6;
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

/** Mask a phone number for privacy display (e.g. +91 9876543210 -> +91 98••• ••210) */
function maskPhone(countryCode: string, phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return `${countryCode} ${phone}`;
  const start = digits.slice(0, 2);
  const end = digits.slice(-3);
  return `${countryCode} ${start}••• ••${end}`;
}

export const AuthFlow: React.FC<AuthFlowProps> = ({ onAuthenticated }) => {
  // State
  const [authMode, setAuthMode] = useState<AuthMode>('email');
  const [step, setStep] = useState<AuthStep>('welcome');
  const [email, setEmail] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pendingUser, setPendingUser] = useState<KeptAuthUser | null>(null);

  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const countryMenuRef = useRef<HTMLDivElement | null>(null);

  // Close country dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryMenuRef.current && !countryMenuRef.current.contains(e.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Combined full phone number
  const fullPhoneNumber = useMemo(() => {
    const cleanDigits = phoneDigits.replace(/\D/g, '');
    return `${selectedCountry.code}${cleanDigits}`;
  }, [selectedCountry.code, phoneDigits]);

  // Destination preview string
  const destinationPreview = useMemo(() => {
    if (authMode === 'email') {
      return maskEmail(email);
    }
    return maskPhone(selectedCountry.code, phoneDigits);
  }, [authMode, email, selectedCountry.code, phoneDigits]);

  // OTP Management
  const isOtpComplete = otp.every((d) => d.length === 1);

  const handleOtpInput = (index: number, value: string) => {
    setError(null);
    const cleaned = value.replace(/\D/g, '');

    // Multi-digit paste into single box
    if (cleaned.length > 1) {
      const pasteDigits = cleaned.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      pasteDigits.forEach((d, i) => {
        if (i < OTP_LENGTH) newOtp[i] = d;
      });
      setOtp(newOtp);
      const nextFocus = Math.min(pasteDigits.length, OTP_LENGTH - 1);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleaned.slice(-1);
    setOtp(newOtp);

    // Auto advance focus
    if (cleaned && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        e.preventDefault();
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        otpInputRefs.current[index - 1]?.focus();
      } else if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!paste) return;

    const newOtp = [...otp];
    paste.split('').forEach((d, i) => {
      newOtp[i] = d;
    });
    setOtp(newOtp);
    const nextFocus = Math.min(paste.length, OTP_LENGTH - 1);
    otpInputRefs.current[nextFocus]?.focus();
  };

  // 1. Send OTP (Email or Phone)
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (authMode === 'email') {
      const cleanEmail = email.trim();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setError('Please enter a valid email address.');
        return;
      }

      setIsSubmitting(true);
      try {
        await sendEmailOtp(cleanEmail);
        setStep('otp');
        setOtp(Array(OTP_LENGTH).fill(''));
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setSuccessNotice(
          step === 'otp'
            ? `A fresh 6-digit code has been sent to ${maskEmail(cleanEmail)}`
            : `A 6-digit code was sent to ${maskEmail(cleanEmail)}`
        );
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 50);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to send verification code. Please try again.';
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const raw = phoneDigits.replace(/\D/g, '');
      if (raw.length < 8) {
        setError('Please enter a valid mobile number.');
        return;
      }

      setIsSubmitting(true);
      try {
        await sendPhoneOtp(fullPhoneNumber);
        setStep('otp');
        setOtp(Array(OTP_LENGTH).fill(''));
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setSuccessNotice(
          step === 'otp'
            ? `A fresh 6-digit SMS code has been sent to ${maskPhone(selectedCountry.code, raw)}`
            : `A 6-digit SMS code was sent to ${maskPhone(selectedCountry.code, raw)}`
        );
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 50);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to send verification SMS.';
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // 2. Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    await handleSendOtp();
  };

  // 3. Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = otp.join('');
    if (token.length !== OTP_LENGTH) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessNotice(null);

    try {
      let verifiedUser: KeptAuthUser;

      if (authMode === 'email') {
        const result = await verifyEmailOtp(email, token);
        verifiedUser = result.user;
      } else {
        const result = await verifyPhoneOtp(fullPhoneNumber, token);
        verifiedUser = result.user;
      }

      // Check if user already has a display name
      if (verifiedUser.full_name && verifiedUser.full_name.trim().length > 0) {
        onAuthenticated(verifiedUser);
      } else {
        // Offer quick name setup
        setPendingUser(verifiedUser);
        setStep('profile');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid verification code. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Complete Profile Setup
  const handleCompleteProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingUser) return;

    const trimmedName = fullName.trim();
    const finalUser: KeptAuthUser = {
      ...pendingUser,
      full_name: trimmedName || (authMode === 'email' ? email.split('@')[0] : 'Family Member'),
    };

    if (trimmedName) {
      saveProfileForUser(finalUser.id, { full_name: trimmedName });
    }

    onAuthenticated(finalUser);
  };

  // 5. Social OAuth
  const handleSocialSignIn = async (provider: 'google' | 'github') => {
    setError(null);
    try {
      await signInWithOAuth(provider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `${provider} sign-in failed.`;
      setError(message);
    }
  };

  // Fallback view if Supabase client is not configured
  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="min-h-screen bg-[#FFF8EF] flex items-center justify-center p-4 selection:bg-[#C94F13]/20">
        <div className="w-full max-w-[420px] bg-white rounded-3xl border border-[#EBD9C8] p-7 sm:p-9 shadow-[0_4px_24px_-2px_rgba(201,79,19,0.06),0_1px_3px_rgba(40,32,25,0.04)] text-center relative overflow-hidden">
          {/* Decorative Corner Leaves */}
          <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-20 text-[#C94F13]">
            <svg viewBox="0 0 100 100" fill="currentColor">
              <path d="M100,0 C70,10 40,40 30,70 C50,60 80,40 100,0 Z" />
            </svg>
          </div>

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5E2D2] text-[#C94F13] shadow-subtle">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <span className="font-serif text-3xl font-semibold tracking-tight text-[#282019]">Kept</span>
          <p className="mt-2 font-serif text-xl text-[#282019]">Connect your cloud workspace</p>
          <p className="mt-2 text-xs sm:text-sm text-[#82776C] leading-relaxed">
            To enable real email & phone authentication, paste your project credentials into <code className="bg-[#FFF8EF] px-1.5 py-0.5 rounded text-[#C94F13] font-mono text-xs">.env.local</code>:
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
        {/* SCREEN A & C: WELCOME / CHOOSE EMAIL OR MOBILE               */}
        {/* ------------------------------------------------------------- */}
        {step === 'welcome' && (
          <div>
            {/* Brand Logo & Tagline */}
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

              <h1 className="mt-2.5 font-serif text-2xl sm:text-3xl font-normal text-[#282019] tracking-tight">
                Good food. Shared lives.
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#82776C] leading-relaxed max-w-[310px] mx-auto">
                Plan meals, save recipes, shop smarter and cook together with your household.
              </p>
            </div>

            {/* Selectable Authentication Tabs */}
            <div className="flex p-1 bg-[#F5E2D2]/60 rounded-2xl border border-[#EBD9C8]/70 mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('email');
                  setError(null);
                }}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  authMode === 'email'
                    ? 'bg-white text-[#282019] font-semibold shadow-sm border border-[#EBD9C8]/80'
                    : 'text-[#82776C] hover:text-[#282019]'
                }`}
              >
                <Mail className={`w-4 h-4 ${authMode === 'email' ? 'text-[#C94F13]' : 'text-[#82776C]'}`} />
                <span>Email</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('mobile');
                  setError(null);
                }}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  authMode === 'mobile'
                    ? 'bg-white text-[#282019] font-semibold shadow-sm border border-[#EBD9C8]/80'
                    : 'text-[#82776C] hover:text-[#282019]'
                }`}
              >
                <Smartphone className={`w-4 h-4 ${authMode === 'mobile' ? 'text-[#C94F13]' : 'text-[#82776C]'}`} />
                <span>Mobile</span>
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs sm:text-sm text-red-700 leading-snug flex items-start gap-2">
                <span className="text-red-500 font-bold shrink-0 mt-0.5">•</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSendOtp} className="space-y-4">
              {authMode === 'email' ? (
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
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                    Mobile number
                  </label>
                  <div className="flex gap-2">
                    {/* Country Selector Dropdown */}
                    <div className="relative" ref={countryMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsCountryDropdownOpen((prev) => !prev)}
                        className="h-full px-3 py-3.5 rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] text-[#282019] text-xs sm:text-sm font-medium flex items-center gap-1.5 hover:border-[#C94F13]/50 focus:outline-none transition-colors"
                      >
                        <span className="text-base">{selectedCountry.flag}</span>
                        <span>{selectedCountry.code}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-[#82776C]" />
                      </button>

                      {isCountryDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1.5 w-52 max-h-60 overflow-y-auto bg-white rounded-2xl border border-[#EBD9C8] shadow-float z-30 p-1.5 text-xs">
                          {COUNTRY_CODES.map((country) => (
                            <button
                              key={country.code + country.name}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(country);
                                setIsCountryDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left hover:bg-[#FFF8EF] transition-colors ${
                                selectedCountry.code === country.code ? 'font-semibold text-[#C94F13] bg-[#FFF8EF]' : 'text-[#282019]'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="text-base">{country.flag}</span>
                                <span>{country.name}</span>
                              </span>
                              <span className="text-[#82776C] font-mono">{country.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phone Input */}
                    <div className="relative flex-1 rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] focus-within:border-[#C94F13] focus-within:ring-2 focus-within:ring-[#C94F13]/15 transition-all">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#82776C]">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="tel"
                        value={phoneDigits}
                        onChange={(e) => {
                          setPhoneDigits(e.target.value);
                          setError(null);
                        }}
                        placeholder={selectedCountry.placeholder}
                        className="w-full bg-transparent py-3.5 pl-10 pr-3.5 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:outline-none font-mono"
                        inputMode="numeric"
                        autoComplete="tel"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || (authMode === 'email' ? !email.trim() : !phoneDigits.trim())}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending 6-digit code...</span>
                  </>
                ) : (
                  <>
                    <span>{authMode === 'email' ? 'Continue with Email' : 'Send OTP'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Social Authentication Section */}
            <div className="mt-6 pt-5 border-t border-[#EBD9C8]/70">
              <p className="text-center text-[11px] uppercase tracking-wider text-[#82776C] font-semibold mb-3">
                or continue with
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSocialSignIn('google')}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-[#EBD9C8] bg-white hover:bg-[#FFFAF4] text-[#282019] text-xs font-medium transition-colors shadow-subtle"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialSignIn('github')}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-[#EBD9C8] bg-white hover:bg-[#FFFAF4] text-[#282019] text-xs font-medium transition-colors shadow-subtle"
                >
                  <svg className="w-4 h-4 fill-current text-[#282019]" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>GitHub</span>
                </button>
              </div>
            </div>

            {/* Privacy & Trust Badge */}
            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[#82776C]">
              <Lock className="w-3.5 h-3.5 text-[#C94F13]" />
              <span>Your data is private and secure.</span>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SCREEN D: PREMIUM OTP VERIFICATION                            */}
        {/* ------------------------------------------------------------- */}
        {step === 'otp' && (
          <div>
            {/* Top Back Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  setStep('welcome');
                  setError(null);
                  setSuccessNotice(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#82776C] hover:text-[#C94F13] transition-colors py-1 px-2 rounded-xl hover:bg-[#FFF8EF]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change {authMode === 'email' ? 'email' : 'phone'}</span>
              </button>

              <div className="flex items-center gap-1 text-[11px] text-[#82776C] font-mono">
                <span>Step 2 of 2</span>
              </div>
            </div>

            {/* Premium OTP Envelope Illustration */}
            <div className="text-center mb-5">
              <div className="relative mx-auto mb-3 h-20 w-24">
                <svg viewBox="0 0 96 80" fill="none" className="w-full h-full">
                  {/* Envelope Body */}
                  <rect x="8" y="24" width="80" height="52" rx="12" fill="#FFFAF4" stroke="#EBD9C8" strokeWidth="2" />
                  {/* Flap fold shadow */}
                  <path d="M10 26 L48 54 L86 26" stroke="#EBD9C8" strokeWidth="2" strokeLinejoin="round" />
                  {/* Card sliding out */}
                  <rect x="18" y="10" width="60" height="34" rx="6" fill="#FFFFFF" stroke="#EBD9C8" strokeWidth="1.5" />
                  {/* Code dots on card */}
                  <circle cx="33" cy="24" r="3" fill="#C94F13" />
                  <circle cx="43" cy="24" r="3" fill="#C94F13" />
                  <circle cx="53" cy="24" r="3" fill="#C94F13" />
                  <circle cx="63" cy="24" r="3" fill="#C94F13" />
                  {/* Terracotta Wax Stamp with Heart / Leaf */}
                  <circle cx="48" cy="54" r="10" fill="#C94F13" />
                  <circle cx="48" cy="54" r="8" fill="#B3430E" />
                  <path d="M48 50 C46 47 43 49 45 52 L48 56 L51 52 C53 49 50 47 48 50 Z" fill="#FFF8EF" />
                </svg>
              </div>

              <h2 className="font-serif text-2xl sm:text-3xl text-[#282019] tracking-tight">
                Verify OTP
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#82776C] leading-relaxed">
                Enter the 6-digit code sent to
              </p>
              <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 bg-[#F5E2D2]/60 rounded-full border border-[#EBD9C8]/80 text-xs font-semibold text-[#282019]">
                <span>{destinationPreview}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep('welcome');
                    setError(null);
                    setSuccessNotice(null);
                  }}
                  className="ml-1 text-[11px] text-[#C94F13] hover:underline font-medium cursor-pointer"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Success Notification */}
            {successNotice && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs sm:text-sm text-red-700 leading-snug flex items-start gap-2">
                <span className="text-red-500 font-bold shrink-0 mt-0.5">•</span>
                <span>{error}</span>
              </div>
            )}

            {/* Six OTP Input Boxes */}
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex justify-between gap-1 min-[360px]:gap-2 sm:gap-2.5 max-w-xs mx-auto">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpInputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    aria-label={`Digit ${index + 1}`}
                    autoFocus={index === 0}
                    className={`w-[38px] min-[360px]:w-11 sm:w-12 h-12 sm:h-14 text-center text-lg min-[360px]:text-xl sm:text-2xl font-semibold text-[#282019] bg-[#FFFAF4] border rounded-xl focus:border-[#C94F13] focus:ring-2 focus:ring-[#C94F13]/20 focus:outline-none transition-all shadow-subtle ${
                      digit ? 'border-[#C94F13] bg-white font-bold' : 'border-[#EBD9C8]'
                    }`}
                  />
                ))}
              </div>

              {/* Resend Action with Countdown */}
              <div className="flex items-center justify-between text-xs text-[#82776C] px-1">
                <span>Didn't receive the code?</span>
                {resendCooldown > 0 ? (
                  <span className="font-medium text-[#82776C] font-mono">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSubmitting}
                    className="font-semibold text-[#C94F13] hover:text-[#A83C0B] transition-colors underline underline-offset-2"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={isSubmitting || !isOtpComplete}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying & entering...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SCREEN E: FIRST-TIME PROFILE SETUP                            */}
        {/* ------------------------------------------------------------- */}
        {step === 'profile' && pendingUser && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5E2D2] text-[#C94F13] shadow-subtle">
              <Sparkles className="h-8 w-8" />
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl text-[#282019] tracking-tight">
              Welcome to the family
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#82776C] max-w-xs mx-auto leading-relaxed">
              What should your household members call you?
            </p>

            <form onSubmit={handleCompleteProfile} className="mt-6 space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#82776C] mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Durga Prasad"
                  className="w-full rounded-2xl border border-[#EBD9C8] bg-[#FFFAF4] px-4 py-3.5 text-sm sm:text-base text-[#282019] placeholder:text-[#82776C]/60 focus:border-[#C94F13] focus:ring-2 focus:ring-[#C94F13]/15 focus:outline-none transition-all shadow-subtle"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-5 bg-gradient-to-r from-[#C94F13] to-[#B3430E] hover:from-[#B3430E] hover:to-[#96350A] text-white font-medium text-sm sm:text-base rounded-2xl shadow-[0_2px_8px_rgba(201,79,19,0.22)] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <span>Enter Kept Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleCompleteProfile}
                className="w-full text-center text-xs text-[#82776C] hover:text-[#282019] transition-colors py-1"
              >
                Skip for now
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
