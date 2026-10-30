import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { petLayout, createPetWindow } = require('../src/pet-window.cjs');

test('pet stays reachable at every screen edge and under scaled/negative-coordinate displays', () => {
  for (const zoom of [1, 1.25, 2]) for (const area of [{x:0,y:0,width:1920,height:1040},{x:-1280,y:100,width:1280,height:720},{x:0,y:0,width:480,height:360}]) {
    for (const point of [{x:-9999,y:-9999},{x:9999,y:9999},{x:320,y:220}]) {
      const result = petLayout(point, {width:160,height:180}, area, zoom), b=result.bounds;
      const x=b.x+b.width-result.display.right*zoom-160*zoom;
      const y=b.y+b.height-result.display.bottom*zoom-180*zoom;
      assert.ok(x>=area.x && y>=area.y);
      assert.ok(x+160*zoom<=area.x+area.width && y+180*zoom<=area.y+area.height);
      assert.ok(b.x>=area.x && b.y>=area.y && b.x+b.width<=area.x+area.width && b.y+b.height<=area.y+area.height);
    }
  }
});

test('native window restricts creation/navigation and restores parent throttling after close', () => {
  let cursor={x:100,y:100};
  const screen=Object.assign(new EventEmitter(),{getCursorScreenPoint:()=>cursor,getDisplayNearestPoint:()=>({workArea:{x:0,y:0,width:1920,height:1040}})});
  const throttles=[],sent=[];
  const main={isDestroyed:()=>false,webContents:{send:(...v)=>sent.push(v),setBackgroundThrottling:v=>throttles.push(v),getZoomFactor:()=>1},getContentBounds:()=>({x:0,y:0})};
  const c=createPetWindow({screen,mainWindow:()=>main,statePath:'Z:/nonexistent-test/pet.json'});
  assert.equal(c.options({url:'https://example.com',frameName:'workbench-desktop-pet'}),null);
  const options=c.options({url:'about:blank',frameName:'workbench-desktop-pet'}).overrideBrowserWindowOptions;
  assert.equal(options.transparent,true);assert.equal(options.alwaysOnTop,true);assert.equal(options.frame,false);assert.equal(options.webPreferences.nodeIntegration,false);
  let bounds={x:0,y:0,width:640,height:600},prevented=false,ignored=true;
  const wc=Object.assign(new EventEmitter(),{setWindowOpenHandler:fn=>assert.deepEqual(fn(),{action:'deny'})});
  const win=Object.assign(new EventEmitter(),{webContents:wc,isDestroyed:()=>false,setMenu(){},setAlwaysOnTop(){},setIgnoreMouseEvents:v=>ignored=v,setBounds:b=>bounds=b,getBounds:()=>bounds,close(){this.emit('closed')},showInactive(){}});
  c.adopt(win);
  assert.equal(c.options({url:'about:blank',frameName:'workbench-desktop-pet'}),null);
  wc.emit('will-navigate',{preventDefault:()=>prevented=true});assert.equal(prevented,true);
  assert.throws(()=>c.command('place',{width:NaN,height:160}));
  c.command('place',{width:160,height:160,cursor:true});
  assert.ok(sent.some(([name])=>name==='desktop:pet-layout'));
  c.command('hit-regions',[{x:20,y:20,width:160,height:160}]);assert.equal(ignored,false);
  cursor={x:900,y:700};c.command('hit-regions',[]);assert.equal(ignored,true);
  c.command('drag-start',{x:80,y:80});assert.equal(ignored,false);
  assert.ok(bounds.x>0 && bounds.y>0);
  c.command('drag-end');assert.equal(ignored,true);
  cursor={x:500,y:400};c.command('place',{width:160,height:160,cursor:true});
  const layouts=sent.filter(([name])=>name==='desktop:pet-layout').length;
  cursor={x:540,y:420};c.command('place',{width:160,height:160,cursor:true});
  assert.equal(sent.filter(([name])=>name==='desktop:pet-layout').length,layouts,'moving a native window with unchanged local geometry must not rerender React');
  c.close();assert.deepEqual(throttles,[false,true]);
  assert.equal(sent.at(-1)[0],'desktop:pet-closed');
});
