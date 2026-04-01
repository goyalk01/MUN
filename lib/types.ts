/**
 * MUN Command Center - Type Definitions
 * Comprehensive TypeScript types for the entire application
 */

// ============================================
// DELEGATE & SPEAKER TYPES
// ============================================

/**
 * Represents a delegate in the committee
 */
export interface Delegate {
  id: string;
  name: string;
  country: string;
  createdAt: number;
}

/**
 * Speaker entry in the General Speakers' List
 */
export interface Speaker extends Delegate {
  addedAt: number;
  position: number;
}

/**
 * Current speaker with additional timing info
 */
export interface CurrentSpeaker extends Speaker {
  startedAt: number;
  allocatedTime: number;
}

// ============================================
// QUEUE TYPES
// ============================================

/**
 * Queue state structure
 */
export interface QueueState {
  speakers: Speaker[];
  currentSpeaker: CurrentSpeaker | null;
}

/**
 * Queue actions for API
 */
export type QueueAction = 
  | { type: 'ADD'; payload: Omit<Delegate, 'id' | 'createdAt'> }
  | { type: 'REMOVE'; payload: { id: string } }
  | { type: 'REORDER'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'NEXT' }
  | { type: 'CLEAR' };

/**
 * Queue API response
 */
export interface QueueResponse {
  success: boolean;
  data?: QueueState | null;
  error?: string | null;
}

// ============================================
// TIMER TYPES
// ============================================

/**
 * Timer state structure
 */
export interface TimerState {
  time: number;           // Current time in seconds
  initialTime: number;    // Starting time for current speech
  isRunning: boolean;
  isPaused: boolean;
}

/**
 * Timer preset options (in seconds)
 */
export const TIMER_PRESETS = {
  SHORT: 60,
  STANDARD: 90,
  LONG: 120,
  EXTENDED: 180,
} as const;

export type TimerPreset = typeof TIMER_PRESETS[keyof typeof TIMER_PRESETS];

/**
 * Timer actions
 */
export type TimerAction = 
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'SET_TIME'; payload: number }
  | { type: 'TICK' };

// ============================================
// YIELD TYPES
// ============================================

/**
 * Yield types following MUN rules of procedure
 */
export type YieldType = 'chair' | 'delegate' | 'questions';

/**
 * Yield action structure
 */
export interface YieldAction {
  type: YieldType;
  fromSpeaker: Speaker;
  toDelegate?: Delegate;  // Required for 'delegate' yield
  remainingTime: number;
  timestamp: number;
}

/**
 * Yield API request
 */
export interface YieldRequest {
  type: YieldType;
  fromSpeakerId: string;
  toDelegateId?: string;
  remainingTime: number;
}

/**
 * Yield API response
 */
export interface YieldResponse {
  success: boolean;
  data?: YieldAction | null;
  error?: string | null;
}

// ============================================
// SESSION TYPES
// ============================================

/**
 * Session mode
 */
export type SessionMode = 'speech' | 'qa' | 'idle';

/**
 * Session statistics for intelligence panel
 */
export interface SessionStats {
  totalSpeakers: number;        // Total speakers that have spoken
  currentSpeakerIndex: number;  // Current position in session
  averageSpeakingTime: number;  // Average time per speaker in seconds
  totalSpeakingTime: number;    // Total time all speakers have spoken
  speechCount: number;          // Number of completed speeches
  yieldCount: {                 // Yield statistics
    chair: number;
    delegate: number;
    questions: number;
  };
}

/**
 * Complete session state
 */
export interface SessionState {
  mode: SessionMode;
  queue: QueueState;
  timer: TimerState;
  currentYield: YieldAction | null;
  logs: ActivityLog[];
  sessionId: string;
  startedAt: number;
  stats: SessionStats;
}

// ============================================
// ACTIVITY LOG TYPES
// ============================================

/**
 * Log entry types
 */
export type LogType = 
  | 'speaker_start'
  | 'speaker_end'
  | 'yield_chair'
  | 'yield_delegate'
  | 'yield_questions'
  | 'timer_start'
  | 'timer_pause'
  | 'timer_reset'
  | 'timer_expired'
  | 'queue_add'
  | 'queue_remove'
  | 'queue_reorder'
  | 'session_start'
  | 'session_end'
  | 'mode_change';

/**
 * Activity log entry
 */
export interface ActivityLog {
  id: string;
  type: LogType;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Logs API request
 */
export interface LogsRequest {
  action: 'ADD' | 'GET' | 'CLEAR';
  log?: Omit<ActivityLog, 'id' | 'timestamp'>;
  filter?: {
    types?: LogType[];
    from?: number;
    to?: number;
    limit?: number;
  };
}

/**
 * Logs API response
 */
export interface LogsResponse {
  success: boolean;
  data?: ActivityLog[] | null;
  error?: string | null;
}

// ============================================
// HOOK RETURN TYPES
// ============================================

/**
 * useQueue hook return type
 */
export interface UseQueueReturn {
  queue: Speaker[];
  currentSpeaker: CurrentSpeaker | null;
  addSpeaker: (delegate: Omit<Delegate, 'id' | 'createdAt'>) => Promise<boolean>;
  removeSpeaker: (id: string) => Promise<boolean>;
  reorderQueue: (fromIndex: number, toIndex: number) => Promise<boolean>;
  moveToBottom: (id: string) => Promise<boolean>;
  nextSpeaker: (allocatedTime: number) => Promise<boolean>;
  clearQueue: () => Promise<boolean>;
  endCurrentSpeaker: () => Promise<boolean>;
  refresh: () => Promise<QueueResponse | null>;
  isInQueue: (country: string) => boolean;
  queueLength: number;
  isEmpty: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * useTimer hook return type
 */
export interface UseTimerReturn {
  time: number;
  initialTime: number;
  isRunning: boolean;
  isPaused: boolean;
  progress: number;  // 0 to 1
  formattedTime: string;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setTime: (seconds: number) => void;
  setPreset: (preset: TimerPreset) => void;
  isExpired: boolean;
}

/**
 * useSession hook return type
 */
export interface UseSessionReturn {
  // State
  mode: SessionMode;
  sessionId: string;
  isActive: boolean;
  
  // Queue delegation
  queue: UseQueueReturn;
  
  // Timer delegation
  timer: UseTimerReturn;
  
  // Yield management
  currentYield: YieldAction | null;
  yieldToChair: () => Promise<boolean>;
  yieldToDelegate: (delegateId: string) => Promise<boolean>;
  yieldToQuestions: () => Promise<boolean>;
  clearYield: () => void;
  canYield: boolean;
  
  // Activity logs
  logs: ActivityLog[];
  addLog: (type: LogType, message: string, metadata?: Record<string, unknown>) => void;
  clearLogs: () => Promise<void>;
  
  // Session control
  startSession: () => void;
  endSession: () => Promise<void>;
  setMode: (mode: SessionMode) => void;
  
  // Session statistics
  stats: SessionStats;
  
  // Auto-next feature
  autoNext: boolean;
  setAutoNext: (enabled: boolean) => void;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface SpeakerCardProps {
  speaker: CurrentSpeaker | null;
  time: number;
  formattedTime: string;
  progress: number;
  isRunning: boolean;
  mode: SessionMode;
}

export interface TimerProps {
  time: number;
  initialTime: number;
  isRunning: boolean;
  isPaused: boolean;
  progress: number;
  formattedTime: string;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSetPreset: (preset: TimerPreset) => void;
  disabled?: boolean;
}

export interface YieldPanelProps {
  currentSpeaker: CurrentSpeaker | null;
  queue: Speaker[];
  canYield: boolean;
  onYieldToChair: () => Promise<boolean>;
  onYieldToDelegate: (delegateId: string) => Promise<boolean>;
  onYieldToQuestions: () => Promise<boolean>;
  disabled?: boolean;
}

export interface QueueListProps {
  speakers: Speaker[];
  currentSpeaker: CurrentSpeaker | null;
  onAddSpeaker: (delegate: Omit<Delegate, 'id' | 'createdAt'>) => Promise<boolean>;
  onRemoveSpeaker: (id: string) => Promise<boolean>;
  onReorderQueue: (fromIndex: number, toIndex: number) => Promise<boolean>;
  onSelectNext: (allocatedTime: number) => Promise<boolean>;
  isInQueue: (country: string) => boolean;
  defaultTime: number;
  isLoading?: boolean;
  error?: string | null;
}

export interface ActivityLogProps {
  logs: ActivityLog[];
  onClear: () => Promise<void>;
  maxVisible?: number;
}

export interface ThemeToggleProps {
  className?: string;
}

// ============================================
// API TYPES
// ============================================

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: number;
}
