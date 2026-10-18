import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateBoardObjects, removeBoardObjects, sendIdeasToInbox, fittedBoardViewport, boardObjectBounds, editedBoardIdea, ideaWebURL, readBoardViewport, writeBoardViewport, withBoardChange, boardSnapshotData } from '../dist/board-model.js';

const data = () => [
  { id:'f',type:'group',placed:true,x:0,y:0,width:600,height:400,memberIds:['a','b'] },
  { id:'a',type:'card',title:'Lunch',placed:true,x:20,y:60,width:200,height:200,groupId:'f',groupOffset:{x:20,y:60} },
  { id:'b',type:'note',title:'Dinner',placed:true,x:260,y:60,width:200,height:200,groupId:'f',groupOffset:{x:260,y:60} },
];
test('duplicating a frame clones its contents and internal connections with fresh identities', () => {
  const items=data(), before=structuredClone(items);let sequence=0;
  const copy=duplicateBoardObjects(items,[{id:'link',from:'a',to:'b',label:'walk'}],['f'],()=>`new-${++sequence}`);
  assert.equal(copy.boardItems.length,6);assert.equal(copy.boardLinks.length,2);
  const frame=copy.boardItems.find(item=>item.id==='new-1');
  assert.deepEqual(frame.memberIds,['new-2','new-3']);
  assert.equal(copy.boardItems.find(item=>item.id==='new-2').groupId,frame.id);
  assert.equal(copy.boardItems.find(item=>item.id==='new-2').x,52);
  assert.equal(copy.boardLinks[1].from,'new-2');assert.equal(copy.boardLinks[1].to,'new-3');
  assert.deepEqual(items,before);
});
test('duplicating one framed idea does not silently attach it to the original frame',()=>{
  const copy=duplicateBoardObjects(data(),[],['a'],()=> 'copy');
  assert.equal(copy.boardItems.at(-1).groupId,undefined);assert.equal(copy.boardItems.at(-1).groupOffset,undefined);
  assert.deepEqual(copy.boardItems[0].memberIds,['a','b']);
});
test('deleting a frame keeps its ideas and prunes only removed endpoints',()=>{
  const source=data(),removed=removeBoardObjects(source,[{id:'ab',from:'a',to:'b'},{id:'fa',from:'f',to:'a'}],['f']);
  assert.deepEqual(removed.boardItems.map(item=>item.id),['a','b']);
  assert.equal(removed.boardItems[0].groupId,undefined);assert.equal(removed.boardItems[0].groupOffset,undefined);
  assert.deepEqual(removed.boardLinks.map(link=>link.id),['ab']);assert.equal(source[1].groupId,'f');
});
test('moving to inbox preserves content but removes placement and frame membership',()=>{
  const source=data(),moved=sendIdeasToInbox(source,['a']);
  assert.equal(moved[1].placed,false);assert.equal(moved[1].x,undefined);assert.equal(moved[1].title,'Lunch');
  assert.deepEqual(moved[0].memberIds,['b']);assert.equal(source[1].x,20);
});
test('fit includes negative coordinates and drawings, and persists the fitted zoom',()=>{
  const items=[{id:'a',type:'card',placed:true,x:-800,y:-400,width:200,height:200},{id:'d',type:'draw',placed:true,x:0,y:0,points:[{x:1000,y:100},{x:1100,y:400}]}];
  const viewport=fittedBoardViewport(items,{width:393,height:500});
  for(const item of items){const box=boardObjectBounds(item);assert.ok(box.x*viewport.scale+viewport.x>=23);assert.ok((box.x+box.width)*viewport.scale+viewport.x<=370);}
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  writeBoardViewport('trip',viewport,storage);assert.deepEqual(readBoardViewport('trip',storage),viewport);
});
test('idea editing keeps placement, rejects executable links, and accepts convenient website addresses',()=>{
  const source=data()[1];
  const edited=editedBoardIdea(source,{title:' Better lunch ',url:'example.com/menu',notes:' Book ahead ',color:'sky'});
  assert.equal(edited.title,'Better lunch');assert.equal(edited.notes,'Book ahead');assert.equal(edited.x,20);assert.equal(edited.groupId,'f');assert.equal(edited.url,'https://example.com/menu');
  for(const url of ['javascript:alert(1)','data:text/html,test','https://name:secret@example.com'])assert.throws(()=>ideaWebURL(url),/public/);
  assert.throws(()=>editedBoardIdea(source,{title:' '}),/title/);
  assert.throws(()=>editedBoardIdea(source,{title:'x',notes:'x'.repeat(2001)}),/Shorten/);
});
test('undoing a board snapshot is a newer revision and preserves unrelated trip plans',()=>{
  const trip={id:'trip',boardRevision:7,boardItems:data(),items:[{id:'plan',day:'2026-10-18'}]},before=boardSnapshotData(trip);
  const changed=withBoardChange(trip,removeBoardObjects(trip.boardItems,[],['a']));
  const restored=withBoardChange(changed,JSON.parse(before));
  assert.equal(restored.boardRevision,9);assert.equal(restored.boardItems.length,3);assert.deepEqual(restored.items,trip.items);
});
