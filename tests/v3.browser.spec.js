import { test, expect } from '@playwright/test';

test('exactly three modes retain independent five-position Graphite choices and capture each effect', async ({ page }) => {
  const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('[data-effect]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Graphite settings', exact: true }).click();
  const names=['sensitivity','lineIntensity','shadingIntensity'];
  for(const name of names) {
    const slider=page.locator(`#${name}`);
    await expect(slider).toHaveAttribute('min','0'); await expect(slider).toHaveAttribute('max','100'); await expect(slider).toHaveAttribute('step','25');
    await expect(slider).toBeVisible();
    for(const value of [0,25,50,75,100]) { await slider.fill(String(value)); await expect(page.locator(`#${name}-value`)).toHaveText(`${value}%`); }
    await slider.fill('0'); await slider.press('ArrowRight'); await expect(slider).toHaveValue('25');
  }
  await page.locator('#sensitivity').fill('0');
  await page.locator('#lineIntensity').fill('25');
  await page.locator('#shadingIntensity').fill('100');
  for(const type of ['solarize','motion-glitch','graphite']) {
    await page.locator(`[data-effect="${type}"]`).click();
    await expect(page.locator(`[data-effect="${type}"]`)).toHaveAttribute('aria-pressed','true');
    if(type==='graphite') {
      await page.getByRole('button', { name: 'Graphite settings', exact: true }).click();
      await expect(page.locator('#sketch-adjustments')).toBeVisible();
    }
    else { await expect(page.locator('#sketch-adjustments')).toBeHidden(); await expect(page.locator('input[type="range"]:visible')).toHaveCount(0); }
    const download=page.waitForEvent('download'); await page.locator('#capture-btn').click();
    const file=await download; const stream=await file.createReadStream(); const chunks=[];
    for await(const chunk of stream) chunks.push(chunk);
    const png=Buffer.concat(chunks); expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(960); expect(png.readUInt32BE(20)).toBe(600);
    await page.screenshot({path:`test-results/v3-${type}.png`,fullPage:true});
  }
  for(const [name,value] of [['sensitivity','0'],['lineIntensity','25'],['shadingIntensity','100']]) await expect(page.locator(`#${name}`)).toHaveValue(value);
  await page.locator('label[for="effect-toggle"]').click();
  await page.locator('[data-effect="solarize"]').click();
  await expect(page.locator('#effect-toggle')).not.toBeChecked();
  await page.locator('label[for="effect-toggle"]').click(); await expect(page.locator('#effect-toggle')).toBeChecked();
  await page.setViewportSize({width:375,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(375);
  await expect(page.locator('[data-effect="motion-glitch"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('all effects preserve outside pixels, toggle cleanly and keep anatomical lobe treatment through interchange', async ({ page }) => {
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {Renderer}=await import('/src/renderer.js'); const {validateFrame}=await import('/src/frameGeometry.js');
    const canvas=document.createElement('canvas'),renderer=new Renderer(canvas); renderer.resize(200,200);
    const points=[{x:20,y:180,hand:0,finger:0},{x:20,y:20,hand:0,finger:1},{x:180,y:20,hand:1,finger:0},{x:180,y:180,hand:1,finger:1}];
    const pixel=(x,y)=>[...renderer.context.getImageData(x,y,1,1).data];
    const records=[];
    for(const reverse of [false,true]) {
      const frame={...validateFrame(points.map((p)=>({...p,x:reverse?200-p.x:p.x})),200,200),opacity:1,state:'tracked'};
      for(const type of ['graphite','solarize','motion-glitch']) {
        if(type==='motion-glitch') {
          const gradient=renderer.sourceContext.createLinearGradient(0,0,0,200);gradient.addColorStop(0,'rgb(0,80,0)');gradient.addColorStop(1,'rgb(200,80,200)');renderer.sourceContext.fillStyle=gradient;
        } else renderer.sourceContext.fillStyle='#4d4d4d';
        renderer.sourceContext.fillRect(0,0,200,200);
        const original=renderer.sourceContext.getImageData(0,0,200,200).data;
        renderer.effects.select(type);
        renderer.composite(frame,true,false,[],{motion:{intensity:1,angle:-Math.PI/2,interrupted:false},timestamp:270});
        const center=(id)=>{const region=frame.regions[frame.regionIds.indexOf(id)];return {x:Math.floor(region.reduce((sum,p)=>sum+p.x/3,0)),y:Math.floor(region.reduce((sum,p)=>sum+p.y/3,0))};};
        const a=center('A'),b=center('B');
        const record={type,reverse,a:pixel(a.x,a.y),b:pixel(b.x,b.y)};
        const outside=renderer.context.getImageData(10,10,1,1).data,p=(10*200+10)*4;
        record.outside=[...outside].every((value,i)=>value===original[p+i]);
        renderer.composite(frame,false,false);
        record.restored=renderer.context.getImageData(0,0,200,200).data.every((value,i)=>value===original[i]);
        records.push(record);
      }
    }
    // A vanishing A-lobe must leave B cool, rather than assigning warm to the
    // first remaining array entry. This is the important single-lobe case.
    const tiny=points.map((p)=>({...p})); tiny[0].y=100.1; tiny[1].y=99.9;
    const frame=validateFrame(tiny,200,200); renderer.effects.select('solarize');
    const layers=renderer.effects.process(renderer.source,{frame});
    return {records,remainingIds:frame.regionIds,remainingPalette:layers[0].regionIds};
  });
  for(const item of result.records) {
    expect(item.outside).toBe(true); expect(item.restored).toBe(true);
    if(item.type==='solarize') { expect(item.a[0]).toBeGreaterThan(item.a[2]); expect(item.b[2]).toBeGreaterThan(item.b[0]); }
    if(item.type==='motion-glitch') { expect(item.a[0]).toBeLessThan(item.b[0]); expect(item.a[2]).toBeGreaterThan(item.b[2]); }
  }
  expect(result.remainingIds).toEqual(['B']); expect(result.remainingPalette).toEqual(['B']);
});

test('foreground restoration and reusable byte buffers work in every effect',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {Renderer}=await import('/src/renderer.js'); const {EffectOutput}=await import('/src/effectSurface.js');
    const {EffectPipeline}=await import('/src/effectPipeline.js');
    const renderer=new Renderer(document.createElement('canvas'));renderer.resize(200,200);
    renderer.sourceContext.fillStyle='#c5825e';renderer.sourceContext.fillRect(0,0,200,200);
    const landmarks=[[100,158],[83,139],[69,123],[56,107],[46,98],[80,108],[76,86],[73,65],[72,46],[98,102],[98,77],[98,54],[98,35],[116,108],[119,86],[121,65],[122,48],[131,122],[139,108],[143,94],[146,80]].map(([x,y])=>({x,y}));
    const frame={polygon:[{x:20,y:20},{x:180,y:20},{x:180,y:180},{x:20,y:180}],opacity:1,state:'tracked'};
    const pixels=[];
    for(const type of ['graphite','solarize','motion-glitch']) {renderer.effects.select(type);renderer.composite(frame,true,false,[{landmarks,maskOpacity:1}],{motion:{intensity:0.8,angle:0},timestamp:100});pixels.push([...renderer.context.getImageData(100,130,1,1).data]);}
    const output=new EffectOutput();output.resize(20,20);const bytes=output.bytes;output.resize(19,18);
    const pipeline=new EffectPipeline();pipeline.glitch.startedAt=123;pipeline.select('motion-glitch');const reset=pipeline.glitch.startedAt===null;
    pipeline.glitch.startedAt=456;pipeline.select('graphite');
    return {pixels,reused:output.bytes===bytes,reset:reset&&pipeline.glitch.startedAt===null};
  });
  for(const pixel of result.pixels) expect(pixel).toEqual([197,130,94,255]);
  expect(result.reused).toBe(true);expect(result.reset).toBe(true);
});
