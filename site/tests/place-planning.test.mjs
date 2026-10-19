import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlaceToDays } from '../dist/place-planning.js';
const trip = { id:'trip',placeId:'lisbon',name:'Lisbon',latitude:38.72,longitude:-9.13,timeZone:'Europe/Lisbon',startDate:'2026-10-20',endDate:'2026-10-24',items:[] };
const place = { placeId:'cafe',name:'Riverside café',latitude:38.71,longitude:-9.14,address:'Lisbon',primaryType:'cafe',rating:4.7,editorialSummary:'Provider text' };
test('one place can be added to several days without duplicate visits or provider content', () => {
  const next = addPlaceToDays(trip,place,['2026-10-20','2026-10-21','2026-10-20']);
  assert.equal(next.items.length,2); assert.notEqual(next.items[0].id,next.items[1].id);
  assert.equal(next.items[0].kind,'Food'); assert.equal(next.items[0].rating,undefined); assert.equal(next.items[0].editorialSummary,undefined);
  assert.equal(addPlaceToDays(next,place,['2026-10-20','2026-10-21']),next);
  assert.deepEqual(trip.items,[]);
});
test('a bad selection cannot partially add a place', () => {
  assert.throws(()=>addPlaceToDays(trip,place,[]),/Choose/);
  assert.throws(()=>addPlaceToDays(trip,place,['2026-10-20','2026-10-26']),/Choose/);
  assert.deepEqual(trip.items,[]);
});
test('a multi-day flight blocks the whole batch without losing or adding any visits', () => {
  const flying = {...trip,transport:[{id:'f',mode:'Flight',service_id:'AB12',departure_date:'2026-10-20',departure_time:'22:00',departure_time_zone:'Europe/Lisbon',arrival_date:'2026-10-22',arrival_time:'08:00',arrival_time_zone:'Europe/Lisbon'}]};
  assert.throws(()=>addPlaceToDays(flying,place,['2026-10-23','2026-10-21']),/flight/i);
  assert.deepEqual(flying.items,[]);
});
