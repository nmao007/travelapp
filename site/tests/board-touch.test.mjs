import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardTouch } from '../dist/board-touch.js';
function setup() {
  const timers=new Map(), events=[];let sequence=0;
  const touch=createBoardTouch({setTimer:(fn,delay)=>{assert.equal(delay,380);timers.set(++sequence,fn);return sequence;},clearTimer:id=>timers.delete(id),onPending:(g,value)=>events.push(['pending',g.id,value]),onHold:(g,p)=>events.push(['hold',g.id,p.x,p.y]),onPan:(g,p)=>events.push(['pan',g.id,p.x,p.y]),onTap:g=>events.push(['tap',g.id])});
  return{touch,events,timers,fire(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());}};
}
const point=(x=100,y=100,id=1)=>({x,y,id});
test('a short tap selects an idea without ever starting a drag',()=>{
  const p=setup();p.touch.start(point(),{id:'card'});p.touch.end(point());p.fire();
  assert.deepEqual(p.events,[['pending','card',true],['pending','card',false],['tap','card']]);
});
test('holding anywhere on a card activates movement once and tolerates normal finger jitter',()=>{
  const p=setup();p.touch.start(point(),{id:'card'});p.touch.move(point(105,106));p.fire();p.touch.move(point(140,150));p.touch.end(point(140,150));
  assert.equal(p.events.filter(event=>event[0]==='hold').length,1);
  assert.deepEqual(p.events.find(event=>event[0]==='hold'),['hold','card',105,106]);
  assert.equal(p.events.some(event=>event[0]==='tap'||event[0]==='pan'),false);
});
test('swiping a card pans instead of dragging it or opening its editor',()=>{
  const p=setup();p.touch.start(point(),{id:'card'});p.touch.move(point(100,80));p.fire();p.touch.end(point(100,60));
  assert.equal(p.events.filter(event=>event[0]==='pan').length,1);
  assert.equal(p.events.some(event=>event[0]==='hold'||event[0]==='tap'),false);
});
test('pinching, switching views, or cancelling a pointer invalidates delayed holds',()=>{
  for(const cancel of [p=>p.touch.cancel(),p=>p.touch.end(point(),true)]){
    const p=setup();p.touch.start(point(),{id:'card'});const stale=[...p.timers.values()][0];cancel(p);stale();p.fire();
    assert.equal(p.events.some(event=>event[0]==='hold'||event[0]==='tap'),false);
  }
});
test('an old timer cannot activate a newly pressed idea and unrelated pointers cannot end the hold',()=>{
  const p=setup();p.touch.start(point(),{id:'old'});const stale=[...p.timers.values()][0];p.touch.start(point(20,20,2),{id:'new'});stale();
  p.touch.move(point(200,200,1));p.touch.end(point(200,200,1));p.fire();
  assert.deepEqual(p.events.filter(event=>event[0]==='hold'),[['hold','new',20,20]]);
});
