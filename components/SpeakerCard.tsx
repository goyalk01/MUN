/**
 * SpeakerCard Component
 * Hero section displaying the current speaker
 * 
 * Premium Design: Typography-driven, minimal, focused
 */

'use client';

import React, { memo, useMemo } from 'react';
import { SpeakerCardProps, SessionMode } from '@/lib/types';

function getModeConfig(mode: SessionMode) {
  switch (mode) {
    case 'speech':
      return { label: 'SPEAKING', dotClass: 'status-dot-active' };
    case 'qa':
      return { label: 'Q&A SESSION', dotClass: 'status-dot-warning' };
    case 'idle':
    default:
      return { label: 'IDLE', dotClass: 'status-dot-idle' };
  }
}

function getTimerClass(time: number): string {
  if (time <= 10) return 'timer-critical';
  if (time <= 20) return 'timer-warning';
  return 'timer-normal';
}

function getProgressClass(progress: number): string {
  if (progress >= 0.9) return 'progress-critical';
  if (progress >= 0.75) return 'progress-warning';
  return 'progress-normal';
}

export const SpeakerCard = memo(function SpeakerCard({
  speaker,
  time,
  formattedTime,
  progress,
  isRunning,
  mode,
}: SpeakerCardProps) {
  const hasActiveSpeaker = speaker !== null;
  const modeConfig = getModeConfig(mode);
  
  const timerClass = useMemo(() => getTimerClass(time), [time]);
  const progressClass = useMemo(() => getProgressClass(progress), [progress]);

  return (
    <div className={`card p-8 transition-all duration-200 ${hasActiveSpeaker && mode === 'speech' ? 'scale-[1.005] shadow-dark-card dark:shadow-dark-elevated' : ''}`}>
      {hasActiveSpeaker ? (
        <div className="space-y-8">
          {/* Status Badge */}
          <div className="flex items-center justify-center gap-2">
            <span className={`status-dot ${modeConfig.dotClass} ${isRunning ? 'animate-pulse' : ''}`} />
            <span className="text-label text-[var(--text-tertiary)]">
              {modeConfig.label}
            </span>
          </div>

          {/* Country Name - Hero Typography */}
          <div className="text-center">
            <h1 className="text-hero text-[var(--text-primary)]">
              {speaker.country}
            </h1>
            <p className="mt-2 text-body text-[var(--text-secondary)]">
              {speaker.name}
            </p>
          </div>

          {/* Timer Display - Centered, Large */}
          <div className="text-center py-6">
            <div className={`font-mono text-display tracking-tight ${timerClass}`}>
              {formattedTime}
            </div>
            <p className="mt-3 text-caption text-[var(--text-tertiary)]">
              {isRunning ? 'TIME REMAINING' : 'PAUSED'}
            </p>
          </div>

          {/* Progress Bar - Minimal */}
          <div className="progress-bar">
            <div
              className={`progress-fill ${progressClass}`}
              style={{ width: `${(1 - progress) * 100}%` }}
            />
          </div>

          {/* Meta Info - Subtle */}
          <div className="flex justify-center gap-8 pt-2">
            <div className="text-center">
              <p className="text-label text-[var(--text-tertiary)]">ALLOCATED</p>
              <p className="mt-1 text-body font-mono text-[var(--text-secondary)]">
                {Math.floor(speaker.allocatedTime / 60)}:{String(speaker.allocatedTime % 60).padStart(2, '0')}
              </p>
            </div>
            <div className="w-px bg-[var(--border-color)]" />
            <div className="text-center">
              <p className="text-label text-[var(--text-tertiary)]">POSITION</p>
              <p className="mt-1 text-body font-mono text-[var(--text-secondary)]">
                #{speaker.position}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State - Minimal */
        <div className="empty-state py-16">
          <svg 
            className="empty-state-icon" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
            />
          </svg>
          <p className="empty-state-title">No Active Speaker</p>
          <p className="empty-state-description">
            Select a speaker from the queue
          </p>
        </div>
      )}
    </div>
  );
});

export default SpeakerCard;
