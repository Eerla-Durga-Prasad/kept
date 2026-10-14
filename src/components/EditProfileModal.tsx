import React, { useState, useRef, useEffect } from 'react';
import { X, Pencil, Camera, Trash2, Crop } from 'lucide-react';
import { HouseholdMember } from '../sync/types';
import { ImageCropModal } from './ImageCropModal';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: HouseholdMember | null;
  onSave: (updated: HouseholdMember) => Promise<void> | void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  member,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (member) {
      setName(member.name);
      setAvatarUrl(member.avatar_url);
      setCropImageSrc(null);
      setError(null);
    }
  }, [member, isOpen]);

  if (!isOpen || !member) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, WebP, etc.).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Please choose an image smaller than 10MB.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropImageSrc(reader.result);
        setIsCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);

    // Reset input so re-selecting same file triggers change
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleApplyCrop = (croppedDataUrl: string) => {
    setAvatarUrl(croppedDataUrl);
    setIsCropModalOpen(false);
  };

  const previewInitials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : member.initials;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Display name cannot be empty.');
      return;
    }

    const calculatedInitials =
      trimmedName
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .substring(0, 2) || member.initials;

    setIsSaving(true);
    try {
      await onSave({
        ...member,
        name: trimmedName,
        avatar_url: avatarUrl || undefined,
        initials: calculatedInitials,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Dialog */}
        <div className="relative w-full max-w-md bg-cream-50 rounded-2xl border border-borderWarm shadow-float overflow-hidden z-10 flex flex-col max-h-[90vh] animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-borderWarm bg-white/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center text-ink-700">
                <Pencil className="w-5 h-5 text-terracotta-500" />
              </div>
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-ink-900">
                  Edit Profile
                </h2>
                <p className="text-xs text-ink-500">
                  Update display name and photo
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-ink-400 hover:text-ink-700 hover:bg-cream-200 rounded-full transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto">
            {/* Photo Picker Section */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-white rounded-xl border border-borderWarm">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name || 'Profile photo'}
                    className="w-20 h-20 rounded-full object-cover border-2 border-borderWarm shadow-subtle"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-cream-200 border-2 border-borderWarm flex items-center justify-center font-serif text-2xl font-semibold text-ink-800 shadow-subtle">
                    {previewInitials}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center sm:items-start gap-2 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-700">
                  Profile Photo
                </span>

                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white hover:bg-cream-100 border border-borderWarm rounded-xl text-xs font-medium text-ink-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-subtle"
                  >
                    <Camera className="w-3.5 h-3.5 text-terracotta-500" />
                    <span>{avatarUrl ? 'Change Photo' : 'Choose Photo'}</span>
                  </button>

                  {cropImageSrc && (
                    <button
                      type="button"
                      onClick={() => setIsCropModalOpen(true)}
                      className="px-2.5 py-1.5 text-xs text-ink-600 hover:text-ink-900 hover:bg-cream-100 border border-borderWarm rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-subtle"
                      title="Adjust crop framing"
                    >
                      <Crop className="w-3.5 h-3.5 text-terracotta-500" />
                      <span>Adjust Crop</span>
                    </button>
                  )}

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl(undefined);
                        setCropImageSrc(null);
                      }}
                      className="px-2.5 py-1.5 text-xs text-ink-500 hover:text-terracotta-600 hover:bg-cream-100 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-ink-400">
                  Interactive crop & framing on selection
                </span>
              </div>
            </div>

            {/* Display Name Section */}
            <div className="space-y-1.5">
              <label
                htmlFor="member-display-name"
                className="text-xs font-semibold uppercase tracking-wider text-ink-700 block"
              >
                Display Name
              </label>
              <input
                id="member-display-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter your name..."
                maxLength={50}
                className="w-full px-3.5 py-2.5 bg-white border border-borderWarm focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 rounded-xl text-sm text-ink-900 focus:outline-none transition-colors"
              />
              {error && (
                <p className="text-xs text-terracotta-600 mt-1">{error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-borderWarm">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 bg-cream-200 hover:bg-cream-300 text-ink-800 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="px-5 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 shadow-subtle transition-colors cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={isCropModalOpen}
        imageSrc={cropImageSrc}
        onClose={() => setIsCropModalOpen(false)}
        onApply={handleApplyCrop}
      />
    </>
  );
};
