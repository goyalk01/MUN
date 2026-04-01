/**
 * MUN Command Center - Utility Functions
 * Pure utility functions with no side effects
 */

import { ActivityLog, LogType, Speaker, Delegate } from './types';

// ============================================
// ID GENERATION
// ============================================

/**
 * Generates a unique ID using timestamp and random string
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Generates a session ID
 */
export function generateSessionId(): string {
  return generateId('session');
}

/**
 * Generates a delegate ID
 */
export function generateDelegateId(): string {
  return generateId('delegate');
}

/**
 * Generates a log entry ID
 */
export function generateLogId(): string {
  return generateId('log');
}

// ============================================
// TIME FORMATTING
// ============================================

/**
 * Formats seconds into MM:SS format
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats timestamp into readable time (HH:MM:SS)
 * Uses deterministic zero-pad formatting to avoid SSR/client hydration mismatches.
 */
export function formatTimestamp(timestamp: number): string {
  return formatTimestampSafe(new Date(timestamp));
}

/**
 * Deterministic timestamp formatter safe for SSR/client hydration.
 */
export function formatTimestampSafe(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Formats timestamp into readable date and time
 * Uses deterministic formatting to avoid SSR/client hydration mismatches.
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const hours = date.getHours();
  const h12 = hours % 12 || 12;
  const ampm = hours < 12 ? 'AM' : 'PM';
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${h12}:${m} ${ampm}`;
}

/**
 * Calculates progress percentage (0 to 1)
 */
export function calculateProgress(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (total - current) / total));
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validates delegate name
 */
export function isValidDelegateName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 100;
}

/**
 * Validates country name
 */
export function isValidCountry(country: string): boolean {
  return country.trim().length >= 2 && country.trim().length <= 100;
}

/**
 * Validates timer value (in seconds)
 */
export function isValidTimerValue(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= 0 && seconds <= 600;
}

/**
 * Checks if a country is already in the queue
 */
export function isCountryInQueue(country: string, queue: Speaker[]): boolean {
  const normalizedCountry = country.trim().toLowerCase();
  return queue.some(s => s.country.trim().toLowerCase() === normalizedCountry);
}

// ============================================
// QUEUE OPERATIONS
// ============================================

/**
 * Reorders an array by moving an element from one index to another
 */
export function reorderArray<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= array.length) return array;
  if (toIndex < 0 || toIndex >= array.length) return array;
  if (fromIndex === toIndex) return array;

  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  
  return result;
}

/**
 * Updates positions in a speaker array
 */
export function updatePositions(speakers: Speaker[]): Speaker[] {
  return speakers.map((speaker, index) => ({
    ...speaker,
    position: index + 1,
  }));
}

/**
 * Creates a new speaker from delegate info
 */
export function createSpeaker(
  delegate: Omit<Delegate, 'id' | 'createdAt'>,
  position: number
): Speaker {
  const now = Date.now();
  return {
    id: generateDelegateId(),
    name: delegate.name.trim(),
    country: delegate.country.trim(),
    createdAt: now,
    addedAt: now,
    position,
  };
}

// ============================================
// LOG HELPERS
// ============================================

/**
 * Creates an activity log entry
 */
export function createLogEntry(
  type: LogType,
  message: string,
  metadata?: Record<string, unknown>
): ActivityLog {
  return {
    id: generateLogId(),
    type,
    message,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Gets a human-readable label for log types
 */
export function getLogTypeLabel(type: LogType): string {
  const labels: Record<LogType, string> = {
    speaker_start: '🎤 Speaker',
    speaker_end: '✓ Speech End',
    yield_chair: '⬆️ Yield to Chair',
    yield_delegate: '➡️ Yield to Delegate',
    yield_questions: '❓ Yield to Questions',
    timer_start: '▶️ Timer',
    timer_pause: '⏸️ Timer',
    timer_reset: '🔄 Timer',
    timer_expired: '⏰ Time Up',
    queue_add: '➕ Queue',
    queue_remove: '➖ Queue',
    queue_reorder: '↕️ Queue',
    session_start: '🚀 Session',
    session_end: '🏁 Session',
    mode_change: '🔀 Mode',
  };
  return labels[type] || type;
}

/**
 * Gets the CSS class for log type styling
 */
export function getLogTypeColor(type: LogType): string {
  const colors: Record<LogType, string> = {
    speaker_start: 'text-blue-500',
    speaker_end: 'text-green-500',
    yield_chair: 'text-purple-500',
    yield_delegate: 'text-indigo-500',
    yield_questions: 'text-amber-500',
    timer_start: 'text-emerald-500',
    timer_pause: 'text-yellow-500',
    timer_reset: 'text-gray-500',
    timer_expired: 'text-red-500',
    queue_add: 'text-teal-500',
    queue_remove: 'text-rose-500',
    queue_reorder: 'text-cyan-500',
    session_start: 'text-green-600',
    session_end: 'text-red-600',
    mode_change: 'text-violet-500',
  };
  return colors[type] || 'text-gray-500';
}

// ============================================
// THEME UTILITIES
// ============================================

/**
 * Gets the current theme from localStorage or system preference
 */
export function getStoredTheme(): 'light' | 'dark' | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem('mun-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  
  return null;
}

/**
 * Gets the system theme preference
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Sets the theme in localStorage and applies it
 */
export function setTheme(theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('mun-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// ============================================
// MISC UTILITIES
// ============================================

/**
 * Clamps a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Fetch wrapper with timeout support using AbortController.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Checks if we're running on the client side
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Safe localStorage getter with fallback
 */
export function getFromStorage<T>(key: string, fallback: T): T {
  if (!isClient()) return fallback;
  
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safe localStorage setter
 */
export function setToStorage<T>(key: string, value: T): void {
  if (!isClient()) return;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
}
