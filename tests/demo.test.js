import test from 'node:test';
import assert from 'node:assert/strict';
import { demoHands, demoFingertips, demoPhase } from '../src/demo.js';
import { HandIdentityTracker, fingertipsFromHands } from '../src/handAssociation.js';
import { FrameStabilizer, validateFrame } from '../src/frameGeometry.js';

test('demo includes normal, bowtie, interchange and reversed normal configurations', () => {
  for (const [time, kind] of [[2000, 'quadrilateral'], [10000, 'bowtie'], [17000, 'bowtie'], [24000, 'quadrilateral']]) {
    const result = validateFrame(demoFingertips(960,600,time),960,600);
    assert.equal(result.kind, kind, `${time}: ${result.reason}`);
  }
  const hands = demoHands(960,600,24000);
  assert.ok(hands[0].landmarks[0].x > hands[1].landmarks[0].x);
  assert.match(demoPhase(10000), /two filtered lobes/);
  assert.match(demoPhase(17000), /interchange/);
});

test('two full demo cycles keep identities and recover from brief degenerate transitions', () => {
  const identities = new HandIdentityTracker();
  const frame = new FrameStabilizer();
  let bowties = 0, normals = 0, missing = 0, longestMissing = 0;
  for (let time = 0; time <= 64000; time += 50) {
    const observations = demoHands(960,600,time);
    const hands = identities.update(time % 100 ? observations.reverse() : observations, time,960,600);
    const result = frame.update(fingertipsFromHands(hands),time,960,600,{observedAt:Math.min(...hands.map((hand) => hand.lastSeen))});
    assert.equal(hands[0].handedness,'Left');
    assert.equal(hands[1].handedness,'Right');
    if (result.kind === 'bowtie') bowties++;
    if (result.kind === 'quadrilateral') normals++;
    missing = result.polygon ? 0 : missing + 50;
    longestMissing = Math.max(longestMissing,missing);
  }
  assert.ok(bowties > 300);
  assert.ok(normals > 300);
  assert.ok(longestMissing < 600, `Demo frame missing for ${longestMissing}ms`);
});

test('the loop boundary is continuous for all landmarks', () => {
  const before = demoHands(960,600,31999), after = demoHands(960,600,32000);
  for(let id=0;id<2;id++) for(let i=0;i<21;i++) {
    assert.ok(Math.hypot(before[id].landmarks[i].x-after[id].landmarks[i].x,before[id].landmarks[i].y-after[id].landmarks[i].y)<1);
  }
});
