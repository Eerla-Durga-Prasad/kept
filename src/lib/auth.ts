import { supabase, isSupabaseConfigured } from './supabase';

export interface KeptAuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface PasswordValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validate password strength
 * Minimum 8 characters
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long.',
    };
  }
  return { isValid: true };
}

/**
 * Get the application callback URL for email redirection
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return '';
}

/**
 * Sign in using Supabase email + password
 */
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<KeptAuthUser> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to enable sign-in.'
    );
  }

  const cleanEmail = email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  if (!password) {
    throw new Error('Please enter your password.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();

    // Check for unconfirmed email
    if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
      const unconfirmedErr = new Error(
        'Your email address has not been confirmed yet. Please check your inbox for the confirmation link.'
      );
      (unconfirmedErr as Error & { isEmailNotConfirmed?: boolean }).isEmailNotConfirmed = true;
      throw unconfirmedErr;
    }

    // Invalid credentials
    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid credentials') ||
      msg.includes('invalid grant') ||
      error.status === 400
    ) {
      throw new Error('Invalid email or password. Please check your credentials and try again.');
    }

    // Rate limit
    if (msg.includes('rate limit') || error.status === 429) {
      throw new Error('Too many login attempts. Please wait a minute and try again.');
    }

    throw new Error(error.message || 'Unable to sign in. Please try again.');
  }

  if (!data?.user) {
    throw new Error('Sign-in succeeded but no user session was returned.');
  }

  return {
    id: data.user.id,
    email: data.user.email,
    phone: data.user.phone,
    full_name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null,
    avatar_url: data.user.user_metadata?.avatar_url ?? null,
  };
}

/**
 * Register a new user with email and password
 * Sends a confirmation email with {{ .ConfirmationURL }}
 */
export async function signUpWithEmailPassword(
  email: string,
  password: string,
  fullName?: string
): Promise<{ user: KeptAuthUser | null; requiresEmailConfirmation: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const cleanEmail = email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new Error(passwordValidation.message || 'Password must be at least 8 characters long.');
  }

  const emailRedirectTo = getAppBaseUrl() ? `${getAppBaseUrl()}/` : undefined;

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        full_name: fullName?.trim() || '',
      },
      emailRedirectTo,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('user already exists')) {
      throw new Error('An account with this email address already exists. Please sign in instead.');
    }
    if (msg.includes('rate limit') || error.status === 429) {
      throw new Error('Too many signup attempts. Please wait a minute before trying again.');
    }
    throw new Error(error.message || 'Unable to create account. Please try again.');
  }

  // Detect Supabase user enumeration prevention where user identities array is empty
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('An account with this email address already exists. Please sign in instead.');
  }

  // If email confirmation is enabled, session will be null
  const requiresEmailConfirmation = !data?.session;

  const user: KeptAuthUser | null = data?.user
    ? {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        full_name: fullName?.trim() || data.user.user_metadata?.full_name || null,
        avatar_url: data.user.user_metadata?.avatar_url ?? null,
      }
    : null;

  return { user, requiresEmailConfirmation };
}

/**
 * Resend the confirmation email link to the user
 */
export async function resendConfirmationEmail(email: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const cleanEmail = email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  const emailRedirectTo = getAppBaseUrl() ? `${getAppBaseUrl()}/` : undefined;

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: cleanEmail,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate limit') || error.status === 429) {
      throw new Error('Too many requests. Please wait a minute before requesting another link.');
    }
    throw new Error(error.message || 'Unable to resend confirmation email.');
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const cleanEmail = email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  const redirectTo = getAppBaseUrl() ? `${getAppBaseUrl()}/` : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate limit') || error.status === 429) {
      throw new Error('Too many requests. Please wait a minute before requesting another link.');
    }
    throw new Error(error.message || 'Unable to send password reset email.');
  }
}

/**
 * Update the user's password (e.g. after following a recovery link)
 */
export async function updateUserPassword(newPassword: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    throw new Error(validation.message || 'Password must be at least 8 characters long.');
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message || 'Unable to update password. Please try again.');
  }
}

/**
 * Sign out the current user
 */
export async function signOutCurrentUser(): Promise<void> {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
}

/**
 * Profile helpers for local caching of display names
 */
export function getStoredProfile(userId: string): { full_name?: string; avatar_url?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`kept_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfileForUser(
  userId: string,
  profile: { full_name?: string; avatar_url?: string }
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`kept_profile_${userId}`, JSON.stringify(profile));
  } catch {
    // Ignore storage errors in private browsing or quota-limited environments.
  }
}
