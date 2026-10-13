import test from 'node:test';
import assert from 'node:assert/strict';
import { glitchDisplacement, motionGlitchPixels, GLITCH_CONFIG } from '../src/motionGlitch.js';

function fixture() {
  const width=64,height=40,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) data.set([x*4,y*6,(x+y)*2,255],(y*width+x)*4);
  return {width,height,data};
}
const output=()=>({width:64,height:40,data:new Uint8ClampedArray(64*40*4)});

test('displacement is minimal at rest, bounded in motion, and opposite by anatomical lobe',()=>{
  const still=glitchDisplacement({intensity:0,angle:0});
  assert.equal(still.x,GLITCH_CONFIG.quietSeparation);
  const warm=glitchDisplacement({intensity:1,angle:0.7},1),cool=glitchDisplacement({intensity:1,angle:0.7},-1);
  assert.equal(warm.x,-cool.x); assert.equal(warm.y,-cool.y);
  assert.ok(Math.hypot(warm.x,warm.y)<=GLITCH_CONFIG.maxChannelOffset);
});

test('moving gestures alter more pixels than a calm frame without brightness flashes',()=>{
  const source=fixture(),calm=output(),moving=output();
  motionGlitchPixels(source,calm,{motion:{intensity:0,angle:0}});
  motionGlitchPixels(source,moving,{motion:{intensity:1,angle:0.5},timestamp:180});
  const difference=(image)=>image.data.reduce((sum,value,i)=>sum+(i%4===3?0:Math.abs(value-source.data[i])),0);
  assert.ok(difference(moving)>difference(calm)*4);
  for(let p=3;p<moving.data.length;p+=4) assert.equal(moving.data[p],255);
});

test('positive/negative lobe processing is deterministic and distinct',()=>{
  const source=fixture(),a=output(),b=output(),repeat=output();
  const options={motion:{intensity:0.8,angle:0.1},timestamp:270};
  motionGlitchPixels(source,a,{...options,sign:1}); motionGlitchPixels(source,b,{...options,sign:-1});
  motionGlitchPixels(source,repeat,{...options,sign:1});
  assert.deepEqual(a.data,repeat.data); assert.notDeepEqual(a.data,b.data);
});
