/**
 * MUN Command Center - Chair Dashboard
 * Premium minimal UI - Silent Luxury Design System
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import { useSession } from '@/hooks/useSession';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { TIMER_PRESETS, TimerPreset } from '@/lib/types';
import { formatTime } from '@/lib/utils';

// Components
import { SpeakerCard } from '@/components/SpeakerCard';
import { Timer } from '@/components/Timer';
import { YieldPanel } from '@/components/YieldPanel';
import { QueueList } from '@/components/QueueList';
import { ActivityLogComponent } from '@/components/ActivityLog';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function DashboardPage() {
  const session = useSession({
    defaultTime: TIMER_PRESETS.STANDARD,
    persistLogs: true,
    maxLogs: 500,
  });

  const { 
    mode, 
    sessionId, 
    isActive,
    queue, 
    timer, 
    canYield,
    logs,
    stats,
    autoNext,
    setAutoNext,
    yieldToChair,
    yieldToDelegate,
    yieldToQuestions,
    clearLogs,
    startSession,
    endSession,
  } = session;

  const handleSetPreset = useCallback((preset: TimerPreset) => {
    timer.setPreset(preset);
  }, [timer]);

  const handleToggleAutoNext = useCallback(() => {
    setAutoNext(!autoNext);
  }, [autoNext, setAutoNext]);

  // Toggle timer start/pause
  const handleToggleTimer = useCallback(() => {
    if (timer.isRunning) {
      timer.pause();
    } else {
      timer.start();
    }
  }, [timer]);

  // Call next speaker with default time
  const handleNextSpeaker = useCallback(() => {
    void queue.nextSpeaker(TIMER_PRESETS.STANDARD);
  }, [queue]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleTimer: handleToggleTimer,
    onNextSpeaker: handleNextSpeaker,
    onResetTimer: timer.reset,
    isTimerRunning: timer.isRunning,
    hasCurrentSpeaker: queue.currentSpeaker !== null,
    hasQueuedSpeakers: queue.queueLength > 0,
    isEnabled: isActive,
  });

  // Format average speaking time
  const formattedAvgTime = useMemo(() => {
    return stats.averageSpeakingTime > 0 
      ? formatTime(stats.averageSpeakingTime)
      : '--:--';
  }, [stats.averageSpeakingTime]);

  return (
    <div className="app-shell bg-grain">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 h-80 w-[38rem] rounded-full bg-white/5 blur-3xl dark:bg-white/[0.03]" />
        <div className="absolute bottom-0 right-0 h-72 w-[32rem] rounded-full bg-black/5 blur-3xl dark:bg-white/[0.02]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-[var(--border-color)] backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--text-primary)] flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--bg-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-[var(--text-primary)]">MUN Command Center</h1>
                <p className="text-xs text-[var(--text-tertiary)]">Chair Dashboard</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Auto-Next Toggle */}
              <button
                onClick={handleToggleAutoNext}
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                  autoNext 
                    ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]'
                }`}
                title="Auto-advance to next speaker when timer expires"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-medium">Auto</span>
              </button>

              {/* Session Status */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                <span className={`status-dot ${isActive ? 'status-dot-active' : 'status-dot-idle'}`} />
                <span className="text-xs text-[var(--text-secondary)]">
                  {isActive ? 'Session Active' : 'Idle'}
                </span>
              </div>

              {/* Session Toggle */}
              {!isActive ? (
                <button onClick={startSession} className="btn btn-success px-4 py-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Start
                </button>
              ) : (
                <button onClick={endSession} className="btn btn-danger px-4 py-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h12v12H6z" />
                  </svg>
                  End
                </button>
              )}

              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1600px] mx-auto px-6 lg:px-8 py-6">
        <div className="layout-grid">
          {/* Left Column - Queue */}
          <div className="order-2 lg:order-1">
            <div className="h-[calc(100vh-9rem)] sticky top-24">
              <QueueList
                speakers={queue.queue}
                currentSpeaker={queue.currentSpeaker}
                onAddSpeaker={queue.addSpeaker}
                onRemoveSpeaker={queue.removeSpeaker}
                onReorderQueue={queue.reorderQueue}
                onSelectNext={queue.nextSpeaker}
                isInQueue={queue.isInQueue}
                defaultTime={TIMER_PRESETS.STANDARD}
                isLoading={queue.isLoading}
                error={queue.error}
              />
            </div>
          </div>

          {/* Center Column - Hero Section */}
          <div className="order-1 lg:order-2 space-y-5">
            {/* Current Speaker - Hero */}
            <SpeakerCard
              speaker={queue.currentSpeaker}
              time={timer.time}
              formattedTime={timer.formattedTime}
              progress={timer.progress}
              isRunning={timer.isRunning}
              mode={mode}
            />

            {/* Timer Controls */}
            <Timer
              time={timer.time}
              initialTime={timer.initialTime}
              isRunning={timer.isRunning}
              isPaused={timer.isPaused}
              progress={timer.progress}
              formattedTime={timer.formattedTime}
              onStart={timer.start}
              onPause={timer.pause}
              onReset={timer.reset}
              onSetPreset={handleSetPreset}
              disabled={!queue.currentSpeaker}
            />

            {/* Yield Panel */}
            <YieldPanel
              currentSpeaker={queue.currentSpeaker}
              queue={queue.queue}
              canYield={canYield}
              onYieldToChair={yieldToChair}
              onYieldToDelegate={yieldToDelegate}
              onYieldToQuestions={yieldToQuestions}
            />

            {/* Session Statistics - Intelligence Panel */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">Session Intelligence</h3>
                <span className="text-label text-[var(--text-tertiary)]">LIVE STATS</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-semibold text-[var(--text-primary)]">{stats.totalSpeakers}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Total Speakers</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-[var(--text-primary)]">{stats.currentSpeakerIndex}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Current Position</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold font-mono text-[var(--text-primary)]">{formattedAvgTime}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Avg. Time</p>
                </div>
              </div>
              
              {/* Yield Stats */}
              {(stats.yieldCount.chair > 0 || stats.yieldCount.delegate > 0 || stats.yieldCount.questions > 0) && (
                <div className="mt-4 pt-3 border-t border-[var(--border-color)]">
                  <p className="text-label text-[var(--text-tertiary)] mb-2">YIELDS</p>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-xs text-[var(--text-secondary)]">Chair: {stats.yieldCount.chair}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs text-[var(--text-secondary)]">Delegate: {stats.yieldCount.delegate}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs text-[var(--text-secondary)]">Q&A: {stats.yieldCount.questions}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="card px-4 py-3">
                <p className="text-label text-[var(--text-tertiary)]">QUEUE</p>
                <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{queue.queueLength}</p>
              </div>
              <div className="card px-4 py-3">
                <p className="text-label text-[var(--text-tertiary)]">EVENTS</p>
                <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{logs.length}</p>
              </div>
              <div className="card px-4 py-3">
                <p className="text-label text-[var(--text-tertiary)]">MODE</p>
                <p className="mt-1 text-xl font-semibold text-[var(--text-primary)] capitalize">{mode}</p>
              </div>
              <div className="card px-4 py-3">
                <p className="text-label text-[var(--text-tertiary)]">SESSION</p>
                <p className="mt-1 text-sm font-mono text-[var(--text-secondary)] truncate">{sessionId.slice(-8)}</p>
              </div>
            </div>

            {/* Keyboard Shortcuts Hint */}
            {isActive && (
              <div className="hidden lg:flex items-center justify-center gap-6 text-xs text-[var(--text-tertiary)]">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono">Space</kbd>
                  Start/Pause
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono">N</kbd>
                  Next Speaker
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono">R</kbd>
                  Reset Timer
                </span>
              </div>
            )}
          </div>

          {/* Right Column - Activity Log */}
          <div className="order-3">
            <div className="h-[calc(100vh-9rem)] sticky top-24">
              <ActivityLogComponent
                logs={logs}
                onClear={clearLogs}
                maxVisible={50}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-[var(--border-color)] mt-8">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
            <span>MUN Command Center</span>
            <span>Following MUN Rules of Procedure</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
