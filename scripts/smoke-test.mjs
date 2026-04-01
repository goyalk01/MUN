/*
  Production smoke test for MUN Command Center APIs.
  Usage: node scripts/smoke-test.mjs [baseUrl]
*/

const baseUrl = process.argv[2] || 'http://localhost:3000';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { response, payload };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEnvelope(payload, label) {
  assert(payload && typeof payload === 'object', `${label}: payload missing`);
  assert(Object.prototype.hasOwnProperty.call(payload, 'success'), `${label}: missing success`);
  assert(Object.prototype.hasOwnProperty.call(payload, 'data'), `${label}: missing data`);
  assert(Object.prototype.hasOwnProperty.call(payload, 'error'), `${label}: missing error`);
}

async function run() {
  console.log(`Running smoke test against ${baseUrl}`);

  // Reset state
  {
    const q = await request('/api/queue', {
      method: 'PUT',
      body: JSON.stringify({ action: 'clear' }),
    });
    assert(q.response.status === 200, 'Queue clear failed');
    assertEnvelope(q.payload, 'queue clear');

    const l = await request('/api/logs', { method: 'DELETE' });
    assert(l.response.status === 200, 'Logs clear failed');
    assertEnvelope(l.payload, 'logs clear');

    const y = await request('/api/yield', { method: 'DELETE' });
    assert(y.response.status === 200, 'Yield clear failed');
    assertEnvelope(y.payload, 'yield clear');
  }

  // Add delegates
  const delegates = [
    ['Asha Rao', 'India'],
    ['Lucas Silva', 'Brazil'],
    ['Mika Tanaka', 'Japan'],
    ['Liam O\'Brien', 'Ireland'],
    ['Noah Kim', 'Korea'],
    ['Sara Ali', 'Egypt'],
    ['Ana Costa', 'Portugal'],
    ['Daniel Reed', 'Canada'],
  ];

  for (const [name, country] of delegates) {
    const result = await request('/api/queue', {
      method: 'POST',
      body: JSON.stringify({ name, country }),
    });
    assert(result.response.status === 200, `Failed to add ${country}`);
    assertEnvelope(result.payload, `add ${country}`);
    assert(result.payload.success === true, `add ${country} was not successful`);
  }

  // Duplicate guard
  {
    const dup = await request('/api/queue', {
      method: 'POST',
      body: JSON.stringify({ name: 'Duplicate', country: 'India' }),
    });
    assert(dup.response.status === 400 || dup.response.status === 409, 'Duplicate should fail');
    assertEnvelope(dup.payload, 'duplicate add');
    assert(dup.payload.success === false, 'Duplicate unexpectedly succeeded');
  }

  // Reorder and move-bottom stress
  for (let i = 0; i < 8; i += 1) {
    const snapshot = await request('/api/queue');
    assert(snapshot.response.status === 200, 'Queue snapshot failed');
    const speakers = snapshot.payload.data.speakers;
    if (speakers.length < 2) break;

    const reorder = await request('/api/queue', {
      method: 'PUT',
      body: JSON.stringify({ action: 'reorder', fromIndex: 0, toIndex: speakers.length - 1 }),
    });
    assert(reorder.response.status === 200, 'Reorder failed');

    const moveBottom = await request('/api/queue', {
      method: 'PUT',
      body: JSON.stringify({ action: 'move_bottom', id: speakers[0].id }),
    });
    assert(moveBottom.response.status === 200, 'Move-bottom failed');
  }

  // Start next speaker and run yield scenarios
  {
    const next = await request('/api/queue', {
      method: 'PUT',
      body: JSON.stringify({ action: 'next', allocatedTime: 90 }),
    });
    assert(next.response.status === 200, 'Failed to call next speaker');
    assert(next.payload.data.currentSpeaker, 'No current speaker after next');

    const queueSnapshot = await request('/api/queue');
    const target = queueSnapshot.payload.data.speakers[0];
    assert(target, 'No target delegate available for yield_delegate');

    const yieldDelegate = await request('/api/yield', {
      method: 'POST',
      body: JSON.stringify({
        type: 'delegate',
        fromSpeakerId: queueSnapshot.payload.data.currentSpeaker.id,
        toDelegateId: target.id,
        remainingTime: 45,
      }),
    });
    assert(yieldDelegate.response.status === 200, 'Yield delegate POST failed');
    assert(yieldDelegate.payload.success === true, 'Yield delegate payload failed');

    const handoff = await request('/api/queue', {
      method: 'PUT',
      body: JSON.stringify({ action: 'yield_delegate', delegateId: target.id, allocatedTime: 45 }),
    });
    assert(handoff.response.status === 200, 'Queue yield_delegate handoff failed');

    const yieldQuestions = await request('/api/yield', {
      method: 'POST',
      body: JSON.stringify({
        type: 'questions',
        fromSpeakerId: handoff.payload.data.currentSpeaker.id,
        remainingTime: 30,
      }),
    });
    assert(yieldQuestions.response.status === 200, 'Yield questions POST failed');

    const yieldChair = await request('/api/yield', {
      method: 'POST',
      body: JSON.stringify({
        type: 'chair',
        fromSpeakerId: handoff.payload.data.currentSpeaker.id,
        remainingTime: 20,
      }),
    });
    assert(yieldChair.response.status === 200, 'Yield chair POST failed');

    const end = await request('/api/queue', {
      method: 'PUT',
      body: JSON.stringify({ action: 'end_speech' }),
    });
    assert(end.response.status === 200, 'End speech failed');
  }

  // Log add/fetch validation
  {
    const addLog = await request('/api/logs', {
      method: 'POST',
      body: JSON.stringify({ type: 'session_start', message: 'Smoke run session start' }),
    });
    assert(addLog.response.status === 200, 'Log add failed');
    assertEnvelope(addLog.payload, 'log add');

    const getLogs = await request('/api/logs?limit=20');
    assert(getLogs.response.status === 200, 'Log fetch failed');
    assertEnvelope(getLogs.payload, 'log fetch');
    assert(Array.isArray(getLogs.payload.data), 'Log data is not an array');
  }

  // Final queue sanity
  {
    const finalState = await request('/api/queue');
    assert(finalState.response.status === 200, 'Final queue read failed');
    assertEnvelope(finalState.payload, 'final queue');
  }

  console.log('Smoke test passed. API and state transitions are stable.');
}

run().catch((error) => {
  console.error('Smoke test failed:', error.message);
  process.exitCode = 1;
});
