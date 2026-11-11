import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import { App, resolveAuthViewFromPath, AUTH_ONLY_PATHS } from '../App';
import { AuthFlow } from '../components/AuthFlow';

describe('Authentication Routing & Login Gate', () => {
  it('renders Sign In / Create Account tabs and Welcome back heading on AuthFlow', () => {
    const html = renderToStaticMarkup(
      <AuthFlow onAuthenticated={vi.fn()} initialView="signin" />
    );
    expect(html).toContain('Welcome back');
    expect(html).toContain('Sign In');
    expect(html).toContain('Create Account');
    expect(html).toContain('Forgot password?');
  });

  it('renders Create Account registration view when initialView is signup', () => {
    const html = renderToStaticMarkup(
      <AuthFlow onAuthenticated={vi.fn()} initialView="signup" />
    );
    expect(html).toContain('Good food. Shared lives.');
    expect(html).toContain('Create Account');
    expect(html).toContain('Your full name');
  });

  it('does not render Dashboard on initial unauthenticated App mount', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Preparing your household space');
    expect(html).not.toContain('Today&#x27;s Kitchen Plan');
  });

  it('resolves auth routes properly to signin or signup', () => {
    expect(resolveAuthViewFromPath('/')).toBe('signin');
    expect(resolveAuthViewFromPath('/login')).toBe('signin');
    expect(resolveAuthViewFromPath('/signin')).toBe('signin');
    expect(resolveAuthViewFromPath('/signup')).toBe('signup');
    expect(resolveAuthViewFromPath('/create-account')).toBe('signup');
    expect(resolveAuthViewFromPath('/register')).toBe('signup');
    expect(AUTH_ONLY_PATHS.has('login')).toBe(true);
    expect(AUTH_ONLY_PATHS.has('signup')).toBe(true);
  });
});
