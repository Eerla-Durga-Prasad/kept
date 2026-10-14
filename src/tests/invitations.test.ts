import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Household, HouseholdMember, HouseholdInvitation } from '../sync/types';

// In-memory collections for isolated testing
const inMemoryInvitations: HouseholdInvitation[] = [];
const inMemoryMembers: HouseholdMember[] = [];
const inMemoryHouseholds: Household[] = [];

vi.mock('../db/database', () => {
  return {
    db: {
      household_invitations: {
        put: async (item: HouseholdInvitation) => {
          const idx = inMemoryInvitations.findIndex((i) => i.id === item.id);
          if (idx >= 0) inMemoryInvitations[idx] = { ...item };
          else inMemoryInvitations.push({ ...item });
        },
        get: async (id: string) => {
          return inMemoryInvitations.find((i) => i.id === id);
        },
        update: async (id: string, updates: Partial<HouseholdInvitation>) => {
          const item = inMemoryInvitations.find((i) => i.id === id);
          if (item) Object.assign(item, updates);
        },
        filter: (fn: (item: HouseholdInvitation) => boolean) => ({
          first: async () => inMemoryInvitations.find(fn) || undefined,
        }),
        where: (field: string) => ({
          equals: (val: any) => ({
            filter: (fn: (item: HouseholdInvitation) => boolean) => ({
              first: async () =>
                inMemoryInvitations.filter((i) => (i as any)[field] === val).find(fn) || undefined,
            }),
            first: async () =>
              inMemoryInvitations.find((i) => (i as any)[field] === val) || undefined,
          }),
        }),
        clear: async () => {
          inMemoryInvitations.length = 0;
        },
      },
      household_members: {
        add: async (item: HouseholdMember) => {
          inMemoryMembers.push({ ...item });
        },
        put: async (item: HouseholdMember) => {
          const idx = inMemoryMembers.findIndex((m) => m.id === item.id);
          if (idx >= 0) inMemoryMembers[idx] = { ...item };
          else inMemoryMembers.push({ ...item });
        },
        where: (field: string) => ({
          equals: (val: any) => ({
            first: async () =>
              inMemoryMembers.find((m) => (m as any)[field] === val) || undefined,
            filter: (fn: (m: HouseholdMember) => boolean) => ({
              first: async () =>
                inMemoryMembers.filter((m) => (m as any)[field] === val).find(fn) || undefined,
            }),
            count: async () =>
              inMemoryMembers.filter((m) => (m as any)[field] === val).length,
          }),
        }),
        clear: async () => {
          inMemoryMembers.length = 0;
        },
      },
      households: {
        put: async (h: Household) => {
          const idx = inMemoryHouseholds.findIndex((i) => i.id === h.id);
          if (idx >= 0) inMemoryHouseholds[idx] = { ...h };
          else inMemoryHouseholds.push({ ...h });
        },
        get: async (id: string) => inMemoryHouseholds.find((h) => h.id === id) || undefined,
        clear: async () => {
          inMemoryHouseholds.length = 0;
        },
      },
      transaction: async (_mode: any, _tables: any, fn: () => Promise<any>) => {
        return await fn();
      },
    },
  };
});

import { db } from '../db/database';
import {
  generateSecureToken,
  hashToken,
  getAppBaseUrl,
  InvitationService,
} from '../services/invitationService';

describe('Household Invitation System', () => {
  let invitationService: InvitationService;
  const testHouseholdId = 'h_test_family_01';
  const testInviterId = 'usr_owner_01';

  beforeEach(async () => {
    // Clear in-memory tables before each test
    await db.household_invitations.clear();
    await db.household_members.clear();
    await db.households.clear();

    // Setup base household and owner
    const household: Household = {
      id: testHouseholdId,
      name: 'Prasad Household',
      created_at: new Date().toISOString(),
    };
    await db.households.put(household);

    const ownerMember: HouseholdMember = {
      id: 'm_owner_01',
      household_id: testHouseholdId,
      user_id: testInviterId,
      name: 'Durga Prasad',
      role: 'Owner',
      initials: 'DP',
      created_at: new Date().toISOString(),
    };
    await db.household_members.put(ownerMember);

    invitationService = new InvitationService();
  });

  describe('Cryptographic & URL Helpers', () => {
    it('generates unguessable secure tokens with sufficient length', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThanOrEqual(24);
    });

    it('computes deterministic token hashes', async () => {
      const token = 'kept_secure_token_abc123';
      const hash1 = await hashToken(token);
      const hash2 = await hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(token);
    });

    it('resolves base URL without trailing slash and falls back safely', () => {
      const baseUrl = getAppBaseUrl();
      expect(baseUrl).toBeDefined();
      expect(baseUrl.endsWith('/')).toBe(false);
      // Ensures no hardcoded slugs
      expect(baseUrl).not.toContain('/prasad-family-78f9');
    });
  });

  describe('Invitation Creation', () => {
    it('creates a secure invitation with pending status and correct expiration', async () => {
      const invitation = await invitationService.createInvitation({
        householdId: testHouseholdId,
        inviterId: testInviterId,
        role: 'Member',
        expiresInDays: 7,
      });

      expect(invitation.token).toBeDefined();
      expect(invitation.inviteUrl).toContain(`/join?token=${invitation.token}`);
      expect(new Date(invitation.expiresAt).getTime()).toBeGreaterThan(Date.now());

      // Verify stored record in Dexie
      const stored = await db.household_invitations.get(invitation.id);
      expect(stored).toBeDefined();
      expect(stored?.status).toBe('pending');
      expect(stored?.role).toBe('Member');
      expect(stored?.household_id).toBe(testHouseholdId);
      expect(stored?.token_hash).toBeDefined();
    });

    it('reuses active pending link or generates fresh link', async () => {
      const link1 = await invitationService.getOrCreateActiveInviteLink(testHouseholdId, testInviterId);
      expect(link1).toContain('/join?token=');

      // Calling again returns the existing valid pending invitation link
      const link2 = await invitationService.getOrCreateActiveInviteLink(testHouseholdId, testInviterId);
      expect(link2).toBe(link1);
    });
  });

  describe('Invitation Info & Validation', () => {
    it('returns public details for valid pending invitation', async () => {
      const created = await invitationService.createInvitation({
        householdId: testHouseholdId,
        inviterId: testInviterId,
        role: 'Member',
      });

      const info = await invitationService.getInvitationInfo(created.token);
      expect(info.valid).toBe(true);
      expect(info.household_name).toBe('Prasad Household');
      expect(info.inviter_name).toBe('Durga Prasad');
      expect(info.role).toBe('Member');
    });

    it('handles empty, invalid, and missing tokens gracefully', async () => {
      const emptyInfo = await invitationService.getInvitationInfo('');
      expect(emptyInfo.valid).toBe(false);
      expect(emptyInfo.reason).toBe('missing_token');

      const nonExistent = await invitationService.getInvitationInfo('random_nonexistent_token_999');
      expect(nonExistent.valid).toBe(false);
      expect(nonExistent.reason).toBe('not_found');
    });

    it('rejects expired invitations', async () => {
      const created = await invitationService.createInvitation({
        householdId: testHouseholdId,
        inviterId: testInviterId,
        role: 'Member',
        expiresInDays: -1, // Expired in the past
      });

      const info = await invitationService.getInvitationInfo(created.token);
      expect(info.valid).toBe(false);
      expect(info.reason).toBe('expired');
    });

    it('rejects revoked invitations', async () => {
      const created = await invitationService.createInvitation({
        householdId: testHouseholdId,
        inviterId: testInviterId,
        role: 'Member',
      });

      await db.household_invitations.update(created.id, { status: 'revoked' });

      const info = await invitationService.getInvitationInfo(created.token);
      expect(info.valid).toBe(false);
      expect(info.reason).toBe('revoked');
    });
  });

  describe('Acceptance & Duplicate Prevention', () => {
    it('accepts invitation and creates authenticated member record', async () => {
      const created = await invitationService.createInvitation({
        householdId: testHouseholdId,
        inviterId: testInviterId,
        role: 'Member',
      });

      const acceptResult = await invitationService.acceptInvitation({
        token: created.token,
        userId: 'usr_invitee_42',
        memberName: 'Priya Prasad',
      });

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.already_member).toBe(false);
      expect(acceptResult.household_id).toBe(testHouseholdId);

      // Verify member record was created
      const newMember = await db.household_members
        .where('user_id')
        .equals('usr_invitee_42')
        .first();

      expect(newMember).toBeDefined();
      expect(newMember?.name).toBe('Priya Prasad');
      expect(newMember?.role).toBe('Member');
      expect(newMember?.household_id).toBe(testHouseholdId);

      // Verify invitation status transitioned to accepted
      const updatedInv = await db.household_invitations.get(created.id);
      expect(updatedInv?.status).toBe('accepted');
      expect(updatedInv?.accepted_by).toBe('usr_invitee_42');
    });

    it('prevents duplicate membership when user is already a member', async () => {
      const created = await invitationService.createInvitation({
        householdId: testHouseholdId,
        inviterId: testInviterId,
        role: 'Member',
      });

      // Durga Prasad is already an owner/member
      const result = await invitationService.acceptInvitation({
        token: created.token,
        userId: testInviterId,
        memberName: 'Durga Prasad',
      });

      expect(result.success).toBe(true);
      expect(result.already_member).toBe(true);

      // Total members should remain 1 (no duplicate Durga Prasad created)
      const count = await db.household_members.where('household_id').equals(testHouseholdId).count();
      expect(count).toBe(1);
    });

    it('rejects subsequent use of single-use invitation by another user', async () => {
      const created = await invitationService.createInvitation({
        householdId: testHouseholdId,
        inviterId: testInviterId,
        role: 'Member',
      });

      // User 1 accepts
      const res1 = await invitationService.acceptInvitation({
        token: created.token,
        userId: 'usr_user_1',
        memberName: 'User One',
      });
      expect(res1.success).toBe(true);

      // User 2 tries to use the same invitation
      const res2 = await invitationService.acceptInvitation({
        token: created.token,
        userId: 'usr_user_2',
        memberName: 'User Two',
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('already been used');
    });
  });
});
