/**
 * MUN Command Center - Queue API Route
 * Handles GSL (General Speakers' List) operations
 * 
 * Endpoints:
 * GET    /api/queue         - Get current queue state
 * POST   /api/queue         - Add delegate to queue
 * PUT    /api/queue         - Reorder queue / advance to next speaker
 * DELETE /api/queue         - Remove delegate from queue
 * 
 * CRITICAL: All state mutations are immutable to prevent race conditions
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  QueueState, 
  QueueResponse,
  Speaker,
  CurrentSpeaker,
  Delegate
} from '@/lib/types';
import { 
  generateDelegateId, 
  isValidCountry, 
  isValidDelegateName,
  reorderArray,
  updatePositions
} from '@/lib/utils';

// In-memory store (replace with database in production)
// Using immutable update patterns to prevent race conditions
let queueState: QueueState = {
  speakers: [],
  currentSpeaker: null,
};

// Helper functions for consistent responses
function successResponse(data: QueueState, status = 200): NextResponse<QueueResponse> {
  return NextResponse.json({
    success: true,
    data,
    error: null,
  }, { status });
}

function errorResponse(message: string, status: number): NextResponse<QueueResponse> {
  return NextResponse.json({
    success: false,
    data: null,
    error: message,
  }, { status });
}

/**
 * GET /api/queue - Retrieve current queue state
 */
export async function GET(): Promise<NextResponse<QueueResponse>> {
  return successResponse(queueState);
}

/**
 * POST /api/queue - Add a delegate to the queue
 * Body: { name: string, country: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse<QueueResponse>> {
  try {
    const body = await request.json();
    const {
      name,
      country,
      autoAssignIfIdle,
      allocatedTime,
    } = body as Omit<Delegate, 'id' | 'createdAt'> & {
      autoAssignIfIdle?: boolean;
      allocatedTime?: number;
    };

    // Validation
    if (!name || !isValidDelegateName(name)) {
      return errorResponse('Invalid delegate name. Must be 2-100 characters.', 400);
    }

    if (!country || !isValidCountry(country)) {
      return errorResponse('Invalid country name. Must be 2-100 characters.', 400);
    }

    // Check for duplicate country in queue (case-insensitive)
    const normalizedCountry = country.trim().toLowerCase();
    const isDuplicate = queueState.speakers.some(
      s => s.country.trim().toLowerCase() === normalizedCountry
    );

    if (isDuplicate) {
      return errorResponse(`${country} is already in the speakers list.`, 400);
    }

    // Also check current speaker
    if (queueState.currentSpeaker?.country.trim().toLowerCase() === normalizedCountry) {
      return errorResponse(`${country} is currently speaking.`, 400);
    }

    // Create new speaker
    const now = Date.now();
    const newSpeaker: Speaker = {
      id: generateDelegateId(),
      name: name.trim(),
      country: country.trim(),
      createdAt: now,
      addedAt: now,
      position: queueState.speakers.length + 1,
    };

    // Optional auto-assign when no active speaker.
    if (autoAssignIfIdle && queueState.currentSpeaker === null) {
      const time = typeof allocatedTime === 'number' ? allocatedTime : 90;
      if (!Number.isInteger(time) || time <= 0 || time > 600) {
        return errorResponse('Invalid allocated time. Must be 1-600 seconds.', 400);
      }

      queueState = {
        ...queueState,
        currentSpeaker: {
          ...newSpeaker,
          startedAt: Date.now(),
          allocatedTime: time,
        },
      };
    } else {
      queueState = {
        ...queueState,
        speakers: [...queueState.speakers, newSpeaker],
      };
    }

    return successResponse(queueState);

  } catch (error) {
    console.error('Queue POST error:', error);
    return errorResponse('Failed to add delegate to queue.', 500);
  }
}

/**
 * PUT /api/queue - Reorder queue or advance to next speaker
 * Body: { action: 'reorder' | 'move_bottom' | 'next' | 'yield_delegate' | 'clear' | 'end_speech', ...params }
 */
export async function PUT(request: NextRequest): Promise<NextResponse<QueueResponse>> {
  try {
    const body = await request.json();
    const { action, fromIndex, toIndex, allocatedTime, delegateId, id } = body;

    switch (action) {
      case 'reorder': {
        // Validate indices
        if (
          typeof fromIndex !== 'number' || 
          typeof toIndex !== 'number' ||
          !Number.isInteger(fromIndex) ||
          !Number.isInteger(toIndex) ||
          fromIndex < 0 || 
          toIndex < 0 ||
          fromIndex >= queueState.speakers.length ||
          toIndex >= queueState.speakers.length
        ) {
          return errorResponse('Invalid reorder indices.', 400);
        }

        // Immutable reorder and update positions
        const reorderedSpeakers = updatePositions(
          reorderArray([...queueState.speakers], fromIndex, toIndex)
        );

        queueState = {
          ...queueState,
          speakers: reorderedSpeakers,
        };

        return successResponse(queueState);
      }

      case 'move_bottom': {
        if (!id || typeof id !== 'string') {
          return errorResponse('Speaker ID is required for move_bottom.', 400);
        }

        const from = queueState.speakers.findIndex((speaker) => speaker.id === id);
        if (from === -1) {
          return errorResponse('Speaker not found in queue.', 404);
        }

        if (from === queueState.speakers.length - 1) {
          return successResponse(queueState);
        }

        const reorderedSpeakers = updatePositions(
          reorderArray([...queueState.speakers], from, queueState.speakers.length - 1)
        );

        queueState = {
          ...queueState,
          speakers: reorderedSpeakers,
        };

        return successResponse(queueState);
      }

      case 'next': {
        // Check if queue is empty
        if (queueState.speakers.length === 0) {
          return errorResponse('Queue is empty. No next speaker available.', 400);
        }

        // Don't advance if someone is already speaking
        if (queueState.currentSpeaker !== null) {
          return errorResponse('A speaker is already active. End their speech first.', 400);
        }

        // Validate allocated time
        const time = typeof allocatedTime === 'number' ? allocatedTime : 90;
        if (!Number.isInteger(time) || time <= 0 || time > 600) {
          return errorResponse('Invalid allocated time. Must be 1-600 seconds.', 400);
        }

        // Immutable: Move first speaker to current
        const [nextSpeaker, ...remainingSpeakers] = queueState.speakers;
        
        const currentSpeaker: CurrentSpeaker = {
          ...nextSpeaker,
          startedAt: Date.now(),
          allocatedTime: time,
        };

        queueState = {
          currentSpeaker,
          speakers: updatePositions(remainingSpeakers),
        };

        return successResponse(queueState);
      }

      case 'yield_delegate': {
        if (!queueState.currentSpeaker) {
          return errorResponse('No active speaker to yield from.', 400);
        }

        if (!delegateId || typeof delegateId !== 'string') {
          return errorResponse('Target delegate ID is required for yield delegation.', 400);
        }

        const targetIndex = queueState.speakers.findIndex((speaker) => speaker.id === delegateId);
        if (targetIndex === -1) {
          return errorResponse('Target delegate not found in queue.', 404);
        }

        const time = typeof allocatedTime === 'number' ? allocatedTime : 0;
        if (!Number.isInteger(time) || time <= 0 || time > 600) {
          return errorResponse('Invalid remaining time. Must be 1-600 seconds.', 400);
        }

        // Immutable update: Remove target from queue and make them current speaker
        const targetSpeaker = queueState.speakers[targetIndex];
        const newSpeakers = [
          ...queueState.speakers.slice(0, targetIndex),
          ...queueState.speakers.slice(targetIndex + 1)
        ];

        queueState = {
          currentSpeaker: {
            ...targetSpeaker,
            startedAt: Date.now(),
            allocatedTime: time,
          },
          speakers: updatePositions(newSpeakers),
        };

        return successResponse(queueState);
      }

      case 'clear': {
        // Immutable clear
        queueState = {
          speakers: [],
          currentSpeaker: null,
        };

        return successResponse(queueState);
      }

      case 'end_speech': {
        // Immutable: End current speech without advancing
        queueState = {
          ...queueState,
          currentSpeaker: null,
        };

        return successResponse(queueState);
      }

      default:
        return errorResponse(
          'Invalid action. Use "reorder", "move_bottom", "next", "yield_delegate", "clear", or "end_speech".',
          400
        );
    }

  } catch (error) {
    console.error('Queue PUT error:', error);
    return errorResponse('Failed to process queue action.', 500);
  }
}

/**
 * DELETE /api/queue - Remove a delegate from the queue
 * Query: ?id=<speaker_id>
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<QueueResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Speaker ID is required.', 400);
    }

    // Current speaker removal should auto-advance to next if available.
    if (queueState.currentSpeaker?.id === id) {
      if (queueState.speakers.length === 0) {
        queueState = {
          ...queueState,
          currentSpeaker: null,
        };
        return successResponse(queueState);
      }

      // Only parse allocatedTime when auto-advancing to next speaker
      const allocatedTimeParam = searchParams.get('allocatedTime');
      const allocatedTime = allocatedTimeParam ? Number(allocatedTimeParam) : 90;

      if (!Number.isInteger(allocatedTime) || allocatedTime <= 0 || allocatedTime > 600) {
        return errorResponse('Invalid allocatedTime query. Must be 1-600 seconds.', 400);
      }

      const [nextSpeaker, ...remaining] = queueState.speakers;
      queueState = {
        currentSpeaker: {
          ...nextSpeaker,
          startedAt: Date.now(),
          allocatedTime,
        },
        speakers: updatePositions(remaining),
      };

      return successResponse(queueState);
    }

    const speakerIndex = queueState.speakers.findIndex(s => s.id === id);

    if (speakerIndex === -1) {
      return errorResponse('Speaker not found in queue.', 404);
    }

    // Immutable remove and update positions
    const newSpeakers = [
      ...queueState.speakers.slice(0, speakerIndex),
      ...queueState.speakers.slice(speakerIndex + 1)
    ];

    queueState = {
      ...queueState,
      speakers: updatePositions(newSpeakers),
    };

    return successResponse(queueState);

  } catch (error) {
    console.error('Queue DELETE error:', error);
    return errorResponse('Failed to remove delegate from queue.', 500);
  }
}

