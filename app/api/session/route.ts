/**
 * MUN Command Center - Session API Route
 * Provides and updates an in-memory session snapshot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionState, SessionMode, TIMER_PRESETS } from '@/lib/types';

interface SessionResponse {
  success: boolean;
  data: SessionState | null;
  error: string | null;
}

const initialSessionState: SessionState = {
  mode: 'idle',
  queue: {
    speakers: [],
    currentSpeaker: null,
  },
  timer: {
    time: TIMER_PRESETS.STANDARD,
    initialTime: TIMER_PRESETS.STANDARD,
    isRunning: false,
    isPaused: false,
  },
  currentYield: null,
  logs: [],
  sessionId: 'session_api_snapshot',
  startedAt: 0,
  stats: {
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
  },
};

let sessionState: SessionState = initialSessionState;

function successResponse(data: SessionState): NextResponse<SessionResponse> {
  return NextResponse.json({
    success: true,
    data,
    error: null,
  });
}

function errorResponse(message: string, status: number): NextResponse<SessionResponse> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status }
  );
}

function isValidMode(mode: unknown): mode is SessionMode {
  return mode === 'idle' || mode === 'speech' || mode === 'qa';
}

/**
 * GET /api/session - Return full in-memory session snapshot.
 */
export async function GET(): Promise<NextResponse<SessionResponse>> {
  return successResponse(sessionState);
}

/**
 * PUT /api/session - Partially update session configuration.
 * Supported fields: mode, timer.initialTime/time/isRunning/isPaused.
 */
export async function PUT(request: NextRequest): Promise<NextResponse<SessionResponse>> {
  try {
    const body = (await request.json()) as Partial<SessionState>;

    const nextState: SessionState = {
      ...sessionState,
      ...body,
      queue: body.queue
        ? {
            speakers: Array.isArray(body.queue.speakers) ? body.queue.speakers : sessionState.queue.speakers,
            currentSpeaker: body.queue.currentSpeaker ?? sessionState.queue.currentSpeaker,
          }
        : sessionState.queue,
      timer: body.timer
        ? {
            time: typeof body.timer.time === 'number' ? body.timer.time : sessionState.timer.time,
            initialTime:
              typeof body.timer.initialTime === 'number'
                ? body.timer.initialTime
                : sessionState.timer.initialTime,
            isRunning:
              typeof body.timer.isRunning === 'boolean'
                ? body.timer.isRunning
                : sessionState.timer.isRunning,
            isPaused:
              typeof body.timer.isPaused === 'boolean'
                ? body.timer.isPaused
                : sessionState.timer.isPaused,
          }
        : sessionState.timer,
      logs: Array.isArray(body.logs) ? body.logs : sessionState.logs,
      stats: body.stats
        ? {
            ...sessionState.stats,
            ...body.stats,
            yieldCount: {
              ...sessionState.stats.yieldCount,
              ...(body.stats.yieldCount ?? {}),
            },
          }
        : sessionState.stats,
    };

    if (body.mode !== undefined && !isValidMode(body.mode)) {
      return errorResponse('Invalid mode. Use "idle", "speech", or "qa".', 400);
    }

    if (nextState.timer.time < 0 || nextState.timer.time > 600) {
      return errorResponse('Invalid timer.time. Must be 0-600 seconds.', 400);
    }

    if (nextState.timer.initialTime <= 0 || nextState.timer.initialTime > 600) {
      return errorResponse('Invalid timer.initialTime. Must be 1-600 seconds.', 400);
    }

    sessionState = nextState;
    return successResponse(sessionState);
  } catch {
    return errorResponse('Failed to parse or apply session update.', 400);
  }
}
