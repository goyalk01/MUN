/**
 * MUN Command Center - Yield API Route
 * Handles yield protocol operations following MUN rules of procedure
 * 
 * Yield Types:
 * - Chair: Speaker yields remaining time back to the chair
 * - Delegate: Speaker yields remaining time to another delegate
 * - Questions: Speaker yields remaining time for Q&A
 * 
 * Endpoints:
 * POST /api/yield - Execute a yield action
 * GET  /api/yield - Get current yield status
 * DELETE /api/yield - Clear current yield
 * PUT /api/yield - Update yield (accept/decline/complete)
 * 
 * NOTE: This API uses shared state with queue API for speaker lookup
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  YieldType, 
  YieldAction, 
  YieldRequest,
  YieldResponse,
  Speaker
} from '@/lib/types';

// In-memory state; replace with persistence layer in production.
let currentYield: YieldAction | null = null;

const VALID_YIELD_TYPES: readonly YieldType[] = ['chair', 'delegate', 'questions'] as const;
const VALID_UPDATE_ACTIONS = ['accept', 'decline', 'complete'] as const;

// Helper to create consistent error response
function errorResponse(message: string, status: number): NextResponse<YieldResponse> {
  return NextResponse.json({
    success: false,
    data: null,
    error: message,
  }, { status });
}

// Helper to create consistent success response
function successResponse(data?: YieldAction): NextResponse<YieldResponse> {
  return NextResponse.json({
    success: true,
    data: data ?? null,
    error: null,
  });
}

/**
 * GET /api/yield - Get current yield status
 */
export async function GET(): Promise<NextResponse<YieldResponse>> {
  return successResponse(currentYield ?? undefined);
}

/**
 * POST /api/yield - Execute a yield action
 * Body: { type: YieldType, fromSpeakerId: string, toDelegateId?: string, remainingTime: number }
 */
export async function POST(request: NextRequest): Promise<NextResponse<YieldResponse>> {
  try {
    const body = await request.json() as YieldRequest;
    const { type, fromSpeakerId, toDelegateId, remainingTime } = body;

    // Validate yield type
    if (!type || !VALID_YIELD_TYPES.includes(type)) {
      return errorResponse(
        'Invalid yield type. Must be "chair", "delegate", or "questions".',
        400
      );
    }

    // Validate from speaker ID
    if (!fromSpeakerId || typeof fromSpeakerId !== 'string') {
      return errorResponse('From speaker ID is required and must be a string.', 400);
    }

    // Validate remaining time (0-600 seconds)
    if (typeof remainingTime !== 'number' || remainingTime < 0 || remainingTime > 600) {
      return errorResponse(
        'Valid remaining time is required (0-600 seconds).',
        400
      );
    }

    // For delegate yield, validate target delegate
    if (type === 'delegate') {
      if (!toDelegateId || typeof toDelegateId !== 'string') {
        return errorResponse(
          'Target delegate ID is required for delegate yield.',
          400
        );
      }
    }

    // Create speaker reference (client provides full data)
    // In production, this would fetch from database
    const fromSpeaker: Speaker = {
      id: fromSpeakerId,
      name: 'Speaker', // Will be enriched by client
      country: 'Country', // Will be enriched by client
      createdAt: Date.now(),
      addedAt: Date.now(),
      position: 0,
    };

    // Build yield action
    const yieldAction: YieldAction = {
      type,
      fromSpeaker,
      remainingTime,
      timestamp: Date.now(),
    };

    // Add target delegate for delegate yield
    if (type === 'delegate' && toDelegateId) {
      yieldAction.toDelegate = {
        id: toDelegateId,
        name: 'Target Delegate', // Will be enriched by client
        country: 'Target Country', // Will be enriched by client
        createdAt: Date.now(),
      };
    }

    // Store current yield (atomic operation)
    currentYield = yieldAction;

    return NextResponse.json({
      success: true,
      data: yieldAction,
      error: null,
    });

  } catch (error) {
    console.error('Yield POST error:', error);
    return errorResponse('Failed to process yield action.', 500);
  }
}

/**
 * DELETE /api/yield - Clear current yield
 */
export async function DELETE(): Promise<NextResponse<YieldResponse>> {
  currentYield = null;
  return successResponse();
}

/**
 * PUT /api/yield - Update yield (e.g., when delegate accepts yield)
 * Body: { action: 'accept' | 'decline' | 'complete' }
 */
export async function PUT(request: NextRequest): Promise<NextResponse<YieldResponse>> {
  try {
    const body = await request.json();
    const { action } = body;

    if (!currentYield) {
      return errorResponse('No active yield to update.', 400);
    }

    // Validate action
    if (!action || !VALID_UPDATE_ACTIONS.includes(action)) {
      return errorResponse(
        'Invalid action. Use "accept", "decline", or "complete".',
        400
      );
    }

    switch (action) {
      case 'accept':
        // Yield accepted - keep the yield active
        return successResponse(currentYield);

      case 'decline':
        // Yield declined - clear the yield
        currentYield = null;
        return successResponse();

      case 'complete': {
        // Yield completed - clear the yield and return it
        const completedYield = currentYield;
        currentYield = null;
        return successResponse(completedYield);
      }

      default:
        return errorResponse('Invalid action.', 400);
    }

  } catch (error) {
    console.error('Yield PUT error:', error);
    return errorResponse('Failed to update yield.', 500);
  }
}
