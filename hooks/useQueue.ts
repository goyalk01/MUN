/**
 * MUN Command Center - useQueue Hook
 * Manages General Speakers' List (GSL) with full CRUD operations
 * 
 * Features:
 * - Add/remove/reorder speakers
 * - Advance to next speaker
 * - Duplicate prevention
 * - Position tracking
 * - Error handling with timeout
 */

'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Speaker,
  CurrentSpeaker,
  Delegate,
  QueueResponse,
  UseQueueReturn,
} from '@/lib/types';
import { isCountryInQueue, fetchWithTimeout } from '@/lib/utils';

interface UseQueueOptions {
  onSpeakerChange?: (speaker: CurrentSpeaker | null) => void;
  onQueueChange?: (queue: Speaker[]) => void;
  defaultAllocatedTime?: number;
}

export function useQueue(options: UseQueueOptions = {}): UseQueueReturn {
  const {
    onSpeakerChange,
    onQueueChange,
    defaultAllocatedTime = 90,
  } = options;

  const [queue, setQueue] = useState<Speaker[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<CurrentSpeaker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  
  // Track mount state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track if initial load has happened
  const initialLoadRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyState = useCallback((data?: QueueResponse['data']) => {
    if (!data || !isMountedRef.current) return;
    setQueue(data.speakers);
    setCurrentSpeaker(data.currentSpeaker);
    onQueueChange?.(data.speakers);
    onSpeakerChange?.(data.currentSpeaker);
  }, [onQueueChange, onSpeakerChange]);

  const callQueueApi = useCallback(async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
    query?: string
  ): Promise<QueueResponse | null> => {
    if (!isMountedRef.current) return null;
    if (method !== 'GET' && inFlightRef.current) return null;
    
    try {
      if (method !== 'GET') {
        inFlightRef.current = true;
      }
      setIsLoading(true);
      setError(null);

      const response = await fetchWithTimeout(`/api/queue${query ? `?${query}` : ''}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        timeout: 10000,
      });

      if (!isMountedRef.current) return null;

      const payload = (await response.json()) as QueueResponse;

      if (!response.ok || !payload.success) {
        const message = payload.error || 'Queue operation failed';
        setError(message);
        return null;
      }

      applyState(payload.data);
      return payload;
    } catch (err) {
      if (!isMountedRef.current) return null;
      
      const message = err instanceof Error && err.name === 'AbortError' 
        ? 'Request timed out' 
        : 'Network error while processing queue operation';
      setError(message);
      return null;
    } finally {
      if (method !== 'GET') {
        inFlightRef.current = false;
      }
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [applyState]);

  const refresh = useCallback(async () => {
    return callQueueApi('GET');
  }, [callQueueApi]);

  // Initial load only - no infinite loop
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      void refresh();
    }
  }, []); // Empty deps - runs once on mount

  /**
   * Add a new speaker to the queue
   * Prevents duplicates by country
   */
  const addSpeaker = useCallback(async (delegate: Omit<Delegate, 'id' | 'createdAt'>) => {
    const normalizedCountry = delegate.country.trim().toLowerCase();
    if (queue.some((speaker) => speaker.country.trim().toLowerCase() === normalizedCountry)) {
      setError(`${delegate.country} is already in the speakers list`);
      return false;
    }
    if (currentSpeaker?.country.trim().toLowerCase() === normalizedCountry) {
      setError(`${delegate.country} is currently speaking`);
      return false;
    }

    const payload = await callQueueApi('POST', {
      ...delegate,
      autoAssignIfIdle: currentSpeaker === null,
      allocatedTime: defaultAllocatedTime,
    });
    return Boolean(payload);
  }, [callQueueApi, queue, currentSpeaker, defaultAllocatedTime]);

  /**
   * Remove a speaker from the queue by ID
   */
  const removeSpeaker = useCallback(async (id: string) => {
    const payload = await callQueueApi('DELETE', undefined, `id=${encodeURIComponent(id)}`);
    return Boolean(payload);
  }, [callQueueApi]);

  /**
   * Reorder the queue by moving a speaker from one position to another
   */
  const reorderQueue = useCallback(async (fromIndex: number, toIndex: number) => {
    const payload = await callQueueApi('PUT', {
      action: 'reorder',
      fromIndex,
      toIndex,
    });
    return Boolean(payload);
  }, [callQueueApi]);

  const moveToBottom = useCallback(async (id: string) => {
    const payload = await callQueueApi('PUT', {
      action: 'move_bottom',
      id,
    });
    return Boolean(payload);
  }, [callQueueApi]);

  /**
   * Advance to the next speaker in the queue
   * Moves first speaker to currentSpeaker with allocated time
   */
  const nextSpeaker = useCallback(async (allocatedTime: number) => {
    const payload = await callQueueApi('PUT', {
      action: 'next',
      allocatedTime,
    });
    return Boolean(payload);
  }, [callQueueApi]);

  /**
   * Clear the entire queue
   */
  const clearQueue = useCallback(async () => {
    const payload = await callQueueApi('PUT', { action: 'clear' });
    return Boolean(payload);
  }, [callQueueApi]);

  /**
   * Check if a country is already in the queue
   */
  const isInQueue = useCallback((country: string): boolean => {
    // Check queue
    if (isCountryInQueue(country, queue)) {
      return true;
    }
    // Check current speaker
    if (currentSpeaker && 
        currentSpeaker.country.toLowerCase() === country.toLowerCase()) {
      return true;
    }
    return false;
  }, [queue, currentSpeaker]);

  /**
   * End current speaker without advancing
   */
  const endCurrentSpeaker = useCallback(async () => {
    const payload = await callQueueApi('PUT', { action: 'end_speech' });
    return Boolean(payload);
  }, [callQueueApi]);

  // Computed values
  const queueLength = useMemo(() => queue.length, [queue]);
  const isEmpty = useMemo(() => queue.length === 0, [queue]);

  return {
    queue,
    currentSpeaker,
    addSpeaker,
    removeSpeaker,
    reorderQueue,
    moveToBottom,
    nextSpeaker,
    clearQueue,
    endCurrentSpeaker,
    refresh,
    isInQueue,
    queueLength,
    isEmpty,
    isLoading,
    error,
  };
}

export default useQueue;
