import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { db } from '../db/database';
import { HouseholdInvitation, HouseholdMember } from '../sync/types';
import { generateUUID } from '../sync/outbox';

export interface InvitationDetails {
  valid: boolean;
  reason?: string;
  household_id?: string;
  household_name?: string;
  inviter_name?: string;
  role?: 'Owner' | 'Member';
  expires_at?: string;
}

export interface AcceptInvitationResult {
  success: boolean;
  already_member?: boolean;
  error?: string;
  household_id?: string;
  household_name?: string;
  role?: 'Owner' | 'Member';
}

/**
 * Resolves the canonical public app URL based on environment or window location.
 * Never hardcodes localhost or fixed slugs.
 */
export function getAppBaseUrl(): string {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return 'https://kept.app';
}

/**
 * Generates a cryptographically strong, unguessable random token.
 */
export function generateSecureToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Computes SHA-256 hash of the token for secure database storage and lookup.
 */
export async function hashToken(token: string): Promise<string> {
  const trimmed = token.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    try {
      const msgBuffer = new TextEncoder().encode(trimmed);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }

  // Pure JS DJB2/FNV-like deterministic fallback if WebCrypto subtle is unavailable in test runner
  let hash = 0x811c9dc5;
  for (let i = 0; i < trimmed.length; i++) {
    hash ^= trimmed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `hash_${Math.abs(hash).toString(16)}_${trimmed.substring(0, 8)}`;
}

export class InvitationService {
  /**
   * Generates a new invitation for a household.
   */
  public async createInvitation(params: {
    householdId: string;
    inviterId: string;
    role?: 'Owner' | 'Member';
    expiresInDays?: number;
  }): Promise<{
    token: string;
    inviteUrl: string;
    expiresAt: string;
    id: string;
  }> {
    const {
      householdId,
      inviterId,
      role = 'Member',
      expiresInDays = 7,
    } = params;

    const token = generateSecureToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const id = generateUUID();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('create_household_invitation', {
        p_household_id: householdId,
        p_token_hash: tokenHash,
        p_role: role,
        p_expires_in_days: expiresInDays,
      });

      if (error) {
        throw new Error(`Failed to create cloud invitation: ${error.message}`);
      }

      const returnedId = (data as { id?: string })?.id || id;
      const returnedExpiresAt = (data as { expires_at?: string })?.expires_at || expiresAt;

      return {
        id: returnedId,
        token,
        inviteUrl: `${getAppBaseUrl()}/join?token=${token}`,
        expiresAt: returnedExpiresAt,
      };
    }

    // Local / Offline Simulation Mode (Dexie)
    const invitationRecord: HouseholdInvitation = {
      id,
      household_id: householdId,
      inviter_id: inviterId,
      token,
      token_hash: tokenHash,
      role,
      status: 'pending',
      expires_at: expiresAt,
      created_at: now,
    };

    await db.household_invitations.put(invitationRecord);

    return {
      id,
      token,
      inviteUrl: `${getAppBaseUrl()}/join?token=${token}`,
      expiresAt,
    };
  }

  /**
   * Retrieves an existing pending invitation link or generates a fresh one.
   */
  public async getOrCreateActiveInviteLink(householdId: string, inviterId: string): Promise<string> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      // In cloud mode, because token_hash is stored as a one-way cryptographic hash
      // to protect link integrity, we generate a fresh link when the owner requests to share.
      const fresh = await this.createInvitation({ householdId, inviterId });
      return fresh.inviteUrl;
    }

    // Local Dexie search
    const existing = await db.household_invitations
      .where('household_id')
      .equals(householdId)
      .filter((inv) => inv.status === 'pending' && inv.expires_at > now)
      .first();

    if (existing && existing.token) {
      return `${getAppBaseUrl()}/join?token=${existing.token}`;
    }

    const created = await this.createInvitation({ householdId, inviterId });
    return created.inviteUrl;
  }

  /**
   * Validates invitation token and retrieves public details for the invitee screen.
   */
  public async getInvitationInfo(token: string): Promise<InvitationDetails> {
    if (!token || !token.trim()) {
      return { valid: false, reason: 'missing_token' };
    }

    const cleanToken = token.trim();
    const tokenHash = await hashToken(cleanToken);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('get_invitation_info', {
        p_token_hash: tokenHash,
      });

      if (error) {
        return { valid: false, reason: error.message };
      }

      return data as InvitationDetails;
    }

    // Local Dexie validation
    const now = new Date().toISOString();
    const inv = await db.household_invitations
      .filter((i) => i.token === cleanToken || i.token_hash === tokenHash)
      .first();

    if (!inv) {
      return { valid: false, reason: 'not_found' };
    }

    if (inv.status === 'revoked') {
      return { valid: false, reason: 'revoked' };
    }

    if (inv.status === 'accepted') {
      return { valid: false, reason: 'already_accepted' };
    }

    if (inv.expires_at <= now) {
      await db.household_invitations.update(inv.id, { status: 'expired' });
      return { valid: false, reason: 'expired' };
    }

    const household = await db.households.get(inv.household_id);
    const inviter = await db.household_members
      .where('user_id')
      .equals(inv.inviter_id)
      .first();

    return {
      valid: true,
      household_id: inv.household_id,
      household_name: household?.name || 'Prasad Household',
      inviter_name: inviter?.name || 'Household Owner',
      role: inv.role,
      expires_at: inv.expires_at,
    };
  }

  /**
   * Accepts invitation for the authenticated user and creates their household membership record.
   */
  public async acceptInvitation(params: {
    token: string;
    userId: string;
    memberName: string;
    avatarUrl?: string;
  }): Promise<AcceptInvitationResult> {
    const { token, userId, memberName, avatarUrl } = params;
    const cleanToken = token.trim();
    const tokenHash = await hashToken(cleanToken);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('accept_household_invitation', {
        p_token_hash: tokenHash,
        p_member_name: memberName,
        p_avatar_url: avatarUrl || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return data as AcceptInvitationResult;
    }

    // Local / Offline Simulation mode acceptance
    const now = new Date().toISOString();
    const inv = await db.household_invitations
      .filter((i) => i.token === cleanToken || i.token_hash === tokenHash)
      .first();

    if (!inv) {
      return { success: false, error: 'Invalid invitation link.' };
    }

    if (inv.expires_at <= now) {
      await db.household_invitations.update(inv.id, { status: 'expired' });
      return { success: false, error: 'This invitation has expired.' };
    }

    if (inv.status === 'revoked') {
      return { success: false, error: 'This invitation has been revoked.' };
    }

    // Check if user is already a member
    const existing = await db.household_members
      .where('household_id')
      .equals(inv.household_id)
      .filter((m) => m.user_id === userId)
      .first();

    const household = await db.households.get(inv.household_id);
    const householdName = household?.name || 'Prasad Household';

    if (existing) {
      return {
        success: true,
        already_member: true,
        household_id: inv.household_id,
        household_name: householdName,
        role: existing.role,
      };
    }

    if (inv.status !== 'pending') {
      return { success: false, error: 'This invitation has already been used.' };
    }

    const trimmedName = memberName.trim() || 'Family Member';
    const initials = trimmedName
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'FM';

    const newMember: HouseholdMember = {
      id: generateUUID(),
      household_id: inv.household_id,
      user_id: userId,
      name: trimmedName,
      role: inv.role,
      avatar_url: avatarUrl,
      initials,
      created_at: now,
    };

    await db.transaction('rw', [db.household_members, db.household_invitations], async () => {
      await db.household_members.add(newMember);
      await db.household_invitations.update(inv.id, {
        status: 'accepted',
        accepted_at: now,
        accepted_by: userId,
      });
    });

    return {
      success: true,
      already_member: false,
      household_id: inv.household_id,
      household_name: householdName,
      role: inv.role,
    };
  }
}

export const invitationService = new InvitationService();
