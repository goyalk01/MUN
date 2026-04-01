/**
 * MUN Command Center - useSession Hook
 * Orchestrates the entire session: queue, timer, yields, and logging
 * 
 * Features:
 * - Session mode management (speech/qa/idle)
 * - Yield protocol handling with race condition prevention
 * - Activity logging with API persistence
 * - Coordination between queue and timer
 * - Session statistics tracking (total speakers, average time, yields)
 * - Auto-next speaker feature
 * 
 * CRITICAL: All async operations use AbortSignal for proper cleanup.
 * State transitions are atomic to prevent inconsistent states.
 */

'use client';

import { useState, useCallback, useMemo, useEffect, useRef, useId } from 'react';
import {
  SessionMode,
  YieldAction,
  ActivityLog,
  LogType,
  Delegate,
  UseSessionReturn,
  TIMER_PRESETS,
  YieldResponse,
  QueueResponse,
  LogsResponse,
  SessionStats,
} from '@/lib/types';
import { createLogEntry, getFromStorage, setToStorage, fetchWithTimeout } from '@/lib/utils';
import { useQueue } from './useQueue';
import { useTimer } from './useTimer';

interface UseSessionOptions {
  defaultTime?: number;
  persistLogs?: boolean;
  maxLogs?: number;
}

const STORAGE_KEY = 'mun-session-logs';
const AUTO_NEXT_KEY = 'mun-auto-next';

// Initial stats
const initialStats: SessionStats = {
  totalSpeakers: 0,
  currentSpeakerIndex: 0,
  averageSpeakingTime: 0,
  totalSpeakingTime: 0,
  speechCount: 0,
  yieldCount: {
    chair: 0,
    delegate: 0,
    questions: 0,
  },
};

export function useSession(options: UseSessionOptions = {}): UseSessionReturn {
  const {
    defaultTime = TIMER_PRESETS.STANDARD,
    persistLogs = false,
    maxLogs = 500,
  } = options;

  const stableId = useId();
  const sessionId = useMemo(() => `session_${stableId.replace(/:/g, '')}`, [stableId]);
  const [mode, setModeState] = useState<SessionMode>('idle');
  const [currentYield, setCurrentYield] = useState<YieldAction | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState<SessionStats>(initialStats);
  const [autoNext, setAutoNextState] = useState(false);
  
  // Refs for tracking state and preventing stale closures
  const prevSpeakerIdRef = useRef<string | null>(null);
  const speakerStartTimeRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const autoNextRef = useRef(autoNext);

  // Keep autoNext ref in sync
  useEffect(() => {
    autoNextRef.current = autoNext;
    setToStorage(AUTO_NEXT_KEY, autoNext);
  }, [autoNext]);

  // Hydrate client-only persisted state after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    if (persistLogs) {
      setLogs(getFromStorage<ActivityLog[]>(STORAGE_KEY, []));
    }
    setAutoNextState(getFromStorage<boolean>(AUTO_NEXT_KEY, false));
  }, [persistLogs]);

  const setAutoNext = useCallback((enabled: boolean) => {
    setAutoNextState(enabled);
  }, []);

  const pushLogToApi = useCallback(async (log: ActivityLog) => {
    try {
      await fetchWithTimeout('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: log.type,
          message: log.message,
          metadata: log.metadata,
        }),
        timeout: 5000,
      });
    } catch {
      // Keep local logs even if API persistence temporarily fails.
    }
  }, []);

  const addLog = useCallback((
    type: LogType,
    message: string,
    metadata?: Record<string, unknown>
  ) => {
    setLogs((prevLogs: ActivityLog[]) => {
      const entry = createLogEntry(type, message, metadata);
      void pushLogToApi(entry);

      const newLogs = [...prevLogs, entry];
      if (newLogs.length > maxLogs) {
        return newLogs.slice(-maxLogs);
      }
      return newLogs;
    });
  }, [maxLogs, pushLogToApi]);

  const queue = useQueue({
    defaultAllocatedTime: defaultTime,
  });

  // Update stats when a speech ends
  const recordSpeechEnd = useCallback((speakingTime: number) => {
    setStats(prev => {
      const newSpeechCount = prev.speechCount + 1;
      const newTotalTime = prev.totalSpeakingTime + speakingTime;
      return {
        ...prev,
        speechCount: newSpeechCount,
        totalSpeakingTime: newTotalTime,
        averageSpeakingTime: Math.round(newTotalTime / newSpeechCount),
      };
    });
  }, []);

  // Record yield statistics
  const recordYield = useCallback((yieldType: 'chair' | 'delegate' | 'questions') => {
    setStats(prev => ({
      ...prev,
      yieldCount: {
        ...prev.yieldCount,
        [yieldType]: prev.yieldCount[yieldType] + 1,
      },
    }));
  }, []);

  // Handle timer expiration with auto-next support
  const handleTimerExpire = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    try {
      const speaker = queue.currentSpeaker;
      const speakingTime = speakerStartTimeRef.current 
        ? Math.floor((Date.now() - speakerStartTimeRef.current) / 1000)
        : 0;
      
      addLog('timer_expired', `⏰ ${speaker?.country || 'Speaker'} time expired`, {
        speakerId: speaker?.id,
        speakingTime,
      });
      
      // Record stats
      if (speakingTime > 0) {
        recordSpeechEnd(speakingTime);
      }
      
      setCurrentYield(null);
      speakerStartTimeRef.current = null;
      
      // End current speaker
      await queue.endCurrentSpeaker();
      
      // Auto-next if enabled and queue has speakers
      if (autoNextRef.current && queue.queue.length > 0) {
        addLog('speaker_end', '⏭ Auto-advancing to next speaker');
        const advanced = await queue.nextSpeaker(defaultTime);
        if (!advanced) {
          setModeState('idle');
        }
      } else {
        setModeState('idle');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [queue, addLog, recordSpeechEnd, defaultTime]);

  const timer = useTimer({
    initialTime: defaultTime,
    onExpire: () => {
      void handleTimerExpire();
    },
  });

  useEffect(() => {
    if (persistLogs) {
      setToStorage(STORAGE_KEY, logs);
    }
  }, [logs, persistLogs]);

  useEffect(() => {
    let cancelled = false;

    const hydrateLogs = async () => {
      try {
        const response = await fetch(`/api/logs?limit=${maxLogs}`);
        const payload = (await response.json()) as LogsResponse;

        if (!cancelled && response.ok && payload.success && payload.data) {
          setLogs(payload.data);
        }
      } catch {
        // Fall back to local logs only.
      }
    };

    void hydrateLogs();
    return () => {
      cancelled = true;
    };
  }, [maxLogs]);

  // Track speaker changes and update stats
  useEffect(() => {
    const speaker = queue.currentSpeaker;

    if (speaker && speaker.id !== prevSpeakerIdRef.current) {
      prevSpeakerIdRef.current = speaker.id;
      speakerStartTimeRef.current = Date.now();
      setModeState('speech');
      setCurrentYield(null);

      // Update stats
      setStats(prev => ({
        ...prev,
        totalSpeakers: prev.totalSpeakers + 1,
        currentSpeakerIndex: prev.currentSpeakerIndex + 1,
      }));

      addLog('speaker_start', `🎤 ${speaker.country} started speaking`, {
        speakerId: speaker.id,
        country: speaker.country,
        allocatedTime: speaker.allocatedTime,
      });
    }

    if (!speaker && prevSpeakerIdRef.current) {
      prevSpeakerIdRef.current = null;
      speakerStartTimeRef.current = null;
      setModeState('idle');
    }
  }, [queue.currentSpeaker, addLog]);

  const clearLogs = useCallback(async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
    } catch {
      // Keep local clear behavior even if API clear fails.
    }

    setLogs([]);
    if (persistLogs) {
      setToStorage(STORAGE_KEY, []);
    }
  }, [persistLogs]);

  const setMode = useCallback((newMode: SessionMode) => {
    setModeState((prevMode: SessionMode) => {
      if (prevMode !== newMode) {
        addLog('mode_change', `Mode changed from ${prevMode} to ${newMode}`, {
          previousMode: prevMode,
          newMode,
        });
        return newMode;
      }
      return prevMode;
    });
  }, [addLog]);

  const createYield = useCallback(async (
    type: 'chair' | 'delegate' | 'questions',
    toDelegateId?: string
  ): Promise<YieldAction | null> => {
    if (!queue.currentSpeaker) {
      return null;
    }

    if (isProcessingRef.current) {
      return null;
    }

    try {
      const response = await fetchWithTimeout('/api/yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          fromSpeakerId: queue.currentSpeaker.id,
          toDelegateId,
          remainingTime: timer.time,
        }),
        timeout: 5000,
      });

      const payload = (await response.json()) as YieldResponse;
      if (!response.ok || !payload.success || !payload.data) {
        console.warn('Yield API failed:', payload.error);
        return null;
      }

      setCurrentYield(payload.data);
      return payload.data;
    } catch (error) {
      console.warn('Yield request failed:', error);
      return null;
    }
  }, [queue.currentSpeaker, timer.time]);

  const canYield = useMemo(() => {
    return (
      queue.currentSpeaker !== null &&
      timer.time > 0 &&
      mode === 'speech' &&
      !isProcessingRef.current
    );
  }, [queue.currentSpeaker, timer.time, mode]);

  const yieldToChair = useCallback(async (): Promise<boolean> => {
    if (!queue.currentSpeaker || !canYield || !timer.isRunning || isProcessingRef.current) {
      return false;
    }
    
    isProcessingRef.current = true;
    const speaker = queue.currentSpeaker;
    const speakingTime = speakerStartTimeRef.current 
      ? Math.floor((Date.now() - speakerStartTimeRef.current) / 1000)
      : 0;
    
    try {
      timer.pause();
      timer.reset();
      
      const action = await createYield('chair');
      if (!action) {
        return false;
      }

      const ended = await queue.endCurrentSpeaker();
      if (!ended) {
        return false;
      }

      // Record stats
      recordYield('chair');
      if (speakingTime > 0) {
        recordSpeechEnd(speakingTime);
      }
      speakerStartTimeRef.current = null;

      const hasNext = queue.queue.length > 0;
      if (hasNext) {
        const advanced = await queue.nextSpeaker(defaultTime);
        if (advanced) {
          timer.setTime(defaultTime);
          timer.start();
          setModeState('speech');
        } else {
          setModeState('idle');
        }
      } else {
        setModeState('idle');
      }

      addLog('yield_chair', `↩ ${speaker.country} yielded to Chair`, {
        speakerId: speaker.id,
        remainingTime: action.remainingTime,
        speakingTime,
      });
      return true;
    } catch (error) {
      console.error('Yield to chair failed:', error);
      return false;
    } finally {
      isProcessingRef.current = false;
    }
  }, [queue, canYield, createYield, timer, addLog, defaultTime, recordYield, recordSpeechEnd]);

  const yieldToDelegate = useCallback(async (delegateId: string): Promise<boolean> => {
    if (!queue.currentSpeaker || !canYield || !timer.isRunning || isProcessingRef.current) {
      return false;
    }

    const targetDelegate = queue.queue.find((speaker) => speaker.id === delegateId);
    if (!targetDelegate) {
      console.warn('Target delegate not found in queue');
      return false;
    }

    isProcessingRef.current = true;
    const fromSpeaker = queue.currentSpeaker;
    const remainingTime = timer.time;
    const speakingTime = speakerStartTimeRef.current 
      ? Math.floor((Date.now() - speakerStartTimeRef.current) / 1000)
      : 0;
    
    try {
      const action = await createYield('delegate', delegateId);
      if (!action) {
        return false;
      }

      const response = await fetchWithTimeout('/api/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'yield_delegate',
          delegateId,
          allocatedTime: remainingTime,
        }),
        timeout: 5000,
      });

      const payload = (await response.json()) as QueueResponse;
      if (!response.ok || !payload.success) {
        console.warn('Queue yield_delegate failed:', payload.error);
        return false;
      }

      // Record stats
      recordYield('delegate');
      if (speakingTime > 0) {
        recordSpeechEnd(speakingTime);
      }

      await queue.refresh();
      
      timer.setTime(remainingTime);
      timer.start();
      
      setModeState('speech');

      addLog('yield_delegate', `🔁 Yielded to ${targetDelegate.country}`, {
        fromSpeakerId: fromSpeaker.id,
        toSpeakerId: targetDelegate.id,
        remainingTime: remainingTime,
        speakingTime,
      });

      return true;
    } catch (error) {
      console.error('Yield to delegate failed:', error);
      return false;
    } finally {
      isProcessingRef.current = false;
    }
  }, [queue, canYield, createYield, timer, addLog, recordYield, recordSpeechEnd]);

  const yieldToQuestions = useCallback(async (): Promise<boolean> => {
    if (!queue.currentSpeaker || !canYield || isProcessingRef.current) {
      return false;
    }

    isProcessingRef.current = true;
    const speaker = queue.currentSpeaker;
    
    try {
      const action = await createYield('questions');
      if (!action) {
        return false;
      }

      timer.pause();
      setModeState('qa');
      
      // Record yield stat
      recordYield('questions');
      
      addLog('yield_questions', `❓ Entered Q&A mode (${speaker.country})`, {
        speakerId: speaker.id,
        remainingTime: action.remainingTime,
      });

      return true;
    } catch (error) {
      console.error('Yield to questions failed:', error);
      return false;
    } finally {
      isProcessingRef.current = false;
    }
  }, [queue.currentSpeaker, canYield, createYield, addLog, timer, recordYield]);

  const clearYield = useCallback(() => {
    setCurrentYield(null);
    void fetch('/api/yield', { method: 'DELETE' }).catch(() => {
      // Local state is already cleared; network clear is best-effort.
    });
  }, []);

  const startSession = useCallback(() => {
    setIsActive(true);
    setModeState('idle');
    // Reset stats on new session
    setStats(initialStats);
    addLog('session_start', 'Session started', {
      sessionId,
      timestamp: Date.now(),
    });
  }, [sessionId, addLog]);

  const endSession = useCallback(async () => {
    timer.pause();
    timer.reset();
    setCurrentYield(null);
    setModeState('idle');
    setIsActive(false);

    await queue.endCurrentSpeaker();
    
    addLog('session_end', '🏁 Session ended', {
      sessionId,
      timestamp: Date.now(),
      finalStats: stats,
    });
  }, [timer, queue, sessionId, addLog, stats]);

  const enhancedQueue = useMemo(() => ({
    ...queue,
    addSpeaker: async (delegate: Omit<Delegate, 'id' | 'createdAt'>) => {
      const created = await queue.addSpeaker(delegate);
      if (!created) {
        return false;
      }

      addLog('queue_add', `➕ ${delegate.country} added to GSL`, {
        country: delegate.country,
        name: delegate.name,
      });
      return true;
    },
    removeSpeaker: async (id: string) => {
      const speaker = queue.queue.find((entry) => entry.id === id);
      const removed = await queue.removeSpeaker(id);
      if (!removed) {
        return false;
      }

      if (speaker) {
        addLog('queue_remove', `➖ ${speaker.country} removed from GSL`, {
          speakerId: id,
          country: speaker.country,
        });
      }
      return true;
    },
    reorderQueue: async (fromIndex: number, toIndex: number) => {
      const moved = await queue.reorderQueue(fromIndex, toIndex);
      if (!moved) {
        return false;
      }

      addLog('queue_reorder', '↕ Reordered speakers list', {
        fromIndex,
        toIndex,
      });
      return true;
    },
    nextSpeaker: async (allocatedTime: number) => {
      if (queue.currentSpeaker) {
        return false;
      }

      const moved = await queue.nextSpeaker(allocatedTime);
      if (!moved) {
        return false;
      }

      timer.setTime(allocatedTime);
      timer.start();
      return true;
    },
    clearQueue: async () => {
      const cleared = await queue.clearQueue();
      if (!cleared) {
        return false;
      }

      timer.reset();
      setCurrentYield(null);
      addLog('queue_remove', '🧹 Queue cleared');
      return true;
    },
  }), [queue, timer, addLog]);

  const enhancedTimer = useMemo(() => ({
    ...timer,
    start: () => {
      if (timer.isRunning && !timer.isPaused) {
        return;
      }
      timer.start();
      addLog('timer_start', `▶ Timer started (${timer.time}s)`, { time: timer.time });
    },
    pause: () => {
      if (!timer.isRunning || timer.isPaused) {
        return;
      }
      timer.pause();
      addLog('timer_pause', `⏳ Timer paused at ${timer.time}s`, { timeRemaining: timer.time });
    },
    reset: () => {
      if (timer.time === timer.initialTime && !timer.isRunning && !timer.isPaused) {
        return;
      }
      timer.reset();
      addLog('timer_reset', `🔄 Timer reset to ${timer.initialTime}s`, { resetTo: timer.initialTime });
    },
  }), [timer, addLog]);

  return {
    // State
    mode,
    sessionId,
    isActive,
    
    // Queue (enhanced with logging)
    queue: enhancedQueue,
    
    // Timer (enhanced with logging)
    timer: enhancedTimer,
    
    // Yield management
    currentYield,
    yieldToChair,
    yieldToDelegate,
    yieldToQuestions,
    clearYield,
    canYield,
    
    // Activity logs
    logs,
    addLog,
    clearLogs,
    
    // Session control
    startSession,
    endSession,
    setMode,
    
    // Session statistics
    stats,
    
    // Auto-next feature
    autoNext,
    setAutoNext,
  };
}

export default useSession;
