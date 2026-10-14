import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Mail, Link as LinkIcon, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { HouseholdMember } from '../sync/types';
import { invitationService, getAppBaseUrl } from '../services/invitationService';
import { syncEngine } from '../sync/syncEngine';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: HouseholdMember[];
  onAddMember?: (name: string, role: 'Owner' | 'Member') => void;
}

export const HouseholdModal: React.FC<HouseholdModalProps> = ({
  isOpen,
  onClose,
  members,
}) => {
  const [copied, setCopied] = useState(false);
  const [dedicatedCopied, setDedicatedCopied] = useState(false);
  const [activeInviteUrl, setActiveInviteUrl] = useState<string>('');
  const [loadingLink, setLoadingLink] = useState(false);

  // Invite member state
  const [inviteeName, setInviteeName] = useState('');
  const [inviteeRole, setInviteeRole] = useState<'Owner' | 'Member'>('Member');
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [customInviteUrl, setCustomInviteUrl] = useState<string | null>(null);

  const activeUserId = syncEngine.getCurrentUserId() || 'durga_prasad';
  const householdId = members[0]?.household_id || 'h_default_household_01';

  // Load existing or fresh active invitation link on modal open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoadingLink(true);

    invitationService
      .getOrCreateActiveInviteLink(householdId, activeUserId)
      .then((link) => {
        if (isMounted) {
          setActiveInviteUrl(link);
          setLoadingLink(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setActiveInviteUrl(`${getAppBaseUrl()}/join`);
          setLoadingLink(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, householdId, activeUserId]);

  if (!isOpen) return null;

  const handleCopyGeneralLink = async () => {
    let urlToCopy = activeInviteUrl;
    if (!urlToCopy) {
      try {
        urlToCopy = await invitationService.getOrCreateActiveInviteLink(householdId, activeUserId);
        setActiveInviteUrl(urlToCopy);
      } catch {
        urlToCopy = `${getAppBaseUrl()}/join`;
      }
    }
    await navigator.clipboard.writeText(urlToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateCustomInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteeName.trim()) return;

    setGeneratingCustom(true);
    try {
      const result = await invitationService.createInvitation({
        householdId,
        inviterId: activeUserId,
        role: inviteeRole,
        expiresInDays: 7,
      });

      setCustomInviteUrl(result.inviteUrl);
      await navigator.clipboard.writeText(result.inviteUrl);
      setDedicatedCopied(true);
      setTimeout(() => setDedicatedCopied(false), 2500);
    } catch {
      // Fallback
      setCustomInviteUrl(`${getAppBaseUrl()}/join`);
    } finally {
      setGeneratingCustom(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-cream-50 rounded-2xl border border-borderWarm shadow-float overflow-hidden z-10 flex flex-col max-h-[90vh] animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-borderWarm bg-white/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center text-ink-700">
              <Users className="w-5 h-5 text-terracotta-500" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-medium tracking-tight text-ink-900">
                Household Members
              </h2>
              <p className="text-xs text-ink-500">
                Collaborative kitchen and grocery management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-ink-400 hover:text-ink-700 hover:bg-cream-200 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Members list */}
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">
              Active Household ({members.length})
            </span>
            <div className="bg-white rounded-xl border border-borderWarm divide-y divide-borderWarm-subtle shadow-card">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="w-9 h-9 rounded-full object-cover border border-borderWarm"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-terracotta-100 text-terracotta-700 flex items-center justify-center text-xs font-semibold font-serif">
                        {member.initials}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-900">
                          {member.name}
                        </span>
                        {member.role === 'Owner' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-botanical-50 text-botanical-700 border border-botanical-200">
                            <ShieldCheck className="w-3 h-3" />
                            Owner
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-ink-400">
                        {member.user_id === activeUserId ? 'Your active device' : 'Household Member'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-ink-500 font-mono">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Copyable General Invite link */}
          <div className="bg-white rounded-xl border border-borderWarm p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-terracotta-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-800">
                Private Invitation Link
              </span>
            </div>
            <p className="text-xs text-ink-500">
              Share this secure, unguessable link with your family members to let them authenticate and join this household.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={loadingLink ? 'Generating secure link...' : activeInviteUrl}
                className="flex-1 min-w-0 px-3 py-2 text-xs bg-cream-50 border border-borderWarm rounded-lg text-ink-700 font-mono select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyGeneralLink}
                disabled={loadingLink}
                className="px-3 py-2 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-subtle"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Create Dedicated Invitation for Member */}
          <form
            onSubmit={handleGenerateCustomInvite}
            className="bg-white rounded-xl border border-borderWarm p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-800 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-terracotta-500" />
                Invite Member by Role
              </span>
              <span className="text-[10px] text-ink-400 font-mono">
                Links authenticated accounts
              </span>
            </div>
            <p className="text-xs text-ink-500">
              Generates a private invitation that links their authenticated Supabase account upon acceptance.
            </p>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Member name or nickname..."
                value={inviteeName}
                onChange={(e) => {
                  setInviteeName(e.target.value);
                  setCustomInviteUrl(null);
                }}
                className="col-span-2 px-3 py-2 text-xs bg-cream-50 border border-borderWarm rounded-lg text-ink-900 focus:outline-none focus:border-terracotta-500"
              />
              <select
                value={inviteeRole}
                onChange={(e) => {
                  setInviteeRole(e.target.value as 'Owner' | 'Member');
                  setCustomInviteUrl(null);
                }}
                className="px-2 py-2 text-xs bg-cream-50 border border-borderWarm rounded-lg text-ink-900 focus:outline-none focus:border-terracotta-500"
              >
                <option value="Member">Member</option>
                <option value="Owner">Owner</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!inviteeName.trim() || generatingCustom}
              className="w-full py-2.5 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-subtle"
            >
              {generatingCustom ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating invitation...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create & Copy Invitation Link</span>
                </>
              )}
            </button>

            {customInviteUrl && (
              <div className="p-3 bg-botanical-50 border border-botanical-200 rounded-lg text-xs space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between text-botanical-800 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-botanical-600" />
                    Invitation ready for {inviteeName} ({inviteeRole})
                  </span>
                  {dedicatedCopied && (
                    <span className="text-[10px] bg-botanical-200/60 px-2 py-0.5 rounded text-botanical-800">
                      Copied!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={customInviteUrl}
                    className="flex-1 px-2.5 py-1 text-[11px] bg-white border border-botanical-200 rounded font-mono text-ink-800 select-all"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(customInviteUrl);
                      setDedicatedCopied(true);
                      setTimeout(() => setDedicatedCopied(false), 2000);
                    }}
                    className="p-1.5 bg-botanical-600 hover:bg-botanical-700 text-white rounded cursor-pointer"
                    title="Copy Link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
