/**
 * Timer Component
 * Center-focused timer controls with minimal design
 * 
 * Premium Design: Clean, functional, instant feedback
 */

'use client';

import React, { memo, useMemo, useCallback } from 'react';
import { TimerProps, TIMER_PRESETS, TimerPreset } from '@/lib/types';

const presetConfig: { value: number; label: string }[] = [
  { value: TIMER_PRESETS.SHORT, label: '1:00' },
  { value: TIMER_PRESETS.STANDARD, label: '1:30' },
  { value: TIMER_PRESETS.LONG, label: '2:00' },
  { value: TIMER_PRESETS.EXTENDED, label: '3:00' },
];

export const Timer = memo(function Timer({
  time,
  initialTime,
  isRunning,
  isPaused,
  progress,
  formattedTime,
  onStart,
  onPause,
  onReset,
  onSetPreset,
  disabled = false,
}: TimerProps) {
  const isExpired = time <= 0;
  const canStart = !isRunning || isPaused;
  const canPause = isRunning && !isPaused && !isExpired;
  const canReset = time !== initialTime || isRunning;

  const statusConfig = useMemo(() => {
    if (isExpired) return { label: 'TIME UP', dotClass: 'status-dot-critical' };
    if (isRunning && !isPaused) return { label: 'RUNNING', dotClass: 'status-dot-active' };
    if (isPaused) return { label: 'PAUSED', dotClass: 'status-dot-warning' };
    return { label: 'READY', dotClass: 'status-dot-idle' };
  }, [isRunning, isPaused, isExpired]);

  const handlePresetClick = useCallback((value: number) => {
    if (!disabled && !isRunning) {
      onSetPreset(value as TimerPreset);
    }
  }, [disabled, isRunning, onSetPreset]);

  return (
    <div className="card p-6 space-y-6">
      {/* Presets - Compact row */}
      <div>
        <p className="text-label text-[var(--text-tertiary)] mb-3">TIME PRESETS</p>
        <div className="flex gap-2">
          {presetConfig.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handlePresetClick(value)}
              disabled={disabled || isRunning}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all
                ${initialTime === value
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'btn-secondary'
                }
                ${(disabled || isRunning) ? 'opacity-40 cursor-not-allowed' : ''}
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center justify-center gap-2">
        <span className={`status-dot ${statusConfig.dotClass} ${isRunning && !isPaused ? 'animate-pulse' : ''}`} />
        <span className="text-label text-[var(--text-tertiary)]">{statusConfig.label}</span>
      </div>

      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] py-6 text-center">
        <p className="text-label text-[var(--text-tertiary)]">TIME REMAINING</p>
        <p className={`mt-2 font-mono text-5xl leading-none ${
          isExpired ? 'timer-critical' : time < 10 ? 'timer-critical' : time < 20 ? 'timer-warning' : 'timer-normal'
        }`}>
          {formattedTime}
        </p>
      </div>

      {/* Progress Bar - Horizontal, thin */}
      <div className="progress-bar">
        <div
          className={`progress-fill ${
            progress >= 0.9 ? 'progress-critical' : 
            progress >= 0.75 ? 'progress-warning' : 
            'progress-normal'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Control Buttons - Clean, minimal */}
      <div className="flex gap-3">
        {/* Start/Resume */}
        <button
          onClick={onStart}
          disabled={disabled || (isRunning && !isPaused)}
          className={`flex-1 btn ${canStart && !disabled ? 'btn-success' : ''} py-3
            ${(disabled || (isRunning && !isPaused)) ? 'opacity-40 cursor-not-allowed bg-[var(--border-color)] text-[var(--text-tertiary)]' : ''}
          `}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          {isPaused ? 'Resume' : 'Start'}
        </button>

        {/* Pause */}
        <button
          onClick={onPause}
          disabled={disabled || !canPause}
          className={`flex-1 btn ${canPause && !disabled ? 'btn-warning' : ''} py-3
            ${(disabled || !canPause) ? 'opacity-40 cursor-not-allowed bg-[var(--border-color)] text-[var(--text-tertiary)]' : ''}
          `}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
          Pause
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          disabled={disabled || !canReset}
          className={`flex-1 btn btn-secondary py-3
            ${(disabled || !canReset) ? 'opacity-40 cursor-not-allowed' : ''}
          `}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset
        </button>
      </div>
    </div>
  );
});

export default Timer;
