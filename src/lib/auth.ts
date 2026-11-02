import { supabase, isSupabaseConfigured } from './supabase';

export interface KeptAuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

export async function sendEmailOtp(email: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to enable sign-in.');
  }

  const cleanedEmail = email.trim();
  if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('rate limit') || error.status === 429) {
      throw new Error('Too many requests. Please wait a minute before requesting another code.');
    }
    throw error;
  }
}

export async function verifyEmailOtp(email: string, token: string): Promise<{ user: KeptAuthUser }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const cleanEmail = email.trim();
  const cleanToken = token.trim();

  // 1. Try standard passwordless email OTP
  let { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: 'email',
  });

  // 2. If rejected and could be a fresh signup OTP, retry with type: 'signup'
  if (
    error &&
    (error.message.toLowerCase().includes('expired') ||
      error.message.toLowerCase().includes('invalid') ||
      error.status === 400)
  ) {
    const signupAttempt = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'signup',
    });
    if (!signupAttempt.error && signupAttempt.data.user) {
      data = signupAttempt.data;
      error = null;
    }
  }

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('expired')) {
      throw new Error('The 6-digit code has expired. Please request a new code.');
    }
    if (msg.includes('invalid') || msg.includes('token')) {
      throw new Error('The code you entered is incorrect. Please check your email and try again.');
    }
    throw error;
  }

  if (!data?.user) {
    throw new Error('Verification succeeded but no authenticated user session was returned.');
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null,
      avatar_url: data.user.user_metadata?.avatar_url ?? null,
    },
  };
}

export async function sendPhoneOtp(phone: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to enable phone sign-in.');
  }

  const cleaned = phone.trim();
  if (!/^\+?[0-9\s-]{8,15}$/.test(cleaned)) {
    throw new Error('Please enter a valid mobile number with country code.');
  }

  const normalized = cleaned.startsWith('+') ? cleaned : `+91${cleaned.replace(/\D/g, '')}`;

  const { error } = await supabase.auth.signInWithOtp({
    phone: normalized,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('unsupported phone provider') ||
        msg.includes('sms provider') ||
        msg.includes('provider is not enabled') ||
        (error.status === 400 && msg.includes('phone'))) {
      throw new Error('Phone authentication is not enabled in your Supabase project settings. Please sign in with Email OTP.');
    }
    if (msg.includes('rate limit') || error.status === 429) {
      throw new Error('Too many requests. Please wait a minute before requesting another code.');
    }
    throw error;
  }
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<{ user: KeptAuthUser }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const cleanedPhone = phone.trim();
  const normalizedPhone = cleanedPhone.startsWith('+') ? cleanedPhone : `+91${cleanedPhone.replace(/\D/g, '')}`;

  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token: token.trim(),
    type: 'sms',
  });

  if (error) {
    if (error.message.toLowerCase().includes('expired') || error.message.toLowerCase().includes('invalid')) {
      throw new Error('The 6-digit SMS code is invalid or has expired. Please check or request a new code.');
    }
    throw error;
  }

  if (!data.user) {
    throw new Error('Verification succeeded but no authenticated user session was returned.');
  }

  return {
    user: {
      id: data.user.id,
      phone: data.user.phone,
      full_name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null,
      avatar_url: data.user.user_metadata?.avatar_url ?? null,
    },
  };
}

export async function signInWithOAuth(provider: 'google' | 'github'): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('not enabled') || msg.includes('unsupported provider')) {
      throw new Error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in is not enabled in your Supabase project. Please use Email OTP.`);
    }
    throw error;
  }
}

export async function signOutCurrentUser(): Promise<void> {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
}

export function getStoredProfile(userId: string): { full_name?: string; avatar_url?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`kept_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfileForUser(userId: string, profile: { full_name?: string; avatar_url?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`kept_profile_${userId}`, JSON.stringify(profile));
  } catch {
    // Ignore storage errors in private browsing or quota-limited environments.
  }
}
