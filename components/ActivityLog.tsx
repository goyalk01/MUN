/**
 * ActivityLog Component
 * Minimal activity feed with filtering
 * 
 * Premium Design: Clean list, subtle timestamps, compact entries
 */

'use client';

import React, { memo, useState, useMemo, useCallback } from 'react';
import { ActivityLogProps, ActivityLog as ActivityLogType, LogType } from '@/lib/types';
import { formatTimestamp, getLogTypeLabel } from '@/lib/utils';

const LOG_TYPE_FILTERS: { label: string; types: LogType[] }[] = [
  { label: 'All', types: [] },
  { label: 'Speakers', types: ['speaker_start', 'speaker_end'] },
  { label: 'Timer', types: ['timer_start', 'timer_pause', 'timer_reset', 'timer_expired'] },
  { label: 'Yields', types: ['yield_chair', 'yield_delegate', 'yield_questions'] },
  { label: 'Queue', types: ['queue_add', 'queue_remove', 'queue_reorder'] },
];

// Minimal color indicators
function getLogDotClass(type: LogType): string {
  if (type.startsWith('speaker')) return 'bg-green-500';
  if (type.startsWith('timer')) return 'bg-blue-500';
  if (type.startsWith('yield')) return 'bg-amber-500';
  if (type.startsWith('queue')) return 'bg-purple-500';
  return 'bg-[var(--text-tertiary)]';
}

interface LogEntryProps {
  log: ActivityLogType;
}

const LogEntry = memo(function LogEntry({ log }: LogEntryProps) {
  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-[var(--bg-primary)] rounded-lg transition-colors animate-slide-in">
      {/* Dot indicator */}
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${getLogDotClass(log.type)}`} />
      
      {/* Content */}
      <div className="flex-grow min-w-0">
        <p className="text-sm text-[var(--text-primary)]">{log.message}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-label text-[var(--text-tertiary)]">{getLogTypeLabel(log.type)}</span>
          <span className="text-[var(--text-tertiary)]">·</span>
          <span className="text-xs font-mono text-[var(--text-tertiary)]">{formatTimestamp(log.timestamp)}</span>
        </div>
      </div>
    </div>
  );
});

export const ActivityLogComponent = memo(function ActivityLog({
  logs,
  onClear,
  maxVisible = 50,
}: ActivityLogProps) {
  const [activeFilter, setActiveFilter] = useState<LogType[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredLogs = useMemo(() => {
    let result = [...logs].reverse();
    
    if (activeFilter.length > 0) {
      result = result.filter(log => activeFilter.includes(log.type));
    }
    
    if (!isExpanded && result.length > maxVisible) {
      result = result.slice(0, maxVisible);
    }
    
    return result;
  }, [logs, activeFilter, maxVisible, isExpanded]);

  const hiddenCount = useMemo(() => {
    const total = activeFilter.length > 0 
      ? logs.filter(log => activeFilter.includes(log.type)).length 
      : logs.length;
    return Math.max(0, total - maxVisible);
  }, [logs, activeFilter, maxVisible]);

  const handleFilterClick = useCallback((types: LogType[]) => {
    setActiveFilter(types);
  }, []);

  const isFilterActive = useCallback((filterTypes: LogType[]) => {
    if (filterTypes.length === 0 && activeFilter.length === 0) return true;
    if (filterTypes.length > 0 && filterTypes.length === activeFilter.length) {
      return filterTypes.every(t => activeFilter.includes(t));
    }
    return false;
  }, [activeFilter]);
  const firstLogTimestamp = logs?.[0]?.timestamp ?? null;

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
        <h2 className="text-title text-[var(--text-primary)]">Activity</h2>
        <div className="flex items-center gap-2">
          <span className="text-caption text-[var(--text-tertiary)]">{logs.length}</span>
          <button
            onClick={onClear}
            disabled={logs.length === 0}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              logs.length > 0 
                ? 'text-red-500 hover:bg-red-500/10' 
                : 'text-[var(--text-tertiary)] cursor-not-allowed'
            }`}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-[var(--border-color)] overflow-x-auto">
        <div className="flex gap-1.5">
          {LOG_TYPE_FILTERS.map(filter => (
            <button
              key={filter.label}
              onClick={() => handleFilterClick(filter.types)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isFilterActive(filter.types)
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log List */}
      <div className="flex-grow overflow-y-auto px-2 py-2">
        {filteredLogs.length > 0 ? (
          <div className="space-y-0.5">
            {filteredLogs.map(log => (
              <LogEntry key={log.id} log={log} />
            ))}
            
            {!isExpanded && hiddenCount > 0 && (
              <button
                onClick={() => setIsExpanded(true)}
                className="w-full py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
              >
                Show {hiddenCount} more
              </button>
            )}
            
            {isExpanded && hiddenCount > 0 && (
              <button
                onClick={() => setIsExpanded(false)}
                className="w-full py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] font-medium"
              >
                Show less
              </button>
            )}
          </div>
        ) : (
          <div className="empty-state py-12">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="empty-state-title">
              {activeFilter.length > 0 ? 'No matching events' : 'No activity yet'}
            </p>
            <p className="empty-state-description">
              {activeFilter.length > 0 ? 'Try a different filter' : 'Events will appear here'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {logs.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
          <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
            <span>Showing {filteredLogs.length} of {logs.length}</span>
            <span>Started {firstLogTimestamp !== null ? formatTimestamp(firstLogTimestamp) : '--:--:--'}</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default ActivityLogComponent;
