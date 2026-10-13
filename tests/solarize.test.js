import test from 'node:test';
import assert from 'node:assert/strict';
import { SOLAR_CONFIG, solarizedTone, paletteColor, solarizePixels } from '../src/solarize.js';

const image = (colors) => ({width:colors.length,height:1,data:new Uint8ClampedArray(colors.flatMap((color)=>[...color,255]))});
const output = (count) => ({width:count,height:1,data:new Uint8ClampedArray(count*4)});

test('solarization is continuous with a smooth threshold and reverses bright tones',()=>{
  const threshold=SOLAR_CONFIG.threshold;
  assert.ok(solarizedTone(0.2)<solarizedTone(0.4));
  assert.ok(solarizedTone(0.7)>solarizedTone(0.95));
  assert.ok(Math.abs(solarizedTone(threshold-0.000001)-solarizedTone(threshold+0.000001))<0.000001);
  assert.equal(solarizedTone(0),0);
});

test('continuous palette interpolation is deterministic and warmer/cooler at comparable luminance',()=>{
  const warm=paletteColor(0.42,'warm'), cool=paletteColor(0.42,'cool');
  assert.ok(warm[0]>warm[1]); assert.ok(cool[1]>cool[0]);
  const luminance=(rgb)=>rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  assert.ok(Math.abs(luminance(warm)-luminance(cool))<8);
  for(const name of ['balanced','warm','cool']) for(let t=0;t<=1;t+=0.01) {
    assert.deepEqual(paletteColor(t,name),paletteColor(t,name));
    assert.ok(paletteColor(t,name).every((value)=>value>=0 && value<=255));
  }
});

test('solarization shares luminance across outputs and is not RGB inversion',()=>{
  const source=image([[35,70,110],[120,85,55],[235,230,220]]);
  const balanced=output(3),warm=output(3),cool=output(3);
  solarizePixels(source,[{image:balanced,palette:'balanced'},{image:warm,palette:'warm'},{image:cool,palette:'cool'}]);
  assert.notDeepEqual(warm.data,cool.data);
  assert.notDeepEqual([...balanced.data].slice(0,3),[220,185,145]);
  const repeated=output(3); solarizePixels(source,[{image:repeated,palette:'balanced'}]);
  assert.deepEqual(repeated.data,balanced.data);
  for(const result of [balanced,warm,cool]) for(let p=3;p<result.data.length;p+=4) assert.equal(result.data[p],255);
});
