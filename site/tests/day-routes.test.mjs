import test from 'node:test';
import assert from 'node:assert/strict';
import { dayRouteLegs, decodePolyline, routeKey, travelConflict, travelLabel } from '../dist/day-route-model.js';
import { createRouteService } from '../route-service.mjs';
const day='2026-10-30', item=(id,latitude=38.7)=>({id,name:id,day,latitude,longitude:-9.1,kind:'Activity'}),trip=items=>({id:'test',timeZone:'UTC',items,transport:[]});
const input={mode:'WALK',origin:{latitude:38.7,longitude:-9.1},destination:{latitude:38.71,longitude:-9.11}};
const route={duration:'600s',distanceMeters:850,polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'},legs:[{steps:[{navigationInstruction:{instructions:'Turn right'},travelMode:'WALK',distanceMeters:200}]}]};
const response=data=>({ok:true,status:200,json:async()=>data});
test('routes follow itinerary order and stop at unmapped events and flights',()=>{
  const data=trip([item('a'),item('b',38.71),{id:'dinner',name:'Dinner',day},item('c',38.72),item('d',38.73)]);
  assert.deepEqual(dayRouteLegs(data,day).map(leg=>leg.key),['a:b','c:d']);
  assert.deepEqual(dayRouteLegs(trip([item('a'),{...item('b',38.71),kind:'Flight'},item('c',38.72)]),day),[]);
  assert.equal(dayRouteLegs(trip([item('a'),{...item('b',38.71),day:'2026-10-31'}]),day).length,0);
});
test('co-located plans are skipped and fixed bookings stay untouched',()=>{
  const data=trip([{...item('a'),booked:true},item('b'),item('c',38.72)]),before=structuredClone(data);
  assert.deepEqual(dayRouteLegs(data,day).map(leg=>leg.key),['b:c']);assert.deepEqual(data,before);
});
test('geometry decoding, travel labels and time-zone conflict checks',()=>{
  assert.deepEqual(decodePolyline(route.polyline.encodedPolyline),[{lat:38.5,lng:-120.2},{lat:40.7,lng:-120.95},{lat:43.252,lng:-126.453}]);assert.throws(()=>decodePolyline('_'));assert.throws(()=>decodePolyline('\n'));
  assert.equal(travelLabel(4500,1234),'1 hr 15 min · 1.2 km');
  const leg={from:{...item('a'),time:'10:00',timeZone:'Europe/Lisbon'},to:{...item('b',38.71),time:'10:10',timeZone:'Europe/Lisbon'}};
  assert.equal(travelConflict(leg,1200,trip([])),true);assert.equal(travelConflict(leg,300,trip([])),false);
});
test('walking requests coalesce, cache and normalize Google steps',async()=>{
  let count=0,clock=0;const lookup=createRouteService({now:()=>clock,request:async(url,options)=>{count++;const body=JSON.parse(options.body);assert.equal(body.travelMode,'WALK');assert.equal(body.routingPreference,undefined);assert.deepEqual(body.origin.location.latLng,input.origin);assert.equal(options.headers['X-Goog-Api-Key'],'test');return response({routes:[route]});}});
  const [a,b]=await Promise.all([lookup(input,'test'),lookup(input,'test')]);assert.deepEqual(a,b);assert.equal(count,1);assert.equal(a.seconds,600);assert.equal(a.steps[0].instruction,'Turn right');clock=600001;await lookup(input,'test');assert.equal(count,2);
});
test('driving uses traffic and transit preserves line and stop information',async()=>{
  const lookup=createRouteService({now:()=>0,request:async(url,options)=>{const body=JSON.parse(options.body);if(body.travelMode==='DRIVE')assert.equal(body.routingPreference,'TRAFFIC_AWARE');else{assert.equal(body.departureTime,'1970-01-01T00:00:00.000Z');assert.equal(body.routingPreference,undefined);}return response({routes:[{...route,legs:[{steps:[{travelMode:'TRANSIT',transitDetails:{transitLine:{nameShort:'28E'},stopDetails:{departureStop:{name:'A'},arrivalStop:{name:'B'}}}}]}]}]});}});
  await lookup({...input,mode:'DRIVE'},'test');const result=await lookup({...input,mode:'TRANSIT'},'test');assert.equal(result.steps[0].line,'28E');assert.equal(result.steps[0].arrivalStop,'B');
});
test('invalid, empty, incomplete and rejected routes never invent estimates',async()=>{
  const lookup=createRouteService({request:async()=>response({})});assert.equal((await lookup(input,'test')).available,false);await assert.rejects(lookup({...input,origin:{latitude:91,longitude:0}},'test'),/mapped places/);await assert.rejects(lookup(input,null),/not configured/);
  const broken=createRouteService({request:async()=>response({routes:[{...route,duration:undefined}]})});await assert.rejects(broken(input,'test'),/incomplete/);
  let calls=0;const rejected=createRouteService({request:async()=>{calls++;return {ok:false,status:403,json:async()=>({error:{message:'private provider error'}})};}});await assert.rejects(rejected(input,'test'),/Enable Google Routes/);await assert.rejects(rejected(input,'test'),/Enable Google Routes/);assert.equal(calls,2);
});
test('provider concurrency stays limited to three requests',async()=>{
  let active=0,max=0;const lookup=createRouteService({request:async()=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,10));active--;return response({routes:[route]});}});await Promise.all(Array.from({length:8},(_,index)=>lookup({...input,destination:{latitude:38.71+index*.001,longitude:-9.11}},'test')));assert.equal(max,3);
});

test('scheduled transportation separates routes and edits invalidate route identities',()=>{
  const a={...item('a'),time:'08:00'},b={...item('b',38.71),time:'12:00'};
  const data={...trip([a,b]),transport:[{id:'flight',mode:'Flight',service_id:'TEST1',departure_date:day,departure_time:'09:00',departure_time_zone:'UTC',arrival_date:day,arrival_time:'11:00',arrival_time_zone:'UTC'}]};
  assert.deepEqual(dayRouteLegs(data,day),[]);
  const legs=dayRouteLegs(trip([item('a'),item('b',38.71)]),day);
  const reversed=dayRouteLegs(trip([item('b',38.71),item('a')]),day);
  assert.notEqual(routeKey(legs[0],'WALK'),routeKey(reversed[0],'WALK'));
  assert.notEqual(routeKey(legs[0],'WALK'),routeKey(legs[0],'DRIVE'));
});
