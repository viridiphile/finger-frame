import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHITE_LEVELS, GRAPHITE_MAPPING, GRAPHITE_DEFAULT_LEVELS, graphiteParameters, GraphiteControls } from '../src/graphiteControls.js';
import { createSketchBuffers, pencilSketchPixels } from '../src/effects.js';

function photoFixture() {
  const width = 64, height = 48, data = new Uint8ClampedArray(width * height * 4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const face = ((x-32)/20)**2 + ((y-24)/22)**2 < 1;
    const eye = y>=17 && y<=19 && ((x>=20 && x<=26)||(x>=38 && x<=44));
    const value = eye ? 35 : face ? 115 + x*1.2 : 210 + y*0.5;
    data.set([value,value*0.92,value*0.8,255],(y*width+x)*4);
  }
  return {width,height,data};
}

test('three independent controls have exactly five calibrated levels',()=>{
  assert.deepEqual(GRAPHITE_LEVELS,[0,25,50,75,100]);
  const controls = new GraphiteControls();
  assert.deepEqual(controls.levels,GRAPHITE_DEFAULT_LEVELS);
  const before={...controls.parameters};
  assert.equal(controls.set('sensitivity',0),true);
  assert.equal(controls.parameters.sensitivity,GRAPHITE_MAPPING.sensitivity[0]);
  assert.equal(controls.parameters.lineIntensity,before.lineIntensity);
  assert.equal(controls.parameters.shadingIntensity,before.shadingIntensity);
  assert.equal(controls.set('sensitivity',0),false);
  assert.throws(()=>controls.set('sensitivity',40),RangeError);
});

test('all 125 valid combinations stay opaque, detailed and nonblank',()=>{
  const buffers=createSketchBuffers(64,48);
  for(const sensitivity of GRAPHITE_LEVELS) for(const lineIntensity of GRAPHITE_LEVELS) for(const shadingIntensity of GRAPHITE_LEVELS) {
    const image=pencilSketchPixels(photoFixture(),buffers,graphiteParameters({sensitivity,lineIntensity,shadingIntensity}));
    let minimum=255,maximum=0,toned=0;
    for(let p=0;p<image.data.length;p+=4) {
      assert.equal(image.data[p],image.data[p+1]); assert.equal(image.data[p],image.data[p+2]); assert.equal(image.data[p+3],255);
      minimum=Math.min(minimum,image.data[p]); maximum=Math.max(maximum,image.data[p]);
      if(image.data[p]<250) toned++;
    }
    assert.ok(maximum-minimum>20,JSON.stringify({sensitivity,lineIntensity,shadingIntensity}));
    assert.ok(toned>400,'A normal photographic fixture must retain tone at every combination.');
  }
});

test('balanced defaults retain sharp dark eye contours',()=>{
  const image=pencilSketchPixels(photoFixture(),undefined,graphiteParameters(GRAPHITE_DEFAULT_LEVELS));
  const eyePixels=[];
  for(let y=16;y<=20;y++) for(let x=19;x<=27;x++) eyePixels.push(image.data[(y*64+x)*4]);
  assert.ok(Math.min(...eyePixels)<110);
});
