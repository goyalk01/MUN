import { NextRequest, NextResponse } from 'next/server';
import { YieldAction, YieldRequest, YieldResponse, YieldType } from '@/lib/types';
import { getSessionSnapshot, getYield, setYield } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_YIELD_TYPES: readonly YieldType[] = ['chair', 'delegate', 'questions'] as const;
const VALID_UPDATE_ACTIONS = ['accept', 'decline', 'complete'] as const;

function successResponse(data: YieldAction | null = null): NextResponse<YieldResponse> {
  return NextResponse.json({
    success: true,
    data,
    error: null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

function errorResponse(message: string, status: number): NextResponse<YieldResponse> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(): Promise<NextResponse<YieldResponse>> {
  return successResponse(getYield());
}

export async function POST(request: NextRequest): Promise<NextResponse<YieldResponse>> {
  try {
    const body = (await request.json()) as YieldRequest;

    if (!VALID_YIELD_TYPES.includes(body.type)) {
      return errorResponse('Invalid yield type. Must be "chair", "delegate", or "questions".', 400);
    }

    if (!body.fromSpeakerId || typeof body.fromSpeakerId !== 'string') {
      return errorResponse('fromSpeakerId is required.', 400);
    }

    if (typeof body.remainingTime !== 'number' || body.remainingTime < 0 || body.remainingTime > 600) {
      return errorResponse('remainingTime must be between 0 and 600.', 400);
    }

    const snapshot = getSessionSnapshot();
    const fromSpeaker = snapshot.currentSpeaker;

    if (!fromSpeaker || fromSpeaker.id !== body.fromSpeakerId) {
      return errorResponse('No active speaker matching fromSpeakerId.', 400);
    }

    let toDelegate = undefined;
    if (body.type === 'delegate') {
      if (!body.toDelegateId || typeof body.toDelegateId !== 'string') {
        return errorResponse('toDelegateId is required for delegate yield.', 400);
      }

      const target = snapshot.queue.find((speaker) => speaker.id === body.toDelegateId);
      if (!target) {
        return errorResponse('Invalid yield target delegate.', 400);
      }

      toDelegate = {
        id: target.id,
        name: target.name,
        country: target.country,
        createdAt: target.createdAt,
      };
    }

    const action: YieldAction = {
      type: body.type,
      fromSpeaker,
      toDelegate,
      remainingTime: body.remainingTime,
      timestamp: Date.now(),
    };

    setYield(action);
    return successResponse(action);
  } catch {
    return errorResponse('Invalid request body.', 400);
  }
}

export async function DELETE(): Promise<NextResponse<YieldResponse>> {
  setYield(null);
  return successResponse(null);
}

export async function PUT(request: NextRequest): Promise<NextResponse<YieldResponse>> {
  try {
    const body = (await request.json()) as { action?: 'accept' | 'decline' | 'complete' };

    if (!body.action || !VALID_UPDATE_ACTIONS.includes(body.action)) {
      return errorResponse('Invalid action. Use "accept", "decline", or "complete".', 400);
    }

    const current = getYield();
    if (!current) {
      return errorResponse('No active yield to update.', 400);
    }

    if (body.action === 'accept') {
      return successResponse(current);
    }

    if (body.action === 'decline') {
      setYield(null);
      return successResponse(null);
    }

    setYield(null);
    return successResponse(current);
  } catch {
    return errorResponse('Invalid request body.', 400);
  }
}
