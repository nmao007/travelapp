import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, days, makeEntry, makeCost, upsertEntry, sampleTrip } from '../lib/planner.ts';
const base = { stops:'Lisbon, Portugal\nPorto, Portugal', start:'2026-10-01', end:'2026-10-04', currency:'EUR', zone:'Europe/Lisbon', travelers:'2' };
test('trip creation keeps undecided dates and multiple stops without invented bookings', () => {
  const flexible = createTrip({ ...base,start:'',end:'' },'flex');
  assert.deepEqual(flexible.stops,['Lisbon, Portugal','Porto, Portugal']);
  assert.deepEqual(days(flexible),[]);assert.deepEqual(flexible.entries,[]);
  assert.equal(flexible.budget,null);assert.equal(flexible.travelers,2);
  assert.ok(flexible.checks.some(c => c.group === 'Coming home'));
  assert.ok(flexible.checks.every(c => !c.done));
  const dated = createTrip(base,'dated');assert.equal(days(dated).length,4);
});
test('creation rejects partial, reversed and invalid dates and imprecise budgets', () => {
  for(const values of [{start:'2026-02-30'},{end:'2026-09-30'},{start:''},{zone:'bad/zone'},{travelers:'0'},{budget:'100.001'},{currency:'ZZZ'},{stops:'   '}]) assert.throws(() => createTrip({...base,...values},'invalid'));
  assert.equal(createTrip({...base,budget:'123.45'},'budget').budget,12345);
});
test('a reservation is a single plan record and editing it cannot create a duplicate', () => {
  const trip = createTrip(base,'trip');
  const flight = makeEntry(trip,{title:'Fly to Lisbon',date:trip.start,time:'12:00',kind:'Flight',booked:'on',reference:'TEST-ONLY'},'flight');
  const recorded = upsertEntry(trip,flight);
  const edited = upsertEntry(recorded,makeEntry(recorded,{...flight,title:'Updated flight',booked:'on'},'flight'));
  assert.equal(edited.entries.length,1);assert.equal(edited.entries[0].reference,'TEST-ONLY');assert.equal(edited.entries[0].booked,true);assert.equal(edited.entries[0].title,'Updated flight');assert.equal(trip.entries.length,0);
});
test('explicit day selection and unscheduled ideas survive validation; invalid times do not', () => {
  const trip = createTrip(base,'trip');
  assert.equal(makeEntry(trip,{title:'Museum',date:'2026-10-03'},'museum').date,'2026-10-03');
  assert.equal(makeEntry(trip,{title:'Maybe a walk'},'walk').date,'');
  assert.throws(() => makeEntry(trip,{title:'Outside',date:'2026-10-05'},'outside'));
  assert.throws(() => makeEntry(trip,{title:'No day',time:'12:00'},'bad'));
  const dst = createTrip({...base,start:'2026-03-08',end:'2026-03-09',zone:'America/New_York'},'dst');
  assert.throws(() => makeEntry(dst,{title:'Missing time',date:dst.start,time:'02:30'},'missing'),/does not exist/);
});
test('expenses retain exact currency units and reject invalid amounts', () => {
  const trip = createTrip(base,'trip');
  assert.equal(makeCost(trip,{title:'Train',date:trip.start,amount:'25.10'},'cost').amount,2510);
  for(const amount of ['-5','oops','2.999']) assert.throws(() => makeCost(trip,{title:'Train',date:trip.start,amount},'bad'));
  const sample = sampleTrip();assert.equal(sample.currency,'JPY');assert.throws(() => makeCost(sample,{title:'Fraction',date:sample.start,amount:'1.5'},'bad'));
});

test('the next plan item follows actual instants across destination zones', async () => {
  const { nextEntry } = await import('../lib/planner.ts');
  const trip = createTrip({...base,start:'2026-10-01',end:'2026-10-02'},'zones');
  trip.entries = [makeEntry(trip,{title:'London',date:'2026-10-01',time:'10:00',zone:'Europe/London'},'london'),makeEntry(trip,{title:'Tokyo',date:'2026-10-01',time:'17:00',zone:'Asia/Tokyo'},'tokyo')];
  assert.equal(nextEntry(trip,new Date('2026-10-01T07:00Z')).id,'tokyo');
  assert.equal(nextEntry(trip,new Date('2026-10-01T08:30Z')).id,'london');
  assert.equal(nextEntry(trip,new Date('2026-10-01T10:00Z')),undefined);
});
