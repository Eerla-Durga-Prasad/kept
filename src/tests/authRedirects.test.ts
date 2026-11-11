import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signUpWithEmailPassword,
  resendConfirmationEmail,
  sendPasswordResetEmail,
  getAppBaseUrl,
} from '../lib/auth';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

describe('Auth Redirect URLs & Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Redirect URL Configuration', () => {
    it('sets emailRedirectTo targeting /auth/callback for signup', async () => {
      vi.mocked(supabase!.auth.signUp).mockResolvedValueOnce({
        data: {
          user: { id: 'u1', email: 'test@example.com', identities: [{ id: '1' }] } as any,
          session: null,
        },
        error: null,
      });

      await signUpWithEmailPassword('test@example.com', 'strongpassword123', 'Test User');

      expect(supabase?.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          options: expect.objectContaining({
            emailRedirectTo: `${getAppBaseUrl()}/auth/callback`,
          }),
        })
      );
    });

    it('sets emailRedirectTo targeting /auth/callback for resend confirmation', async () => {
      vi.mocked(supabase!.auth.resend).mockResolvedValueOnce({
        data: {} as any,
        error: null,
      });

      await resendConfirmationEmail('test@example.com');

      expect(supabase?.auth.resend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'signup',
          email: 'test@example.com',
          options: expect.objectContaining({
            emailRedirectTo: `${getAppBaseUrl()}/auth/callback`,
          }),
        })
      );
    });

    it('sets redirectTo targeting /reset-password for password recovery', async () => {
      vi.mocked(supabase!.auth.resetPasswordForEmail).mockResolvedValueOnce({
        data: {} as any,
        error: null,
      });

      await sendPasswordResetEmail('test@example.com');

      expect(supabase?.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: `${getAppBaseUrl()}/reset-password`,
        })
      );
    });
  });
});

