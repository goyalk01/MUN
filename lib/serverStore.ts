import {
  ActivityLog,
  CurrentSpeaker,
  LogType,
  QueueState,
  SessionMode,
  SessionStats,
  Speaker,
  YieldAction,
} from '@/lib/types';
import { generateDelegateId, generateLogId, reorderArray, updatePositions } from '@/lib/utils';

interface SessionStore {
  mode: SessionMode;
  queueState: QueueState;
  currentYield: YieldAction | null;
  logs: ActivityLog[];
  sessionId: string;
  startedAt: number;
  stats: SessionStats;
}

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

const store: SessionStore = {
  mode: 'idle',
  queueState: {
    speakers: [],
    currentSpeaker: null,
  },
  currentYield: null,
  logs: [],
  sessionId: 'session_store',
  startedAt: 0,
  stats: initialStats,
};

const MAX_LOGS = 1000;

function cloneQueueState(): QueueState {
  return {
    speakers: [...store.queueState.speakers],
    currentSpeaker: store.queueState.currentSpeaker ? { ...store.queueState.currentSpeaker } : null,
  };
}

function addLogInternal(type: LogType, message: string, metadata?: Record<string, unknown>): ActivityLog {
  const entry: ActivityLog = {
    id: generateLogId(),
    type,
    message,
    timestamp: Date.now(),
    metadata,
  };

  store.logs = [...store.logs, entry].slice(-MAX_LOGS);
  return entry;
}

function recalculateStatsAfterSpeech(seconds: number): void {
  if (seconds <= 0) return;
  const speechCount = store.stats.speechCount + 1;
  const totalSpeakingTime = store.stats.totalSpeakingTime + seconds;

  store.stats = {
    ...store.stats,
    speechCount,
    totalSpeakingTime,
    averageSpeakingTime: Math.round(totalSpeakingTime / speechCount),
  };
}

export function getSessionSnapshot(): {
  mode: SessionMode;
  queue: Speaker[];
  currentSpeaker: CurrentSpeaker | null;
  currentYield: YieldAction | null;
  logs: ActivityLog[];
  sessionId: string;
  startedAt: number;
  stats: SessionStats;
} {
  const queueState = cloneQueueState();
  return {
    mode: store.mode,
    queue: queueState.speakers,
    currentSpeaker: queueState.currentSpeaker,
    currentYield: store.currentYield ? { ...store.currentYield } : null,
    logs: [...store.logs],
    sessionId: store.sessionId,
    startedAt: store.startedAt,
    stats: {
      ...store.stats,
      yieldCount: { ...store.stats.yieldCount },
    },
  };
}

export function setMode(mode: SessionMode): void {
  store.mode = mode;
}

export function clearSession(): void {
  store.mode = 'idle';
  store.queueState = {
    speakers: [],
    currentSpeaker: null,
  };
  store.currentYield = null;
  store.logs = [];
  store.stats = { ...initialStats, yieldCount: { ...initialStats.yieldCount } };
}

export function addSpeaker(name: string, country: string, autoAssignIfIdle = false, allocatedTime = 90): QueueState {
  const now = Date.now();
  const speaker: Speaker = {
    id: generateDelegateId(),
    name: name.trim(),
    country: country.trim(),
    createdAt: now,
    addedAt: now,
    position: store.queueState.speakers.length + 1,
  };

  if (autoAssignIfIdle && store.queueState.currentSpeaker === null) {
    store.queueState = {
      ...store.queueState,
      currentSpeaker: {
        ...speaker,
        startedAt: now,
        allocatedTime,
      },
    };
    store.mode = 'speech';
    store.stats = {
      ...store.stats,
      totalSpeakers: store.stats.totalSpeakers + 1,
      currentSpeakerIndex: store.stats.currentSpeakerIndex + 1,
    };
  } else {
    store.queueState = {
      ...store.queueState,
      speakers: [...store.queueState.speakers, speaker],
    };
  }

  addLogInternal('queue_add', `➕ ${speaker.country} added to GSL`, {
    speakerId: speaker.id,
  });

  return cloneQueueState();
}

export function removeSpeaker(id: string): QueueState | null {
  if (store.queueState.currentSpeaker?.id === id) {
    endCurrentSpeaker();
    return cloneQueueState();
  }

  const index = store.queueState.speakers.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const removed = store.queueState.speakers[index];
  const nextSpeakers = [
    ...store.queueState.speakers.slice(0, index),
    ...store.queueState.speakers.slice(index + 1),
  ];

  store.queueState = {
    ...store.queueState,
    speakers: updatePositions(nextSpeakers),
  };

  addLogInternal('queue_remove', `➖ ${removed.country} removed from GSL`, {
    speakerId: removed.id,
  });

  return cloneQueueState();
}

export function reorderSpeakers(fromIndex: number, toIndex: number): QueueState | null {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= store.queueState.speakers.length ||
    toIndex >= store.queueState.speakers.length
  ) {
    return null;
  }

  store.queueState = {
    ...store.queueState,
    speakers: updatePositions(reorderArray([...store.queueState.speakers], fromIndex, toIndex)),
  };

  addLogInternal('queue_reorder', '↕ Reordered speakers list', { fromIndex, toIndex });
  return cloneQueueState();
}

export function moveSpeakerToBottom(id: string): QueueState | null {
  const from = store.queueState.speakers.findIndex((speaker) => speaker.id === id);
  if (from === -1) return null;

  if (from === store.queueState.speakers.length - 1) {
    return cloneQueueState();
  }

  store.queueState = {
    ...store.queueState,
    speakers: updatePositions(reorderArray([...store.queueState.speakers], from, store.queueState.speakers.length - 1)),
  };

  return cloneQueueState();
}

export function promoteSpeakerToTop(id: string): QueueState | null {
  const from = store.queueState.speakers.findIndex((speaker) => speaker.id === id);
  if (from === -1) return null;

  if (from === 0) {
    return cloneQueueState();
  }

  store.queueState = {
    ...store.queueState,
    speakers: updatePositions(reorderArray([...store.queueState.speakers], from, 0)),
  };

  return cloneQueueState();
}

export function nextSpeaker(allocatedTime: number): QueueState | null {
  if (store.queueState.currentSpeaker) return null;
  if (store.queueState.speakers.length === 0) {
    store.mode = 'idle';
    return cloneQueueState();
  }

  const [speaker, ...rest] = store.queueState.speakers;
  store.queueState = {
    currentSpeaker: {
      ...speaker,
      startedAt: Date.now(),
      allocatedTime,
    },
    speakers: updatePositions(rest),
  };

  store.mode = 'speech';
  store.stats = {
    ...store.stats,
    totalSpeakers: store.stats.totalSpeakers + 1,
    currentSpeakerIndex: store.stats.currentSpeakerIndex + 1,
  };

  addLogInternal('speaker_start', `🎤 ${speaker.country} started speaking`, {
    speakerId: speaker.id,
    allocatedTime,
  });

  return cloneQueueState();
}

export function endCurrentSpeaker(): QueueState {
  const active = store.queueState.currentSpeaker;
  if (active) {
    const speakingTime = Math.max(0, Math.floor((Date.now() - active.startedAt) / 1000));
    recalculateStatsAfterSpeech(speakingTime);
    addLogInternal('speaker_end', `⏹ ${active.country} ended speech`, {
      speakerId: active.id,
      speakingTime,
    });
  }

  store.queueState = {
    ...store.queueState,
    currentSpeaker: null,
  };
  store.mode = 'idle';

  return cloneQueueState();
}

export function clearQueue(): QueueState {
  store.queueState = {
    speakers: [],
    currentSpeaker: null,
  };
  store.mode = 'idle';
  addLogInternal('queue_remove', '🧹 Queue cleared');
  return cloneQueueState();
}

export function yieldToDelegate(delegateId: string, allocatedTime: number): QueueState | null {
  if (!store.queueState.currentSpeaker) return null;

  const targetIndex = store.queueState.speakers.findIndex((s) => s.id === delegateId);
  if (targetIndex === -1) return null;

  const targetSpeaker = store.queueState.speakers[targetIndex];
  const nextSpeakers = [
    ...store.queueState.speakers.slice(0, targetIndex),
    ...store.queueState.speakers.slice(targetIndex + 1),
  ];

  store.queueState = {
    currentSpeaker: {
      ...targetSpeaker,
      startedAt: Date.now(),
      allocatedTime,
    },
    speakers: updatePositions(nextSpeakers),
  };

  store.mode = 'speech';
  store.stats = {
    ...store.stats,
    yieldCount: {
      ...store.stats.yieldCount,
      delegate: store.stats.yieldCount.delegate + 1,
    },
  };

  addLogInternal('yield_delegate', `🔁 Yielded to ${targetSpeaker.country}`, {
    toSpeakerId: targetSpeaker.id,
    remainingTime: allocatedTime,
  });

  return cloneQueueState();
}

export function setYield(action: YieldAction | null): void {
  store.currentYield = action;
}

export function getYield(): YieldAction | null {
  return store.currentYield ? { ...store.currentYield } : null;
}

export function addLog(type: LogType, message: string, metadata?: Record<string, unknown>): ActivityLog {
  return addLogInternal(type, message, metadata);
}

export function getLogs(): ActivityLog[] {
  return [...store.logs];
}

export function clearLogs(): void {
  store.logs = [];
}

export function removeLogById(logId: string): boolean {
  const before = store.logs.length;
  store.logs = store.logs.filter((log) => log.id !== logId);
  return store.logs.length < before;
}
