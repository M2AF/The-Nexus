'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inputEvent}=require('../lib/native-overlay');
test('Native overlay maps centered and scaled game coordinates into the offscreen UI',()=>{
 assert.deepEqual(inputEvent([0x200,960,540,0,0],{width:1920,height:1080}),{type:'mouseMove',x:550,y:400,modifiers:[]});
 const click=inputEvent([0x201,480,320,0,3],{width:960,height:640});assert.equal(click.x,550);assert.equal(click.y,400);assert.equal(click.button,'left');assert.deepEqual(click.modifiers,['shift','control']);
});
test('Native keyboard conversion preserves navigation and text without inventing unsupported events',()=>{
 assert.equal(inputEvent([0x100,0,0,37,0],{width:1100,height:800}).keyCode,'Left');
 assert.equal(inputEvent([0x102,0,0,107,0],{width:1100,height:800}).keyCode,'k');
 assert.equal(inputEvent([0x101,0,0,65,0],{width:1100,height:800}).type,'keyUp');
 assert.equal(inputEvent([0x102,0,0,13,0],{width:1100,height:800}),null);
 assert.equal(inputEvent([0x999,0,0,0,0],{width:1100,height:800}),null);
});
