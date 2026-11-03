import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validatePassword,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  resendConfirmationEmail,
  sendPasswordResetEmail,
  updateUserPassword,
} from '../lib/auth';
import { supabase } from '../lib/supabase';

// Mock Supabase client
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
    },
  },
}));

describe('Auth Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePassword', () => {
    it('rejects passwords shorter than 8 characters', () => {
      expect(validatePassword('1234567').isValid).toBe(false);
      expect(validatePassword('').isValid).toBe(false);
    });

    it('accepts passwords with 8 or more characters', () => {
      expect(validatePassword('12345678').isValid).toBe(true);
      expect(validatePassword('strong-secure-password').isValid).toBe(true);
    });
  });

  describe('signInWithEmailPassword', () => {
    it('validates email format before calling Supabase', async () => {
      await expect(signInWithEmailPassword('invalid-email', 'password123')).rejects.toThrow(
        'Please enter a valid email address.'
      );
      expect(supabase?.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('validates non-empty password', async () => {
      await expect(signInWithEmailPassword('user@example.com', '')).rejects.toThrow(
        'Please enter your password.'
      );
      expect(supabase?.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('returns KeptAuthUser on successful login', async () => {
      vi.mocked(supabase!.auth.signInWithPassword).mockResolvedValueOnce({
        data: {
          user: {
            id: 'user_123',
            email: 'durga@example.com',
            user_metadata: { full_name: 'Durga Prasad' },
          } as any,
          session: {} as any,
        },
        error: null,
      });

      const user = await signInWithEmailPassword('durga@example.com', 'mypassword123');
      expect(user.id).toBe('user_123');
      expect(user.email).toBe('durga@example.com');
      expect(user.full_name).toBe('Durga Prasad');
    });

    it('translates invalid credentials error safely', async () => {
      vi.mocked(supabase!.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 } as any,
      });

      await expect(signInWithEmailPassword('user@example.com', 'wrongpass')).rejects.toThrow(
        'Invalid email or password. Please check your credentials and try again.'
      );
    });

    it('detects unconfirmed email error and flags it', async () => {
      vi.mocked(supabase!.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed', status: 400 } as any,
      });

      try {
        await signInWithEmailPassword('user@example.com', 'password123');
        expect.fail('Should have thrown unconfirmed email error');
      } catch (err: any) {
        expect(err.message).toContain('email address has not been confirmed yet');
        expect(err.isEmailNotConfirmed).toBe(true);
      }
    });
  });

  describe('signUpWithEmailPassword', () => {
    it('rejects short passwords', async () => {
      await expect(signUpWithEmailPassword('newuser@example.com', 'short')).rejects.toThrow(
        'Password must be at least 8 characters long.'
      );
    });

    it('returns requiresEmailConfirmation true when session is null', async () => {
      vi.mocked(supabase!.auth.signUp).mockResolvedValueOnce({
        data: {
          user: {
            id: 'new_user_1',
            email: 'newuser@example.com',
            identities: [{ id: 'identity_1' }],
            user_metadata: { full_name: 'New User' },
          } as any,
          session: null,
        },
        error: null,
      });

      const result = await signUpWithEmailPassword('newuser@example.com', 'password123', 'New User');
      expect(result.requiresEmailConfirmation).toBe(true);
      expect(result.user?.id).toBe('new_user_1');
    });

    it('detects already registered email with empty identities array', async () => {
      vi.mocked(supabase!.auth.signUp).mockResolvedValueOnce({
        data: {
          user: {
            id: 'existing_user_1',
            email: 'existing@example.com',
            identities: [],
          } as any,
          session: null,
        },
        error: null,
      });

      await expect(signUpWithEmailPassword('existing@example.com', 'password123')).rejects.toThrow(
        'An account with this email address already exists. Please sign in instead.'
      );
    });
  });

  describe('resendConfirmationEmail', () => {
    it('calls supabase.auth.resend with type signup', async () => {
      vi.mocked(supabase!.auth.resend).mockResolvedValueOnce({
        data: {} as any,
        error: null,
      });

      await resendConfirmationEmail('user@example.com');
      expect(supabase?.auth.resend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'signup',
          email: 'user@example.com',
        })
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('calls supabase.auth.resetPasswordForEmail', async () => {
      vi.mocked(supabase!.auth.resetPasswordForEmail).mockResolvedValueOnce({
        data: {} as any,
        error: null,
      });

      await sendPasswordResetEmail('user@example.com');
      expect(supabase?.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(Object)
      );
    });
  });

  describe('updateUserPassword', () => {
    it('validates password length before calling updateUser', async () => {
      await expect(updateUserPassword('short')).rejects.toThrow(
        'Password must be at least 8 characters long.'
      );
      expect(supabase?.auth.updateUser).not.toHaveBeenCalled();
    });

    it('calls supabase.auth.updateUser with valid password', async () => {
      vi.mocked(supabase!.auth.updateUser).mockResolvedValueOnce({
        data: { user: {} as any },
        error: null,
      });

      await updateUserPassword('new-secure-pass123');
      expect(supabase?.auth.updateUser).toHaveBeenCalledWith({
        password: 'new-secure-pass123',
      });
    });
  });
});
