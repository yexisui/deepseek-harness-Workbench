import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {artifactDestination,openPackageArtifact}=createRequire(import.meta.url)('../src/package-artifact-window.cjs');
const origin='http://127.0.0.1:3082/',root=origin+'api/capabilities/packages/artifact/30abebb3-95c8-494a-a3a5-ff52b7076f2a/';
test('only same-origin capability artifact destinations are handled',()=>{
 assert.equal(artifactDestination(origin,root+'view').download,false);
 assert.equal(artifactDestination(origin,root+'download.svg').download,true);
 for(const url of [root.replace(':3082',':9999')+'view',root+'view?token=x',origin+'api/capabilities/state',root.replace('127.0.0.1','example.com')+'view','javascript:alert(1)'])assert.equal(artifactDestination(origin,url),null);
});
test('viewer reuses authenticated session with sandbox and downloads through desktop',()=>{
 let opts,loaded,downloaded,openHandler,navigateHandler;
 const session={},parent={webContents:{getURL:()=>origin,session,downloadURL:u=>downloaded=u}};
 class Window {constructor(o){opts=o;this.webContents={setWindowOpenHandler:f=>openHandler=f,on:(_,f)=>navigateHandler=f}} async loadURL(u){loaded=u}}
 assert.equal(openPackageArtifact(parent,root+'view',Window),true);assert.equal(opts.webPreferences.session,session);assert.equal(opts.webPreferences.nodeIntegration,false);assert.equal(opts.webPreferences.sandbox,true);assert.equal(opts.webPreferences.preload,undefined);assert.equal(loaded,root+'view');assert.equal(openHandler().action,'deny');
 let denied=false;navigateHandler({preventDefault:()=>denied=true},'https://example.com');assert.equal(denied,true);
 openPackageArtifact(parent,root+'download.svg',Window);assert.equal(downloaded,root+'download.svg');
});
