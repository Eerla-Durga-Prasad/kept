import React, { useState } from 'react';
import { X, Copy, Check, Users, Mail, Link as LinkIcon, ShieldCheck } from 'lucide-react';
import { HouseholdMember } from '../sync/types';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: HouseholdMember[];
  onAddMember: (name: string, role: 'Owner' | 'Member') => void;
}

export const HouseholdModal: React.FC<HouseholdModalProps> = ({
  isOpen,
  onClose,
  members,
  onAddMember,
}) => {
  const [copied, setCopied] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'Owner' | 'Member'>('Member');
  const inviteLink = 'https://kept.app/join/prasad-family-78f9';

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    onAddMember(newMemberName.trim(), newMemberRole);
    setNewMemberName('');
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
            className="p-2 text-ink-400 hover:text-ink-700 hover:bg-cream-200 rounded-full transition-colors"
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
                        {member.name === 'Durga Prasad' ? 'Logged in device' : 'Household Member'}
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

          {/* Copyable Invite link */}
          <div className="bg-white rounded-xl border border-borderWarm p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-terracotta-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-800">
                Invite with link
              </span>
            </div>
            <p className="text-xs text-ink-500">
              Anyone with this link can join your household list and sync meals in real-time.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-3 py-2 text-xs bg-cream-50 border border-borderWarm rounded-lg text-ink-700 font-mono select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
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

          {/* Add member form */}
          <form onSubmit={handleAddMemberSubmit} className="bg-white rounded-xl border border-borderWarm p-4 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-800 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-terracotta-500" />
              + Invite member by name
            </span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Member name..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="col-span-2 px-3 py-2 text-xs bg-cream-50 border border-borderWarm rounded-lg text-ink-900 focus:outline-none focus:border-terracotta-500"
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as 'Owner' | 'Member')}
                className="px-2 py-2 text-xs bg-cream-50 border border-borderWarm rounded-lg text-ink-900 focus:outline-none focus:border-terracotta-500"
              >
                <option value="Member">Member</option>
                <option value="Owner">Owner</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!newMemberName.trim()}
              className="w-full py-2 bg-cream-200 hover:bg-cream-300 disabled:opacity-50 text-ink-900 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Add Household Member
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
