'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityLog,
  CurrentSpeaker,
  Delegate,
  LogType,
  QueueResponse,
  SessionMode,
  SessionStats,
  Speaker,
  TIMER_PRESETS,
  UseQueueReturn,
  UseSessionReturn,
  YieldAction,
  YieldResponse,
} from '@/lib/types';
import { fetchWithTimeout, getFromStorage, setToStorage } from '@/lib/utils';
import { useTimer } from './useTimer';

interface UseSessionOptions {
  defaultTime?: number;
  persistLogs?: boolean;
  maxLogs?: number;
}

interface SessionPayload {
  success: boolean;
  data?: {
    queue: Speaker[];
    currentSpeaker: CurrentSpeaker | null;
    logs: ActivityLog[];
    mode: SessionMode;
    currentYield: YieldAction | null;
    sessionId: string;
    startedAt: number;
    stats: SessionStats;
    updatedAt: number;
  } | null;
  error?: string | null;
}

const AUTO_NEXT_KEY = 'mun-auto-next';
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
  const { defaultTime = TIMER_PRESETS.STANDARD } = options;

  const [queue, setQueue] = useState<Speaker[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<CurrentSpeaker | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [mode, setModeState] = useState<SessionMode>('idle');
  const [currentYield, setCurrentYield] = useState<YieldAction | null>(null);
  const [stats, setStats] = useState<SessionStats>(initialStats);
  const [sessionId, setSessionId] = useState('session_client');
  const [isActive, setIsActive] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const [queueError, setQueueError] = useState<string | null>(null);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [autoNext, setAutoNextState] = useState(false);

  const opLockRef = useRef(false);
  const mountedRef = useRef(true);
  const autoNextRef = useRef(autoNext);

  const timer = useTimer({
    initialTime: defaultTime,
    onExpire: () => {
      if (autoNextRef.current) {
        void yieldToChair();
      }
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    autoNextRef.current = autoNext;
    setToStorage(AUTO_NEXT_KEY, autoNext);
  }, [autoNext]);

  useEffect(() => {
    setAutoNextState(getFromStorage<boolean>(AUTO_NEXT_KEY, false));
  }, []);

  const withMutationLock = useCallback(async (operation: () => Promise<boolean>): Promise<boolean> => {
    if (opLockRef.current) return false;
    opLockRef.current = true;
    try {
      return await operation();
    } finally {
      opLockRef.current = false;
    }
  }, []);

  const fetchSession = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetchWithTimeout('/api/session', { timeout: 8000, cache: 'no-store' });
      const payload = (await response.json()) as SessionPayload;

      if (!mountedRef.current) {
        return;
      }

      if (!response.ok || !payload.success || !payload.data) {
        setSyncError(payload.error || 'Failed to sync session state');
        return;
      }

      setQueue(Array.isArray(payload.data.queue) ? payload.data.queue : []);
      setCurrentSpeaker(payload.data.currentSpeaker ?? null);
      setLogs(Array.isArray(payload.data.logs) ? payload.data.logs : []);
      setModeState(payload.data.mode ?? 'idle');
      setCurrentYield(payload.data.currentYield ?? null);
      setStats(payload.data.stats ?? initialStats);
      setSessionId(payload.data.sessionId || 'session_client');
      setLastSyncedAt(payload.data.updatedAt ?? Date.now());
      setIsActive(true);
    } catch {
      if (mountedRef.current) {
        setSyncError('Network error while syncing session state');
      }
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!timer.isRunning) {
        void fetchSession();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchSession, timer.isRunning]);

  const requestQueue = useCallback(async (body: unknown, method: 'POST' | 'PUT' = 'POST'): Promise<boolean> => {
    if (mountedRef.current) {
      setIsQueueLoading(true);
      setQueueError(null);
    }

    try {
      const response = await fetchWithTimeout('/api/queue', {
        method,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeout: 8000,
      });
      const payload = (await response.json()) as QueueResponse;

      if (!mountedRef.current) {
        return false;
      }

      if (!response.ok || !payload.success) {
        setQueueError(payload.error || 'Queue request failed');
        return false;
      }

      await fetchSession();
      return true;
    } catch {
      if (mountedRef.current) {
        setQueueError('Network error while updating queue');
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsQueueLoading(false);
      }
    }
  }, [fetchSession]);

  const addSpeaker = useCallback(async (delegate: Omit<Delegate, 'id' | 'createdAt'>): Promise<boolean> => {
    return withMutationLock(async () => {
      const name = delegate.name.trim();
      const country = delegate.country.trim();

      if (!name || !country) {
        setQueueError('Delegate name and country are required.');
        return false;
      }

      const duplicate = queue.some((speaker) => speaker.country.trim().toLowerCase() === country.toLowerCase())
        || currentSpeaker?.country.trim().toLowerCase() === country.toLowerCase();

      if (duplicate) {
        setQueueError(`${country} is already in the speakers list.`);
        return false;
      }

      return requestQueue({
        action: 'add',
        name,
        country,
        autoAssignIfIdle: currentSpeaker === null,
        allocatedTime: defaultTime,
      });
    });
  }, [withMutationLock, queue, currentSpeaker, requestQueue, defaultTime]);

  const removeSpeaker = useCallback(async (id: string): Promise<boolean> => {
    return withMutationLock(async () => requestQueue({ action: 'remove', delegateId: id }));
  }, [withMutationLock, requestQueue]);

  const reorderQueue = useCallback(async (fromIndex: number, toIndex: number): Promise<boolean> => {
    return withMutationLock(async () => requestQueue({ action: 'reorder', fromIndex, toIndex }, 'PUT'));
  }, [withMutationLock, requestQueue]);

  const moveToBottom = useCallback(async (id: string): Promise<boolean> => {
    return withMutationLock(async () => requestQueue({ action: 'moveBottom', delegateId: id }));
  }, [withMutationLock, requestQueue]);

  const promoteToTop = useCallback(async (id: string): Promise<boolean> => {
    return withMutationLock(async () => requestQueue({ action: 'promoteTop', delegateId: id }));
  }, [withMutationLock, requestQueue]);

  const nextSpeaker = useCallback(async (allocatedTime: number): Promise<boolean> => {
    return withMutationLock(async () => {
      const ok = await requestQueue({ action: 'next', allocatedTime });
      if (ok) {
        timer.setTime(allocatedTime);
        timer.start();
      }
      return ok;
    });
  }, [withMutationLock, requestQueue, timer]);

  const clearQueue = useCallback(async (): Promise<boolean> => {
    return withMutationLock(async () => {
      const ok = await requestQueue({ action: 'clear' }, 'PUT');
      if (ok) {
        timer.reset();
      }
      return ok;
    });
  }, [withMutationLock, requestQueue, timer]);

  const endCurrentSpeaker = useCallback(async (): Promise<boolean> => {
    return withMutationLock(async () => requestQueue({ action: 'end_speech' }, 'PUT'));
  }, [withMutationLock, requestQueue]);

  const setAutoNext = useCallback((enabled: boolean) => {
    setAutoNextState(enabled);
  }, []);

  const addLog = useCallback((type: LogType, message: string, metadata?: Record<string, unknown>) => {
    void (async () => {
      try {
        await fetchWithTimeout('/api/logs', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, message, metadata }),
          timeout: 5000,
        });
      } finally {
        await fetchSession();
      }
    })();
  }, [fetchSession]);

  const clearLogs = useCallback(async (): Promise<void> => {
    await withMutationLock(async () => {
      await fetchWithTimeout('/api/logs', { method: 'DELETE', timeout: 5000, cache: 'no-store' });
      await fetchSession();
      return true;
    });
  }, [withMutationLock, fetchSession]);

  const removeLog = useCallback(async (logId: string): Promise<void> => {
    await withMutationLock(async () => {
      await fetchWithTimeout('/api/logs', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', logId }),
        timeout: 5000,
      });
      await fetchSession();
      return true;
    });
  }, [withMutationLock, fetchSession]);

  const setMode = useCallback((nextMode: SessionMode): void => {
    void (async () => {
      await fetchWithTimeout('/api/session', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextMode }),
        timeout: 5000,
      });
      await fetchSession();
    })();
  }, [fetchSession]);

  const createYield = useCallback(async (type: 'chair' | 'delegate' | 'questions', toDelegateId?: string): Promise<boolean> => {
    if (!currentSpeaker) return false;

    const response = await fetchWithTimeout('/api/yield', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        fromSpeakerId: currentSpeaker.id,
        toDelegateId,
        remainingTime: timer.time,
      }),
      timeout: 5000,
    });

    const payload = (await response.json()) as YieldResponse;
    return Boolean(response.ok && payload.success);
  }, [currentSpeaker, timer.time]);

  const canYield = useMemo(() => {
    return currentSpeaker !== null && mode === 'speech' && timer.time > 0 && !isSyncing && !opLockRef.current;
  }, [currentSpeaker, mode, timer.time, isSyncing]);

  const yieldToChair = useCallback(async (): Promise<boolean> => {
    return withMutationLock(async () => {
      if (!currentSpeaker || !canYield) return false;

      timer.pause();
      timer.reset();

      const yielded = await createYield('chair');
      if (!yielded) return false;

      await requestQueue({ action: 'end_speech' }, 'PUT');
      await requestQueue({ action: 'next', allocatedTime: defaultTime });

      await fetchWithTimeout('/api/session', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'speech' }),
        timeout: 5000,
      });

      await fetchSession();
      return true;
    });
  }, [withMutationLock, currentSpeaker, canYield, timer, createYield, requestQueue, defaultTime, fetchSession]);

  const yieldToDelegate = useCallback(async (delegateId: string): Promise<boolean> => {
    return withMutationLock(async () => {
      if (!currentSpeaker || !canYield || !timer.isRunning) return false;

      const targetExists = queue.some((speaker) => speaker.id === delegateId);
      if (!targetExists) {
        setQueueError('Invalid yield target delegate.');
        return false;
      }

      const yielded = await createYield('delegate', delegateId);
      if (!yielded) return false;

      const ok = await requestQueue({
        action: 'yield_delegate',
        delegateId,
        allocatedTime: timer.time,
      }, 'PUT');

      if (!ok) return false;

      timer.start();
      await fetchSession();
      return true;
    });
  }, [withMutationLock, currentSpeaker, canYield, timer, queue, createYield, requestQueue, fetchSession]);

  const yieldToQuestions = useCallback(async (): Promise<boolean> => {
    return withMutationLock(async () => {
      if (!currentSpeaker || !canYield) return false;

      const yielded = await createYield('questions');
      if (!yielded) return false;

      timer.pause();
      await fetchWithTimeout('/api/session', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'qa' }),
        timeout: 5000,
      });

      await fetchSession();
      return true;
    });
  }, [withMutationLock, currentSpeaker, canYield, createYield, timer, fetchSession]);

  const clearYield = useCallback((): void => {
    void (async () => {
      await fetchWithTimeout('/api/yield', { method: 'DELETE', timeout: 5000, cache: 'no-store' });
      await fetchSession();
    })();
  }, [fetchSession]);

  const resetSession = useCallback(async (): Promise<void> => {
    await withMutationLock(async () => {
      await fetchWithTimeout('/api/queue', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
        timeout: 5000,
      });
      await fetchWithTimeout('/api/logs', { method: 'DELETE', timeout: 5000, cache: 'no-store' });
      await fetchWithTimeout('/api/yield', { method: 'DELETE', timeout: 5000, cache: 'no-store' });
      await fetchWithTimeout('/api/session', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'idle' }),
        timeout: 5000,
      });
      timer.reset();
      await fetchSession();
      return true;
    });
  }, [withMutationLock, timer, fetchSession]);

  const startSession = useCallback((): void => {
    setIsActive(true);
    setMode('idle');
  }, [setMode]);

  const endSession = useCallback(async (): Promise<void> => {
    setIsActive(false);
    await resetSession();
  }, [resetSession]);

  const queueState: UseQueueReturn = useMemo(() => ({
    queue,
    currentSpeaker,
    addSpeaker,
    removeSpeaker,
    reorderQueue,
    moveToBottom,
    promoteToTop,
    nextSpeaker,
    clearQueue,
    endCurrentSpeaker,
    refresh: async () => {
      await fetchSession();
      return {
        success: true,
        data: {
          speakers: queue,
          currentSpeaker,
        },
        error: null,
      };
    },
    isInQueue: (country: string) => {
      const normalized = country.trim().toLowerCase();
      return (
        queue.some((speaker) => speaker.country.trim().toLowerCase() === normalized) ||
        currentSpeaker?.country.trim().toLowerCase() === normalized
      );
    },
    queueLength: queue.length,
    isEmpty: queue.length === 0,
    isLoading: isQueueLoading || isSyncing,
    error: queueError || syncError,
  }), [
    queue,
    currentSpeaker,
    addSpeaker,
    removeSpeaker,
    reorderQueue,
    moveToBottom,
    promoteToTop,
    nextSpeaker,
    clearQueue,
    endCurrentSpeaker,
    fetchSession,
    isQueueLoading,
    isSyncing,
    queueError,
    syncError,
  ]);

  return {
    mode,
    sessionId,
    isActive,
    queue: queueState,
    timer,
    currentYield,
    yieldToChair,
    yieldToDelegate,
    yieldToQuestions,
    clearYield,
    canYield,
    logs,
    addLog,
    clearLogs,
    removeLog,
    startSession,
    endSession,
    resetSession,
    setMode,
    fetchSession,
    stats,
    autoNext,
    setAutoNext,
    isSyncing,
    lastSyncedAt,
    syncError,
  };
}

export default useSession;
