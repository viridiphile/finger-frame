import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameMotion, frameFeatures } from '../src/frameMotion.js';
import { demoHands } from '../src/demo.js';
import { HandIdentityTracker, fingertipsFromHands } from '../src/handAssociation.js';
import { FrameStabilizer } from '../src/frameGeometry.js';

export function motionFrame({x=0,angle=0,scale=1,kind='quadrilateral'}={}) {
  const points=[[-100,-70,0,1],[100,-70,1,1],[100,70,1,0],[-100,70,0,0]];
  return {polygon:points.map(([px,py,hand,finger])=>({x:480+x+scale*(px*Math.cos(angle)-py*Math.sin(angle)),y:300+scale*(px*Math.sin(angle)+py*Math.cos(angle)),hand,finger})),
    opacity:1,state:'tracked',geometryState:'stable',kind};
}

test('still hands and tiny jitter stay below motion dead zones',()=>{
  const motion=new FrameMotion();
  for(let i=0;i<100;i++) motion.update(motionFrame({x:i%2?0.1:-0.1}),i*33.333);
  assert.equal(motion.values.intensity,0);
});

test('translation rates are time-normalized and increased speed increases bounded intensity',()=>{
  const sample=(rate,speed)=>{
    const motion=new FrameMotion();
    for(let i=0;i<=rate;i++) motion.update(motionFrame({x:speed*i/rate}),i*1000/rate);
    return {...motion.values};
  };
  const slow=sample(30,40),fast=sample(30,300),same=sample(60,300),extreme=sample(30,3000);
  assert.ok(fast.intensity>slow.intensity+0.3);
  assert.ok(Math.abs(fast.intensity-same.intensity)<0.03);
  assert.ok(extreme.intensity<=1);
});

test('angular unwrapping has no spike at the pi boundary',()=>{
  const motion=new FrameMotion();
  motion.update(motionFrame({angle:269*Math.PI/180}),0);
  const before=motion.values.angle;
  motion.update(motionFrame({angle:271*Math.PI/180}),50);
  assert.ok(Math.abs(motion.values.angle-before)<0.04);
  assert.ok(Math.abs(motion.values.angular)<1);
});

test('scale motion uses spread and bowtie cancellation cannot erase dimensions',()=>{
  const motion=new FrameMotion();
  motion.update(motionFrame({kind:'bowtie'}),0);
  motion.update(motionFrame({kind:'bowtie',scale:1.1}),100);
  assert.ok(motion.values.scale>0);
  const crossed=motionFrame(); [crossed.polygon[2].x,crossed.polygon[3].x]=[crossed.polygon[3].x,crossed.polygon[2].x];
  assert.ok(frameFeatures(crossed.polygon).spread>100);
});

test('tracking loss decays motion and resuming after a gap cannot cause a burst',()=>{
  const motion=new FrameMotion();
  for(let t=0;t<=500;t+=50) motion.update(motionFrame({x:t}),t);
  assert.ok(motion.values.intensity>0.3);
  for(let t=550;t<=1500;t+=50) motion.update({polygon:null,state:'searching'},t);
  assert.ok(motion.values.intensity<0.002);
  motion.update(motionFrame({x:1500}),1600);
  assert.equal(motion.values.intensity,0);
  assert.equal(motion.values.interrupted,true);
  assert.ok(Object.values(motion.update(motionFrame(),NaN)).filter((value)=>typeof value==='number').every(Number.isFinite));
});

test('the shared demo pose drives visible motion without changing by selected effect',()=>{
  const identities=new HandIdentityTracker(),geometry=new FrameStabilizer(),motion=new FrameMotion();
  let peak=0;
  for(let t=0;t<=32000;t+=33.333) {
    const hands=identities.update(demoHands(960,600,t),t,960,600);
    const frame=geometry.update(fingertipsFromHands(hands),t,960,600,{observedAt:Math.min(...hands.map((hand)=>hand.lastSeen))});
    peak=Math.max(peak,motion.update(frame,t).intensity);
  }
  assert.ok(peak>0.15 && peak<=1);
});
