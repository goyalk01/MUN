/**
 * MUN Command Center - useTimer Hook
 * Handles countdown timer logic for speaker time management
 * 
 * Features:
 * - Start/pause/reset functionality
 * - Preset time options (60/90/120/180 seconds)
 * - Auto-expiration handling with race condition prevention
 * - Progress calculation
 * - Formatted time display
 * - Auto-next speaker support
 * 
 * CRITICAL: Timer state transitions are atomic to prevent race conditions
 * when user actions (pause/reset) occur simultaneously with expiration.
 */

'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { 
  TimerPreset, 
  TIMER_PRESETS,
  UseTimerReturn 
} from '@/lib/types';
import { formatTime, calculateProgress, clamp } from '@/lib/utils';

interface UseTimerOptions {
  initialTime?: number;
  onExpire?: () => void;
  onTick?: (time: number) => void;
  autoStart?: boolean;
}

// Timer state machine to prevent race conditions
type TimerStatus = 'idle' | 'running' | 'paused' | 'expired';

export function useTimer(options: UseTimerOptions = {}): UseTimerReturn {
  const { 
    initialTime = TIMER_PRESETS.STANDARD, 
    onExpire, 
    onTick,
    autoStart = false 
  } = options;

  // Unified timer state to prevent race conditions
  const [time, setTime] = useState<number>(initialTime);
  const [storedInitialTime, setStoredInitialTime] = useState<number>(initialTime);
  const [status, setStatus] = useState<TimerStatus>(autoStart ? 'running' : 'idle');

  // Refs for callbacks to avoid stale closures
  const onExpireRef = useRef(onExpire);
  const onTickRef = useRef(onTick);
  
  // Track if we've already fired the expire callback
  const hasExpiredRef = useRef(false);
  // Monotonic counter used to ignore stale deferred expiration callbacks
  const runIdRef = useRef(0);
  
  // Track active interval to ensure cleanup
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Update callback refs when callbacks change
  useEffect(() => {
    onExpireRef.current = onExpire;
    onTickRef.current = onTick;
  }, [onExpire, onTick]);

  // Single interval effect with proper cleanup
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (expireTimeoutRef.current) {
      clearTimeout(expireTimeoutRef.current);
      expireTimeoutRef.current = null;
    }

    if (status !== 'running') return;

    // Reset expired flag when starting
    hasExpiredRef.current = false;
    runIdRef.current += 1;
    const activeRunId = runIdRef.current;

    intervalRef.current = setInterval(() => {
      setTime(prevTime => {
        const newTime = Math.max(0, prevTime - 1);
        
        // Call tick callback (safe, doesn't modify state)
        onTickRef.current?.(newTime);

        // Handle expiration atomically
        if (newTime <= 0 && !hasExpiredRef.current) {
          hasExpiredRef.current = true;
          
          // Use setTimeout to defer state changes and callback
          // This prevents the interval from interfering
          expireTimeoutRef.current = setTimeout(() => {
            if (runIdRef.current !== activeRunId) {
              return;
            }
            setStatus('expired');
            onExpireRef.current?.();
            expireTimeoutRef.current = null;
          }, 0);
          
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (expireTimeoutRef.current) {
        clearTimeout(expireTimeoutRef.current);
        expireTimeoutRef.current = null;
      }
    };
  }, [status]);

  /**
   * Start the timer - atomic state transition
   */
  const start = useCallback(() => {
    // Prevent starting if already running
    if (status === 'running') return;
    
    // Reset expired flag
    hasExpiredRef.current = false;
    runIdRef.current += 1;
    
    // If expired or time is zero, reset to initial time first
    if (status === 'expired' || time <= 0) {
      setTime(storedInitialTime);
    }
    
    setStatus('running');
  }, [status, time, storedInitialTime]);

  /**
   * Pause the timer - atomic state transition
   */
  const pause = useCallback(() => {
    if (status === 'running') {
      runIdRef.current += 1;
      setStatus('paused');
    }
  }, [status]);

  /**
   * Reset the timer to initial time - atomic state transition
   */
  const reset = useCallback(() => {
    hasExpiredRef.current = false;
    runIdRef.current += 1;
    setTime(storedInitialTime);
    setStatus('idle');
  }, [storedInitialTime]);

  /**
   * Set a specific time value - preserves current status
   */
  const setTimerTime = useCallback((seconds: number) => {
    const clampedTime = clamp(seconds, 0, 600);
    hasExpiredRef.current = false;
    runIdRef.current += 1;
    setTime(clampedTime);
    setStoredInitialTime(clampedTime);
  }, []);

  /**
   * Set time using a preset - stops timer and resets
   */
  const setPreset = useCallback((preset: TimerPreset) => {
    hasExpiredRef.current = false;
    runIdRef.current += 1;
    setTime(preset);
    setStoredInitialTime(preset);
    setStatus('idle');
  }, []);

  // Derived state from status
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isExpired = status === 'expired' || time <= 0;

  // Computed values
  const progress = useMemo(
    () => calculateProgress(time, storedInitialTime),
    [time, storedInitialTime]
  );

  const formattedTime = useMemo(
    () => formatTime(time),
    [time]
  );

  return {
    time,
    initialTime: storedInitialTime,
    isRunning,
    isPaused,
    progress,
    formattedTime,
    start,
    pause,
    reset,
    setTime: setTimerTime,
    setPreset,
    isExpired,
  };
}

export default useTimer;
