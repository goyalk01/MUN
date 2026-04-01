import { NextRequest, NextResponse } from 'next/server';
import { LogsResponse, LogType } from '@/lib/types';
import { addLog, clearLogs, getLogs, removeLogById } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

function isValidLogType(type: unknown): type is LogType {
  return typeof type === 'string' && VALID_LOG_TYPES.includes(type as LogType);
}

function successResponse(data = getLogs(), status = 200): NextResponse<LogsResponse> {
  return NextResponse.json(
    {
      success: true,
      data,
      error: null,
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

function errorResponse(message: string, status: number): NextResponse<LogsResponse> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse<LogsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');

    let result = getLogs();

    if (limitParam) {
      const limit = Number(limitParam);
      if (Number.isInteger(limit) && limit > 0) {
        result = result.slice(-limit);
      }
    }

    return successResponse(result);
  } catch {
    return errorResponse('Failed to retrieve logs.', 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<LogsResponse>> {
  try {
    const body = (await request.json()) as {
      type?: LogType;
      message?: string;
      metadata?: Record<string, unknown>;
    };

    if (!isValidLogType(body.type)) {
      return errorResponse(`Invalid log type. Must be one of: ${VALID_LOG_TYPES.join(', ')}`, 400);
    }

    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return errorResponse('Log message is required and must be a non-empty string.', 400);
    }

    addLog(body.type, body.message.trim(), body.metadata);
    return successResponse(getLogs());
  } catch {
    return errorResponse('Invalid request body.', 400);
  }
}

export async function DELETE(): Promise<NextResponse<LogsResponse>> {
  clearLogs();
  return successResponse([]);
}

export async function PUT(request: NextRequest): Promise<NextResponse<LogsResponse>> {
  try {
    const body = (await request.json()) as {
      action?: 'remove';
      logId?: string;
    };

    if (body.action === 'remove') {
      if (!body.logId) {
        return errorResponse('logId is required for remove action.', 400);
      }
      const removed = removeLogById(body.logId);
      if (!removed) {
        return errorResponse('Log not found.', 400);
      }
      return successResponse(getLogs());
    }

    return errorResponse('Invalid action.', 400);
  } catch {
    return errorResponse('Invalid request body.', 400);
  }
}
