/**
 * YieldPanel Component
 * Minimal yield controls with clear actions
 * 
 * Premium Design: Clear separation, instant feedback, loading states
 */

'use client';

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { YieldPanelProps } from '@/lib/types';

type YieldOperation = 'chair' | 'delegate' | 'questions' | null;

export const YieldPanel = memo(function YieldPanel({
  currentSpeaker,
  queue,
  canYield,
  onYieldToChair,
  onYieldToDelegate,
  onYieldToQuestions,
  disabled = false,
}: YieldPanelProps) {
  const [showDelegateSelector, setShowDelegateSelector] = useState(false);
  const [selectedDelegate, setSelectedDelegate] = useState<string>('');
  const [loadingOperation, setLoadingOperation] = useState<YieldOperation>(null);
  const [error, setError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup error timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const showError = useCallback((message: string) => {
    setError(message);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setError(null);
      errorTimeoutRef.current = null;
    }, 3000);
  }, []);

  const handleYieldToChair = useCallback(async () => {
    if (loadingOperation) return;
    setLoadingOperation('chair');
    setError(null);
    
    try {
      const success = await onYieldToChair();
      if (!success) showError('Failed to yield to Chair');
    } catch {
      showError('An error occurred');
    } finally {
      setLoadingOperation(null);
    }
  }, [loadingOperation, onYieldToChair, showError]);

  const handleYieldToDelegate = useCallback(async () => {
    if (!selectedDelegate || loadingOperation) return;
    setLoadingOperation('delegate');
    setError(null);
    
    try {
      const success = await onYieldToDelegate(selectedDelegate);
      if (success) {
        setShowDelegateSelector(false);
        setSelectedDelegate('');
      } else {
        showError('Failed to yield to delegate');
      }
    } catch {
      showError('An error occurred');
    } finally {
      setLoadingOperation(null);
    }
  }, [selectedDelegate, loadingOperation, onYieldToDelegate, showError]);

  const handleYieldToQuestions = useCallback(async () => {
    if (loadingOperation) return;
    setLoadingOperation('questions');
    setError(null);
    
    try {
      const success = await onYieldToQuestions();
      if (!success) showError('Failed to yield to questions');
    } catch {
      showError('An error occurred');
    } finally {
      setLoadingOperation(null);
    }
  }, [loadingOperation, onYieldToQuestions, showError]);

  const isDisabled = disabled || !canYield || loadingOperation !== null;

  const LoadingSpinner = () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-title text-[var(--text-primary)]">Yield</h2>
        {canYield && (
          <span className="flex items-center gap-1.5">
            <span className="status-dot status-dot-active" />
            <span className="text-label text-[var(--text-tertiary)]">ENABLED</span>
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400 animate-fade-in">
          {error}
        </div>
      )}

      {/* Current Speaker Context */}
      {currentSpeaker && (
        <div className="px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <p className="text-label text-[var(--text-tertiary)]">CURRENT SPEAKER</p>
          <p className="mt-1 text-body font-medium text-[var(--text-primary)]">
            {currentSpeaker.country}
          </p>
        </div>
      )}

      {/* Yield Buttons */}
      <div className="space-y-3">
        {/* Yield to Chair */}
        <button
          onClick={handleYieldToChair}
          disabled={isDisabled}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-lg transition-all
            ${!isDisabled
              ? 'bg-[var(--bg-primary)] hover:bg-[var(--border-color)] border border-[var(--border-color)]'
              : 'opacity-40 cursor-not-allowed bg-[var(--bg-primary)] border border-[var(--border-color)]'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center
              ${!isDisabled ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--border-color)] text-[var(--text-tertiary)]'}
            `}>
              {loadingOperation === 'chair' ? <LoadingSpinner /> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-[var(--text-primary)]">Yield to Chair</p>
              <p className="text-xs text-[var(--text-tertiary)]">End speech, return time</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Yield to Delegate */}
        <div>
          <button
            onClick={() => setShowDelegateSelector(!showDelegateSelector)}
            disabled={isDisabled || queue.length === 0}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-lg transition-all
              ${!isDisabled && queue.length > 0
                ? 'bg-[var(--bg-primary)] hover:bg-[var(--border-color)] border border-[var(--border-color)]'
                : 'opacity-40 cursor-not-allowed bg-[var(--bg-primary)] border border-[var(--border-color)]'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center
                ${!isDisabled && queue.length > 0 ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--border-color)] text-[var(--text-tertiary)]'}
              `}>
                {loadingOperation === 'delegate' ? <LoadingSpinner /> : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-[var(--text-primary)]">Yield to Delegate</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {queue.length > 0 ? `${queue.length} in queue` : 'No delegates available'}
                </p>
              </div>
            </div>
            <svg 
              className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${showDelegateSelector ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Delegate Selector */}
          {showDelegateSelector && queue.length > 0 && (
            <div className="mt-2 p-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] animate-fade-in space-y-3">
              <select
                aria-label="Select delegate"
                value={selectedDelegate}
                onChange={(e) => setSelectedDelegate(e.target.value)}
                className="select"
              >
                <option value="">Select delegate...</option>
                {queue.map((speaker) => (
                  <option key={speaker.id} value={speaker.id}>
                    {speaker.country}
                  </option>
                ))}
              </select>
              <button
                onClick={handleYieldToDelegate}
                disabled={!selectedDelegate || loadingOperation === 'delegate'}
                className={`w-full btn py-2.5 ${selectedDelegate && loadingOperation !== 'delegate' ? 'btn-primary' : 'opacity-40 cursor-not-allowed bg-[var(--border-color)]'}`}
              >
                {loadingOperation === 'delegate' ? (
                  <><LoadingSpinner /> Processing...</>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Yield to Questions */}
        <button
          onClick={handleYieldToQuestions}
          disabled={isDisabled}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-lg transition-all
            ${!isDisabled
              ? 'bg-[var(--bg-primary)] hover:bg-[var(--border-color)] border border-[var(--border-color)]'
              : 'opacity-40 cursor-not-allowed bg-[var(--bg-primary)] border border-[var(--border-color)]'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center
              ${!isDisabled ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--border-color)] text-[var(--text-tertiary)]'}
            `}>
              {loadingOperation === 'questions' ? <LoadingSpinner /> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-[var(--text-primary)]">Yield to Questions</p>
              <p className="text-xs text-[var(--text-tertiary)]">Open Q&A session</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Helper text */}
      {!canYield && (
        <p className="text-center text-caption text-[var(--text-tertiary)]">
          {!currentSpeaker ? 'Select a speaker first' : 'Start timer to enable yields'}
        </p>
      )}
    </div>
  );
});

export default YieldPanel;
