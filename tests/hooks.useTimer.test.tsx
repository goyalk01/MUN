import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimer } from '@/hooks/useTimer';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('ticks down exactly once per second without overlap', () => {
    const { result } = renderHook(() => useTimer({ initialTime: 5 }));

    act(() => {
      result.current.start();
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.time).toBe(4);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.time).toBe(2);
  });

  it('stops exactly at zero and never goes negative', async () => {
    const { result } = renderHook(() => useTimer({ initialTime: 2 }));

    act(() => {
      result.current.start();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.time).toBe(0);
    expect(result.current.isExpired).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.time).toBe(0);
  });

  it('reset restores initial preset and idles timer', async () => {
    const { result } = renderHook(() => useTimer({ initialTime: 90 }));

    act(() => {
      result.current.start();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.time).toBe(87);

    act(() => {
      result.current.reset();
    });

    expect(result.current.time).toBe(90);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });
});
