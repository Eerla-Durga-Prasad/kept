import React, { useState } from 'react';
import { HouseholdMember } from '../sync/types';
import { Link as LinkIcon, Copy, Check, ShieldCheck, UserPlus, Pencil } from 'lucide-react';
import { EditProfileModal } from '../components/EditProfileModal';
import { syncEngine } from '../sync/syncEngine';
import { invitationService, getAppBaseUrl } from '../services/invitationService';

interface HouseholdProps {
  members: HouseholdMember[];
  currentMember?: HouseholdMember | null;
  onOpenInviteModal: () => void;
  onUpdateMember?: (updated: HouseholdMember) => Promise<void> | void;
}

export const Household: React.FC<HouseholdProps> = ({
  members,
  currentMember,
  onOpenInviteModal,
  onUpdateMember,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);

  // Authenticated primary user identity
  const activeUserId = syncEngine.getCurrentUserId();

  // Prefer the authenticated user's matching user_id when available
  const authenticatedMember = activeUserId
    ? members.find((m) => m.user_id === activeUserId)
    : null;

  // Use currentMember only when its identity is reliably associated with the active user
  const reliableCurrentMember =
    currentMember && activeUserId && currentMember.user_id === activeUserId
      ? members.find((m) => m.id === currentMember.id) || currentMember
      : null;

  const activeMember = authenticatedMember || reliableCurrentMember || null;

  const householdId =
    currentMember?.household_id || members[0]?.household_id || 'h_default_household_01';
  const [inviteLink, setInviteLink] = useState<string>('');

  React.useEffect(() => {
    let isMounted = true;
    invitationService
      .getOrCreateActiveInviteLink(householdId, activeUserId || 'durga_prasad')
      .then((link) => {
        if (isMounted) setInviteLink(link);
      })
      .catch(() => {
        if (isMounted) setInviteLink(`${getAppBaseUrl()}/join`);
      });
    return () => {
      isMounted = false;
    };
  }, [householdId, activeUserId]);

  const handleCopyLink = async () => {
    let linkToCopy = inviteLink;
    if (!linkToCopy) {
      try {
        linkToCopy = await invitationService.getOrCreateActiveInviteLink(
          householdId,
          activeUserId || 'durga_prasad'
        );
        setInviteLink(linkToCopy);
      } catch {
        linkToCopy = `${getAppBaseUrl()}/join`;
      }
    }
    await navigator.clipboard.writeText(linkToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEdit = (member: HouseholdMember) => {
    if (!activeMember) return;
    const isCurrentMember =
      member.id === activeMember.id ||
      (Boolean(activeUserId) && member.user_id === activeUserId);
    if (!isCurrentMember) return;
    setEditingMember(member);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (updated: HouseholdMember) => {
    if (onUpdateMember) {
      await onUpdateMember(updated);
    }
    setIsEditModalOpen(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8 animate-fadeIn box-border">
      {/* Header */}
      <div className="pb-5 sm:pb-6 mb-6 sm:mb-8 border-b border-borderWarm">
        {/* Desktop Header */}
        <div className="hidden md:flex md:items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900 break-words">
              Household
            </h1>
            <p className="font-serif italic text-sm sm:text-base text-ink-600 mt-1.5 font-normal break-words">
              Good food brings people closer.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenInviteModal}
            className="px-4 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 shadow-subtle transition-colors cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4 stroke-[2]" />
            <span>+ Invite member</span>
          </button>
        </div>

        {/* Mobile Header (matches reference image) */}
        <div className="md:hidden">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink-900">
            Household
          </h1>
          <div className="flex items-center justify-between gap-3 mt-1.5">
            <p className="font-serif italic text-sm text-ink-600 leading-snug">
              Good food brings<br />people closer.
            </p>
            <button
              type="button"
              onClick={onOpenInviteModal}
              className="px-3.5 py-2 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 shadow-subtle transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4 stroke-[2]" />
              <span>+ Invite member</span>
            </button>
          </div>
        </div>
      </div>

      {/* Household Members Cards */}
      <div className="space-y-3.5 sm:space-y-6 mb-8 sm:mb-10">
        <div className="flex items-center justify-between gap-2.5 sm:gap-4">
          <h2 className="font-serif text-xl sm:text-2xl font-normal text-ink-900 break-words">
            Family Members ({members.length})
          </h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#2E7D32] font-normal bg-[#E8F5E9]/60 px-2.5 py-1 rounded-full border border-[#C8E6C9] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#34A853]" />
            <span>All devices in sync</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-borderWarm shadow-card divide-y divide-borderWarm/60 overflow-hidden">
          {members.map((member) => {
            const isCurrent = Boolean(
              activeMember &&
                (member.id === activeMember.id ||
                  (Boolean(activeUserId) && member.user_id === activeUserId))
            );

            return (
              <React.Fragment key={member.id}>
                {/* Desktop layout row (hidden on mobile, visible on md and up) */}
                <div className="hidden md:flex items-center justify-between p-5 hover:bg-cream-50/70 transition-colors gap-3">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-borderWarm"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center font-serif text-sm font-semibold text-ink-800">
                          {member.initials}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-botanical-500 border-2 border-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-base text-ink-900 break-words">
                          {member.name}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cream-200 text-ink-700 border border-borderWarm shrink-0">
                            You
                          </span>
                        )}
                        {member.role === 'Owner' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-botanical-50 text-botanical-800 border border-botanical-200 shrink-0">
                            <ShieldCheck className="w-3 h-3" />
                            Owner
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-ink-500 mt-0.5 block break-words leading-relaxed">
                        {member.role === 'Owner'
                          ? 'Household creator & primary manager'
                          : 'Collaborating family member'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(member)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-terracotta-600 hover:text-terracotta-700 bg-terracotta-50 hover:bg-terracotta-100 border border-terracotta-200 rounded-lg transition-colors cursor-pointer"
                        title="Edit your profile"
                        aria-label="Edit Profile"
                      >
                        <Pencil className="w-3.5 h-3.5 stroke-[2]" />
                        <span>Edit</span>
                      </button>
                    )}
                    <span className="text-xs font-mono text-ink-600 bg-cream-100 px-2.5 py-1 rounded-md border border-borderWarm">
                      {member.role}
                    </span>
                  </div>
                </div>

                {/* Mobile layout card (matches reference image) */}
                <div className="flex md:hidden items-center justify-between p-3.5 sm:p-4 gap-2.5 sm:gap-3 hover:bg-cream-50/70 transition-colors">
                  {/* LEFT: Circular Profile Avatar */}
                  <div className="relative shrink-0">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="w-11 h-11 rounded-full object-cover border border-borderWarm"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center font-serif text-sm font-semibold text-ink-800">
                        {member.initials}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#34A853] border-2 border-white" />
                  </div>

                  {/* CENTER: Name, 'You' badge, description */}
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-sm text-ink-900 leading-snug truncate">
                        {member.name}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#EBE7DF] text-ink-700 shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-500 leading-normal mt-0.5 break-words">
                      {member.role === 'Owner'
                        ? 'Household creator & primary manager'
                        : 'Collaborating family member'}
                    </p>
                  </div>

                  {/* RIGHT: Role Badge & Edit action in dedicated stable action area */}
                  <div className="shrink-0 flex items-center justify-end gap-2">
                    {member.role === 'Owner' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5 stroke-[2]" />
                        <span>Owner</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-normal text-ink-700 bg-[#F7F5F0] border border-[#E5E0D5] shrink-0">
                        {member.role}
                      </span>
                    )}

                    {isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(member)}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-white hover:bg-cream-50 active:bg-cream-100 border border-terracotta-300 text-terracotta-600 flex items-center justify-center transition-colors shadow-sm shrink-0 cursor-pointer"
                        title="Edit profile"
                        aria-label="Edit profile"
                      >
                        <Pencil className="w-4 h-4 stroke-[2]" />
                      </button>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Invite with link Section */}
      <div className="bg-white rounded-2xl border border-borderWarm p-4 sm:p-6 shadow-card space-y-3.5">
        <div className="flex items-center gap-2.5">
          <LinkIcon className="w-5 h-5 text-terracotta-500 shrink-0" />
          <h3 className="font-serif text-xl sm:text-2xl font-medium text-ink-900">
            Invite with link
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-ink-600 max-w-2xl font-normal leading-relaxed break-words">
          Share this private invitation link with your family members. Once accepted on their phone or tablet, their grocery edits, check-offs, and meal requests will sync instantly.
        </p>

        {/* Mobile: Full-width clean Copy invite link button (matches reference image) */}
        <div className="md:hidden pt-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full py-3 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-subtle"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" />
                <span>Copy invite link</span>
              </>
            )}
          </button>
        </div>

        {/* Desktop: Readonly Input + Button row (preserved exactly as before) */}
        <div className="hidden md:flex items-stretch md:items-center gap-3 pt-2">
          <input
            type="text"
            readOnly
            value={inviteLink}
            className="w-full md:flex-1 min-w-0 px-3.5 py-2.5 bg-cream-50 border border-borderWarm rounded-xl text-xs sm:text-sm font-mono text-ink-800 focus:outline-none select-all"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full md:w-auto shrink-0 whitespace-nowrap px-5 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-subtle min-h-[44px] md:min-h-0"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" />
                <span>Copy Invite Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Profile Edit Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        member={editingMember}
        onSave={handleSaveProfile}
      />
    </div>
  );
};
