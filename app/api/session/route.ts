import { NextRequest, NextResponse } from 'next/server';
import { SessionMode } from '@/lib/types';
import { getSessionSnapshot, setMode } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SessionResponse {
  success: boolean;
  data: {
    queue: ReturnType<typeof getSessionSnapshot>['queue'];
    currentSpeaker: ReturnType<typeof getSessionSnapshot>['currentSpeaker'];
    logs: ReturnType<typeof getSessionSnapshot>['logs'];
    mode: ReturnType<typeof getSessionSnapshot>['mode'];
    currentYield: ReturnType<typeof getSessionSnapshot>['currentYield'];
    sessionId: string;
    startedAt: number;
    stats: ReturnType<typeof getSessionSnapshot>['stats'];
    updatedAt: number;
  } | null;
  error: string | null;
}

function successResponse(): NextResponse<SessionResponse> {
  const snapshot = getSessionSnapshot();
  return NextResponse.json(
    {
      success: true,
      data: {
        queue: snapshot.queue,
        currentSpeaker: snapshot.currentSpeaker,
        logs: snapshot.logs,
        mode: snapshot.mode,
        currentYield: snapshot.currentYield,
        sessionId: snapshot.sessionId,
        startedAt: snapshot.startedAt,
        stats: snapshot.stats,
        updatedAt: Date.now(),
      },
      error: null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

function errorResponse(message: string, status: number): NextResponse<SessionResponse> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

function isValidMode(mode: unknown): mode is SessionMode {
  return mode === 'idle' || mode === 'speech' || mode === 'qa';
}

export async function GET(): Promise<NextResponse<SessionResponse>> {
  return successResponse();
}

export async function PUT(request: NextRequest): Promise<NextResponse<SessionResponse>> {
  try {
    const body = (await request.json()) as { mode?: SessionMode };

    if (body.mode !== undefined) {
      if (!isValidMode(body.mode)) {
        return errorResponse('Invalid mode. Use "idle", "speech", or "qa".', 400);
      }
      setMode(body.mode);
    }

    return successResponse();
  } catch {
    return errorResponse('Invalid request body.', 400);
  }
}
