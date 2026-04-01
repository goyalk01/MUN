import { NextRequest, NextResponse } from 'next/server';
import { QueueResponse } from '@/lib/types';
import {
  addSpeaker,
  clearQueue,
  endCurrentSpeaker,
  getSessionSnapshot,
  moveSpeakerToBottom,
  nextSpeaker,
  promoteSpeakerToTop,
  removeSpeaker,
  reorderSpeakers,
  yieldToDelegate,
} from '@/lib/serverStore';
import { isValidCountry, isValidDelegateName } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function successResponse(status = 200): NextResponse<QueueResponse> {
  const snapshot = getSessionSnapshot();
  return NextResponse.json(
    {
      success: true,
      data: {
        speakers: snapshot.queue,
        currentSpeaker: snapshot.currentSpeaker,
      },
      error: null,
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

function errorResponse(message: string, status: number): NextResponse<QueueResponse> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(): Promise<NextResponse<QueueResponse>> {
  return successResponse();
}

export async function POST(request: NextRequest): Promise<NextResponse<QueueResponse>> {
  try {
    const body = (await request.json()) as {
      action?: 'add' | 'remove' | 'next' | 'moveBottom' | 'promoteTop';
      delegateId?: string;
      name?: string;
      country?: string;
      allocatedTime?: number;
      autoAssignIfIdle?: boolean;
    };

    // Legacy add payload compatibility (no action, with name/country)
    if (!body.action) {
      const name = body.name?.trim();
      const country = body.country?.trim();
      if (!name || !isValidDelegateName(name)) {
        return errorResponse('Invalid delegate name. Must be 2-100 characters.', 400);
      }
      if (!country || !isValidCountry(country)) {
        return errorResponse('Invalid country name. Must be 2-100 characters.', 400);
      }

      const snapshot = getSessionSnapshot();
      const normalizedCountry = country.toLowerCase();
      const duplicate =
        snapshot.queue.some((s) => s.country.trim().toLowerCase() === normalizedCountry) ||
        snapshot.currentSpeaker?.country.trim().toLowerCase() === normalizedCountry;

      if (duplicate) {
        return errorResponse(`${country} is already in the speakers list.`, 400);
      }

      const allocated = typeof body.allocatedTime === 'number' ? body.allocatedTime : 90;
      if (!Number.isInteger(allocated) || allocated <= 0 || allocated > 600) {
        return errorResponse('Invalid allocated time. Must be 1-600 seconds.', 400);
      }

      addSpeaker(name, country, Boolean(body.autoAssignIfIdle), allocated);
      return successResponse();
    }

    switch (body.action) {
      case 'add': {
        const name = body.name?.trim();
        const country = body.country?.trim();
        if (!name || !isValidDelegateName(name)) {
          return errorResponse('Invalid delegate name. Must be 2-100 characters.', 400);
        }
        if (!country || !isValidCountry(country)) {
          return errorResponse('Invalid country name. Must be 2-100 characters.', 400);
        }

        const snapshot = getSessionSnapshot();
        const normalizedCountry = country.toLowerCase();
        const duplicate =
          snapshot.queue.some((s) => s.country.trim().toLowerCase() === normalizedCountry) ||
          snapshot.currentSpeaker?.country.trim().toLowerCase() === normalizedCountry;

        if (duplicate) {
          return errorResponse(`${country} is already in the speakers list.`, 400);
        }

        const allocated = typeof body.allocatedTime === 'number' ? body.allocatedTime : 90;
        if (!Number.isInteger(allocated) || allocated <= 0 || allocated > 600) {
          return errorResponse('Invalid allocated time. Must be 1-600 seconds.', 400);
        }

        addSpeaker(name, country, Boolean(body.autoAssignIfIdle), allocated);
        return successResponse();
      }

      case 'remove': {
        if (!body.delegateId) {
          return errorResponse('delegateId is required for remove action.', 400);
        }
        const removed = removeSpeaker(body.delegateId);
        if (!removed) {
          return errorResponse('Delegate not found.', 400);
        }
        return successResponse();
      }

      case 'next': {
        const allocated = typeof body.allocatedTime === 'number' ? body.allocatedTime : 90;
        if (!Number.isInteger(allocated) || allocated <= 0 || allocated > 600) {
          return errorResponse('Invalid allocated time. Must be 1-600 seconds.', 400);
        }

        const advanced = nextSpeaker(allocated);
        if (!advanced) {
          return errorResponse('Unable to advance speaker. Check queue or active speaker state.', 400);
        }
        return successResponse();
      }

      case 'moveBottom': {
        if (!body.delegateId) {
          return errorResponse('delegateId is required for moveBottom action.', 400);
        }
        const moved = moveSpeakerToBottom(body.delegateId);
        if (!moved) {
          return errorResponse('Delegate not found in queue.', 400);
        }
        return successResponse();
      }

      case 'promoteTop': {
        if (!body.delegateId) {
          return errorResponse('delegateId is required for promoteTop action.', 400);
        }
        const moved = promoteSpeakerToTop(body.delegateId);
        if (!moved) {
          return errorResponse('Delegate not found in queue.', 400);
        }
        return successResponse();
      }

      default:
        return errorResponse('Invalid action.', 400);
    }
  } catch {
    return errorResponse('Invalid request body.', 400);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse<QueueResponse>> {
  try {
    const body = (await request.json()) as {
      action?: 'reorder' | 'move_bottom' | 'next' | 'yield_delegate' | 'clear' | 'end_speech' | 'promote_top';
      fromIndex?: number;
      toIndex?: number;
      allocatedTime?: number;
      delegateId?: string;
      id?: string;
    };

    switch (body.action) {
      case 'reorder': {
        if (
          typeof body.fromIndex !== 'number' ||
          typeof body.toIndex !== 'number' ||
          !Number.isInteger(body.fromIndex) ||
          !Number.isInteger(body.toIndex)
        ) {
          return errorResponse('Invalid reorder indices.', 400);
        }

        const reordered = reorderSpeakers(body.fromIndex, body.toIndex);
        if (!reordered) {
          return errorResponse('Invalid reorder indices.', 400);
        }
        return successResponse();
      }

      case 'move_bottom': {
        if (!body.id) {
          return errorResponse('id is required for move_bottom.', 400);
        }
        const moved = moveSpeakerToBottom(body.id);
        if (!moved) {
          return errorResponse('Delegate not found in queue.', 400);
        }
        return successResponse();
      }

      case 'promote_top': {
        if (!body.id) {
          return errorResponse('id is required for promote_top.', 400);
        }
        const moved = promoteSpeakerToTop(body.id);
        if (!moved) {
          return errorResponse('Delegate not found in queue.', 400);
        }
        return successResponse();
      }

      case 'next': {
        const allocated = typeof body.allocatedTime === 'number' ? body.allocatedTime : 90;
        if (!Number.isInteger(allocated) || allocated <= 0 || allocated > 600) {
          return errorResponse('Invalid allocated time. Must be 1-600 seconds.', 400);
        }

        const advanced = nextSpeaker(allocated);
        if (!advanced) {
          return errorResponse('Unable to advance speaker. Check queue or active speaker state.', 400);
        }
        return successResponse();
      }

      case 'yield_delegate': {
        if (!body.delegateId) {
          return errorResponse('delegateId is required for yield_delegate.', 400);
        }

        const allocated = typeof body.allocatedTime === 'number' ? body.allocatedTime : 0;
        if (!Number.isInteger(allocated) || allocated <= 0 || allocated > 600) {
          return errorResponse('Invalid remaining time. Must be 1-600 seconds.', 400);
        }

        const yielded = yieldToDelegate(body.delegateId, allocated);
        if (!yielded) {
          return errorResponse('Unable to yield to delegate.', 400);
        }
        return successResponse();
      }

      case 'clear': {
        clearQueue();
        return successResponse();
      }

      case 'end_speech': {
        endCurrentSpeaker();
        return successResponse();
      }

      default:
        return errorResponse('Invalid action.', 400);
    }
  } catch {
    return errorResponse('Invalid request body.', 400);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse<QueueResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const allocatedTimeParam = searchParams.get('allocatedTime');

    if (!id) {
      return errorResponse('Speaker ID is required.', 400);
    }

    const snapshot = getSessionSnapshot();
    const isCurrent = snapshot.currentSpeaker?.id === id;

    if (isCurrent) {
      endCurrentSpeaker();

      const allocatedTime = allocatedTimeParam ? Number(allocatedTimeParam) : 90;
      if (!Number.isInteger(allocatedTime) || allocatedTime <= 0 || allocatedTime > 600) {
        return errorResponse('Invalid allocatedTime query. Must be 1-600 seconds.', 400);
      }

      nextSpeaker(allocatedTime);
      return successResponse();
    }

    const removed = removeSpeaker(id);
    if (!removed) {
      return errorResponse('Speaker not found in queue.', 400);
    }

    return successResponse();
  } catch {
    return errorResponse('Failed to remove delegate from queue.', 500);
  }
}
