import React, { useState } from 'react';
import { HouseholdMember } from '../sync/types';
import { Link as LinkIcon, Copy, Check, ShieldCheck, UserPlus } from 'lucide-react';

interface HouseholdProps {
  members: HouseholdMember[];
  onOpenInviteModal: () => void;
}

export const Household: React.FC<HouseholdProps> = ({
  members,
  onOpenInviteModal,
}) => {
  const [copied, setCopied] = useState(false);
  const inviteLink = 'https://kept.app/join/prasad-family-78f9';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-8 border-b border-borderWarm">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900">
            Household
          </h1>
          <p className="font-serif italic text-sm sm:text-base text-ink-600 mt-1.5 font-normal">
            Good food brings people closer.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenInviteModal}
          className="px-4 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 shadow-subtle transition-colors cursor-pointer w-full sm:w-auto shrink-0"
        >
          <UserPlus className="w-4 h-4 stroke-[2]" />
          <span>+ Invite member</span>
        </button>
      </div>

      {/* Household Members Cards */}
      <div className="space-y-6 mb-10">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-medium text-ink-900">
            Family Members ({members.length})
          </h2>
          <span className="text-xs text-botanical-700 font-medium bg-botanical-50 px-2.5 py-1 rounded-full border border-botanical-200">
            All devices in sync
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-borderWarm shadow-card divide-y divide-borderWarm-subtle overflow-hidden">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 sm:p-5 hover:bg-cream-50/70 transition-colors gap-3"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="relative shrink-0">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-borderWarm"
                    />
                  ) : (
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center font-serif text-sm font-semibold text-ink-800">
                      {member.initials}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-botanical-500 border-2 border-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <span className="font-medium text-sm sm:text-base text-ink-900 truncate">
                      {member.name}
                    </span>
                    {member.role === 'Owner' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-botanical-50 text-botanical-800 border border-botanical-200 shrink-0">
                        <ShieldCheck className="w-3 h-3" />
                        Owner
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-500 mt-0.5 block truncate">
                    {member.role === 'Owner'
                      ? 'Household creator & primary manager'
                      : 'Collaborating family member'}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs font-mono text-ink-600 bg-cream-100 px-2.5 py-1 rounded-md border border-borderWarm">
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite with link Section */}
      <div className="bg-white rounded-2xl border border-borderWarm p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2.5">
          <LinkIcon className="w-5 h-5 text-terracotta-500" />
          <h3 className="font-serif text-xl font-medium text-ink-900">
            Invite with link
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-ink-600 max-w-2xl font-normal leading-relaxed">
          Share this private invitation link with your family members. Once accepted on their phone or tablet, their grocery edits, check-offs, and meal requests will sync instantly.
        </p>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2">
          <input
            type="text"
            readOnly
            value={inviteLink}
            className="w-full md:flex-1 px-3.5 py-2.5 bg-cream-50 border border-borderWarm rounded-xl text-xs sm:text-sm font-mono text-ink-800 focus:outline-none select-all"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full md:w-auto shrink-0 whitespace-nowrap px-5 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-subtle"
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
    </div>
  );
};
