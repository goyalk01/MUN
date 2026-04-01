import { describe, it, expect, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/queue/route';

function makeJsonRequest(body: unknown, url = 'http://localhost:3000/api/queue') {
  return {
    url,
    json: async () => body,
  } as unknown as NextRequest;
}

function makeUrlRequest(url: string) {
  return { url } as unknown as NextRequest;
}

describe('queue api route', () => {
  beforeEach(async () => {
    await PUT(makeJsonRequest({ action: 'clear' }));
  });

  it('auto-assigns first speaker when autoAssignIfIdle is true', async () => {
    const response = await POST(
      makeJsonRequest({
        name: 'Asha Rao',
        country: 'India',
        autoAssignIfIdle: true,
        allocatedTime: 90,
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data.currentSpeaker).toBeTruthy();
    expect(payload.data.currentSpeaker.country).toBe('India');
    expect(payload.data.currentSpeaker.allocatedTime).toBe(90);
    expect(payload.data.speakers).toHaveLength(0);
  });

  it('removing current speaker auto-advances to next speaker', async () => {
    await POST(
      makeJsonRequest({
        name: 'Lead Delegate',
        country: 'Brazil',
        autoAssignIfIdle: true,
        allocatedTime: 90,
      })
    );

    await POST(makeJsonRequest({ name: 'Next Delegate', country: 'Japan' }));

    const state = await GET();
    const statePayload = await state.json();
    const currentId = statePayload.data.currentSpeaker.id;

    const removeResponse = await DELETE(
      makeUrlRequest(`http://localhost:3000/api/queue?id=${currentId}&allocatedTime=60`)
    );

    expect(removeResponse.status).toBe(200);
    const payload = await removeResponse.json();

    expect(payload.success).toBe(true);
    expect(payload.data.currentSpeaker).toBeTruthy();
    expect(payload.data.currentSpeaker.country).toBe('Japan');
    expect(payload.data.currentSpeaker.allocatedTime).toBe(60);
  });

  it('moves delegate to bottom atomically', async () => {
    await POST(makeJsonRequest({ name: 'One', country: 'Country 1' }));
    await POST(makeJsonRequest({ name: 'Two', country: 'Country 2' }));
    await POST(makeJsonRequest({ name: 'Three', country: 'Country 3' }));

    const before = await GET();
    const beforePayload = await before.json();
    const idToMove = beforePayload.data.speakers[0].id;

    const move = await PUT(
      makeJsonRequest({ action: 'move_bottom', id: idToMove })
    );

    expect(move.status).toBe(200);
    const afterPayload = await move.json();

    expect(afterPayload.success).toBe(true);
    expect(afterPayload.data.speakers[2].id).toBe(idToMove);
    expect(afterPayload.data.speakers[2].position).toBe(3);
  });
});
