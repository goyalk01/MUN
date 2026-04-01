/**
 * QueueList Component
 * Clean, minimal speakers list with add/remove/reorder
 * 
 * Premium Design: Structured list, subtle interactions
 */

'use client';

import React, { memo, useState, useCallback } from 'react';
import { QueueListProps, Delegate, Speaker } from '@/lib/types';
import { isValidCountry, isValidDelegateName } from '@/lib/utils';

interface AddSpeakerFormProps {
  onAdd: (delegate: Omit<Delegate, 'id' | 'createdAt'>) => Promise<boolean>;
  isInQueue: (country: string) => boolean;
  isBusy: boolean;
}

const AddSpeakerForm = memo(function AddSpeakerForm({ onAdd, isInQueue, isBusy }: AddSpeakerFormProps) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidDelegateName(name)) {
      setError('Name must be 2-100 characters');
      return;
    }

    if (!isValidCountry(country)) {
      setError('Country must be 2-100 characters');
      return;
    }

    if (isInQueue(country)) {
      setError(`${country} is already in queue`);
      return;
    }

    const success = await onAdd({ name: name.trim(), country: country.trim() });
    if (success) {
      setName('');
      setCountry('');
    } else {
      setError('Failed to add delegate');
    }
  }, [name, country, onAdd, isInQueue]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={isBusy}
          placeholder="Country"
          className="input flex-1"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isBusy}
          placeholder="Delegate"
          className="input flex-1"
        />
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <button 
        type="submit" 
        disabled={isBusy}
        className="w-full btn btn-primary py-2.5 disabled:opacity-50"
      >
        {isBusy ? 'Adding...' : 'Add to Queue'}
      </button>
    </form>
  );
});

interface SpeakerItemProps {
  speaker: Speaker;
  isFirst: boolean;
  isLast: boolean;
  onRemove: (id: string) => Promise<void>;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SpeakerItem = memo(function SpeakerItem({
  speaker,
  isFirst,
  isLast,
  onRemove,
  onMoveUp,
  onMoveDown,
}: SpeakerItemProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-primary)] transition-colors animate-slide-in group">
      {/* Position */}
      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--bg-primary)] text-xs font-medium text-[var(--text-secondary)]">
        {speaker.position}
      </span>

      {/* Info */}
      <div className="flex-grow min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
          {speaker.country}
        </p>
        <p className="text-xs text-[var(--text-tertiary)] truncate">
          {speaker.name}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className={`p-1.5 rounded transition-colors ${
            !isFirst ? 'hover:bg-[var(--border-color)] text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)] cursor-not-allowed'
          }`}
          title="Move up"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className={`p-1.5 rounded transition-colors ${
            !isLast ? 'hover:bg-[var(--border-color)] text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)] cursor-not-allowed'
          }`}
          title="Move down"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          onClick={() => void onRemove(speaker.id)}
          className="p-1.5 rounded transition-colors hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500"
          title="Remove"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
});

export const QueueList = memo(function QueueList({
  speakers,
  currentSpeaker,
  onAddSpeaker,
  onRemoveSpeaker,
  onReorderQueue,
  onSelectNext,
  isInQueue,
  defaultTime,
  isLoading = false,
  error = null,
}: QueueListProps) {
  const [selectedTime, setSelectedTime] = useState(defaultTime);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const withActionGuard = useCallback(async (action: () => Promise<boolean>, fallbackError: string) => {
    if (isSubmitting) return false;
    setIsSubmitting(true);
    setActionError(null);

    try {
      const ok = await action();
      if (!ok) setActionError(fallbackError);
      return ok;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting]);

  const handleSelectNext = useCallback(() => {
    if (speakers.length > 0) {
      void withActionGuard(() => onSelectNext(selectedTime), 'Unable to start speaker');
    }
  }, [speakers.length, onSelectNext, selectedTime, withActionGuard]);

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
        <h2 className="text-title text-[var(--text-primary)]">Queue</h2>
        <span className="text-caption text-[var(--text-tertiary)]">
          {speakers.length} {speakers.length === 1 ? 'speaker' : 'speakers'}
        </span>
      </div>

      {/* Add Form */}
      <div className="px-5 py-4 border-b border-[var(--border-color)]">
        <AddSpeakerForm 
          onAdd={(d) => withActionGuard(() => onAddSpeaker(d), 'Unable to add')}
          isInQueue={isInQueue} 
          isBusy={isSubmitting}
        />
        {isLoading && (
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">Syncing...</p>
        )}
        {(error || actionError) && (
          <p className="mt-2 text-xs text-red-500">{error || actionError}</p>
        )}
      </div>

      {/* List */}
      <div className="flex-grow overflow-y-auto px-2 py-2">
        {speakers.length > 0 ? (
          <div className="space-y-0.5">
            {speakers.map((speaker, index) => (
              <SpeakerItem
                key={speaker.id}
                speaker={speaker}
                isFirst={index === 0}
                isLast={index === speakers.length - 1}
                onRemove={async (id) => {
                  await withActionGuard(() => onRemoveSpeaker(id), 'Unable to remove');
                }}
                onMoveUp={() => void withActionGuard(() => onReorderQueue(index, index - 1), 'Unable to reorder')}
                onMoveDown={() => void withActionGuard(() => onReorderQueue(index, index + 1), 'Unable to reorder')}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state py-12">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="empty-state-title">No speakers in queue</p>
            <p className="empty-state-description">Add delegates above</p>
          </div>
        )}
      </div>

      {/* Footer - Next Speaker */}
      <div className="px-5 py-4 border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
        <div className="flex items-center gap-2">
          <select
            aria-label="Speaking time"
            value={selectedTime}
            onChange={(e) => setSelectedTime(Number(e.target.value))}
            className="select w-24 py-2"
          >
            <option value={60}>1:00</option>
            <option value={90}>1:30</option>
            <option value={120}>2:00</option>
            <option value={180}>3:00</option>
          </select>
          
          <button
            onClick={handleSelectNext}
            disabled={isSubmitting || speakers.length === 0 || currentSpeaker !== null}
            className={`flex-grow btn py-2.5 ${
              !isSubmitting && speakers.length > 0 && currentSpeaker === null
                ? 'btn-success'
                : 'opacity-40 cursor-not-allowed bg-[var(--border-color)] text-[var(--text-tertiary)]'
            }`}
          >
            {currentSpeaker 
              ? 'Speaker Active' 
              : speakers.length > 0 
                ? `Call ${speakers[0].country}` 
                : 'No Speakers'
            }
          </button>
        </div>
      </div>
    </div>
  );
});

export default QueueList;
