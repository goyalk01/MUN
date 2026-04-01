/**
 * MUN Command Center - useKeyboardShortcuts Hook
 * Handles global keyboard shortcuts for rapid control
 * 
 * Shortcuts:
 * - Space: Start/Pause timer
 * - N: Next speaker (when no active speaker)
 * - R: Reset timer
 * - Escape: Clear focus / close modals
 * 
 * CRITICAL: Shortcuts are disabled when typing in input fields
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';

interface KeyboardShortcutHandlers {
  onToggleTimer: () => void;
  onNextSpeaker: () => void;
  onResetTimer: () => void;
  onEscape?: () => void;
  isTimerRunning: boolean;
  hasCurrentSpeaker: boolean;
  hasQueuedSpeakers: boolean;
  isEnabled?: boolean;
}

export function useKeyboardShortcuts({
  onToggleTimer,
  onNextSpeaker,
  onResetTimer,
  onEscape,
  isTimerRunning,
  hasCurrentSpeaker,
  hasQueuedSpeakers,
  isEnabled = true,
}: KeyboardShortcutHandlers): void {
  // Use refs to avoid stale closures
  const handlersRef = useRef({
    onToggleTimer,
    onNextSpeaker,
    onResetTimer,
    onEscape,
    isTimerRunning,
    hasCurrentSpeaker,
    hasQueuedSpeakers,
  });

  // Update refs when handlers change
  useEffect(() => {
    handlersRef.current = {
      onToggleTimer,
      onNextSpeaker,
      onResetTimer,
      onEscape,
      isTimerRunning,
      hasCurrentSpeaker,
      hasQueuedSpeakers,
    };
  }, [onToggleTimer, onNextSpeaker, onResetTimer, onEscape, isTimerRunning, hasCurrentSpeaker, hasQueuedSpeakers]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if typing in an input field
    const target = event.target as HTMLElement;
    const isInputField = 
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    if (isInputField) return;

    // Get current handler values
    const handlers = handlersRef.current;

    switch (event.code) {
      case 'Space':
        // Space: Toggle timer (start/pause)
        event.preventDefault();
        if (handlers.hasCurrentSpeaker) {
          handlers.onToggleTimer();
        }
        break;

      case 'KeyN':
        // N: Next speaker (only when no active speaker and queue has speakers)
        event.preventDefault();
        if (!handlers.hasCurrentSpeaker && handlers.hasQueuedSpeakers) {
          handlers.onNextSpeaker();
        }
        break;

      case 'KeyR':
        // R: Reset timer
        event.preventDefault();
        if (handlers.hasCurrentSpeaker && !handlers.isTimerRunning) {
          handlers.onResetTimer();
        }
        break;

      case 'Escape':
        // Escape: Clear focus / close modals
        event.preventDefault();
        handlers.onEscape?.();
        // Also blur any focused element
        (document.activeElement as HTMLElement)?.blur?.();
        break;

      default:
        break;
    }
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, isEnabled]);
}

export default useKeyboardShortcuts;
