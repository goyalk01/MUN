/**
 * MUN Command Center - Logs API Route
 * Handles session activity logging for audit and history
 * 
 * Endpoints:
 * GET    /api/logs - Retrieve logs with optional filtering
 * POST   /api/logs - Add a new log entry
 * DELETE /api/logs - Clear all logs
 * PUT    /api/logs - Batch add logs
 * 
 * CRITICAL: All state mutations are immutable
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  ActivityLog, 
  LogsResponse,
  LogType 
} from '@/lib/types';
import { generateLogId } from '@/lib/utils';

// In-memory log storage (replace with database in production)
let logs: ActivityLog[] = [];

// Maximum logs to retain in memory
const MAX_LOGS = 1000;

// Valid log types for validation
const VALID_LOG_TYPES: readonly LogType[] = [
  'speaker_start',
  'speaker_end',
  'yield_chair',
  'yield_delegate',
  'yield_questions',
  'timer_start',
  'timer_pause',
  'timer_reset',
  'timer_expired',
  'queue_add',
  'queue_remove',
  'queue_reorder',
  'session_start',
  'session_end',
  'mode_change',
] as const;

// Type guard for log type validation
function isValidLogType(type: unknown): type is LogType {
  return typeof type === 'string' && VALID_LOG_TYPES.includes(type as LogType);
}

// Helper functions for consistent responses
function successResponse(data: ActivityLog[], status = 200): NextResponse<LogsResponse> {
  return NextResponse.json({
    success: true,
    data,
    error: null,
  }, { status });
}

function errorResponse(message: string, status: number): NextResponse<LogsResponse> {
  return NextResponse.json({
    success: false,
    data: null,
    error: message,
  }, { status });
}

/**
 * GET /api/logs - Retrieve logs with optional filtering
 * Query params:
 * - types: comma-separated log types to filter (validated)
 * - from: start timestamp
 * - to: end timestamp
 * - limit: max number of logs to return (1-1000)
 */
export async function GET(request: NextRequest): Promise<NextResponse<LogsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    
    let filteredLogs = [...logs];

    // Filter by types with validation
    const typesParam = searchParams.get('types');
    if (typesParam) {
      const requestedTypes = typesParam.split(',');
      const validTypes = requestedTypes.filter(isValidLogType);
      
      if (validTypes.length > 0) {
        filteredLogs = filteredLogs.filter(log => validTypes.includes(log.type));
      }
      // If no valid types provided, return empty result
      if (validTypes.length === 0 && requestedTypes.length > 0) {
        return successResponse([]);
      }
    }

    // Filter by time range
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    
    if (fromParam) {
      const from = parseInt(fromParam, 10);
      if (!isNaN(from) && from >= 0) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= from);
      }
    }

    if (toParam) {
      const to = parseInt(toParam, 10);
      if (!isNaN(to) && to >= 0) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= to);
      }
    }

    // Apply limit (clamped to 1-1000)
    const limitParam = searchParams.get('limit');
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        const clampedLimit = Math.min(limit, MAX_LOGS);
        filteredLogs = filteredLogs.slice(-clampedLimit);
      }
    }

    return successResponse(filteredLogs);

  } catch (error) {
    console.error('Logs GET error:', error);
    return errorResponse('Failed to retrieve logs.', 500);
  }
}

/**
 * POST /api/logs - Add a new log entry
 * Body: { type: LogType, message: string, metadata?: object }
 */
export async function POST(request: NextRequest): Promise<NextResponse<LogsResponse>> {
  try {
    const body = await request.json();
    const { type, message, metadata } = body;

    // Validate type
    if (!isValidLogType(type)) {
      return errorResponse(`Invalid log type. Must be one of: ${VALID_LOG_TYPES.join(', ')}`, 400);
    }

    // Validate message
    if (!message || typeof message !== 'string') {
      return errorResponse('Log message is required and must be a string.', 400);
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0 || trimmedMessage.length > 1000) {
      return errorResponse('Log message must be 1-1000 characters.', 400);
    }

    // Validate metadata if present
    if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))) {
      return errorResponse('Metadata must be an object.', 400);
    }

    // Create log entry
    const logEntry: ActivityLog = {
      id: generateLogId(),
      type,
      message: trimmedMessage,
      timestamp: Date.now(),
      metadata,
    };

    // Immutable add (maintaining max limit)
    const newLogs = [...logs, logEntry];
    logs = newLogs.length > MAX_LOGS ? newLogs.slice(-MAX_LOGS) : newLogs;

    return successResponse([logEntry]);

  } catch (error) {
    console.error('Logs POST error:', error);
    return errorResponse('Failed to add log entry.', 500);
  }
}

/**
 * DELETE /api/logs - Clear all logs
 */
export async function DELETE(): Promise<NextResponse<LogsResponse>> {
  logs = [];
  return successResponse([]);
}

/**
 * PUT /api/logs - Batch add logs
 * Body: { logs: Array<{ type: LogType, message: string, metadata?: object }> }
 */
export async function PUT(request: NextRequest): Promise<NextResponse<LogsResponse>> {
  try {
    const body = await request.json();
    const { logs: newLogs } = body;

    if (!Array.isArray(newLogs)) {
      return errorResponse('Logs array is required.', 400);
    }

    if (newLogs.length > 100) {
      return errorResponse('Cannot add more than 100 logs at once.', 400);
    }

    const addedLogs: ActivityLog[] = [];

    for (const log of newLogs) {
      const { type, message, metadata } = log;
      
      // Skip invalid entries
      if (!isValidLogType(type)) continue;
      if (!message || typeof message !== 'string') continue;
      
      const trimmedMessage = message.trim();
      if (trimmedMessage.length === 0 || trimmedMessage.length > 1000) continue;

      const logEntry: ActivityLog = {
        id: generateLogId(),
        type,
        message: trimmedMessage,
        timestamp: Date.now(),
        metadata: typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata) 
          ? metadata 
          : undefined,
      };

      addedLogs.push(logEntry);
    }

    // Immutable add (maintaining max limit)
    const combinedLogs = [...logs, ...addedLogs];
    logs = combinedLogs.length > MAX_LOGS ? combinedLogs.slice(-MAX_LOGS) : combinedLogs;

    return successResponse(addedLogs);

  } catch (error) {
    console.error('Logs PUT error:', error);
    return errorResponse('Failed to batch add logs.', 500);
  }
}
