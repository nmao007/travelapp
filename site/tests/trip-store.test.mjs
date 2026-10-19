import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, readTrips, saveTrip, deleteTrip, addPlace, movePlace, removePlace, addStop, moveStop, reorderStops, removeStop, tripStops, stopSchedule, stopForDay, stopForPlan, datesForStop, setStopDates, tripTitle, renameTrip } from '../dist/trip-store.js';

function memory() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

const lisbon = { id: 'a', placeId: 'google-place-a', name: 'Lisbon', latitude: 38.7223, longitude: -9.1393, startDate: null, endDate: null };

test('a selected real place is saved and reopened without duplication', () => {
  const storage = memory();
  saveTrip(lisbon, storage);
  assert.deepEqual(readTrips(storage), [{ ...lisbon, stops: tripStops(lisbon), items: [], boardItems: [], boardLinks: [] }]);
  saveTrip({ ...lisbon, startDate: '2026-10-10', endDate: '2026-10-13' }, storage);
  assert.equal(readTrips(storage).length, 1);
  assert.equal(readTrips(storage)[0].startDate, '2026-10-10');
});

test('invalid or corrupt local records cannot become trips', () => {
  const storage = memory();
  assert.throws(() => saveTrip({ ...lisbon, latitude: Number.NaN }, storage));
  storage.setItem(STORAGE_KEY, '{broken');
  assert.deepEqual(readTrips(storage), []);
  storage.setItem(STORAGE_KEY, JSON.stringify([{ name: 'Imaginary' }, lisbon]));
  assert.deepEqual(readTrips(storage), [{ ...lisbon, stops: tripStops(lisbon), items: [], boardItems: [], boardLinks: [] }]);
});

test('a multi-stop route can be edited without losing its places', () => {
  const storage = memory();
  const porto = { placeId: 'google-place-porto', name: 'Porto', latitude: 41.1579, longitude: -8.6291, address: 'Porto, Portugal' };
  const withStop = addStop(lisbon, porto);
  assert.equal(tripStops(withStop).length, 2);
  assert.equal(addStop(withStop, porto), withStop);
  const reordered = moveStop(withStop, 1, -1);
  assert.equal(reordered.name, 'Porto');
  saveTrip(reordered, storage);
  assert.deepEqual(readTrips(storage)[0].stops.map(stop => stop.name), ['Porto', 'Lisbon']);
  assert.equal(removeStop(reordered, porto.placeId).name, 'Lisbon');
  assert.throws(() => removeStop(lisbon, lisbon.placeId));
});

test('a real place can move from saved ideas to a day and be removed', () => {
  const storage = memory();
  const place = { placeId: 'google-place-b', name: 'Belém Tower', latitude: 38.6916, longitude: -9.2160, day: 'ideas' };
  const withPlace = addPlace(lisbon, place);
  assert.equal(addPlace(withPlace, place).items.length, 1);
  const moved = movePlace(withPlace, withPlace.items[0].id, '2026-10-10');
  saveTrip(moved, storage);
  assert.equal(readTrips(storage)[0].items[0].day, '2026-10-10');
  saveTrip(removePlace(moved, moved.items[0].id), storage);
  assert.deepEqual(readTrips(storage)[0].items, []);
  deleteTrip(lisbon.id, storage);
  assert.deepEqual(readTrips(storage), []);
});

test('renaming a trip preserves destinations, plans and the title across route edits and reloads', () => {
  const storage = memory();
  const trip = { ...lisbon, items: [{ id: 'dinner', name: 'Dinner', day: '2026-10-10' }], transport: [{ id: 'flight' }] };
  const named = renameTrip(trip, '  Autumn escape  ');
  assert.equal(tripTitle(named), 'Autumn escape');
  assert.equal(named.name, 'Lisbon');
  assert.deepEqual(named.items, trip.items);
  assert.deepEqual(named.transport, trip.transport);
  const porto = { placeId: 'porto', name: 'Porto', latitude: 41.1, longitude: -8.6 };
  const reordered = moveStop(addStop(named, porto), 1, -1);
  saveTrip(reordered, storage);
  assert.equal(tripTitle(readTrips(storage)[0]), 'Autumn escape');
  assert.equal(readTrips(storage)[0].name, 'Porto');
  assert.equal(tripTitle(lisbon), 'Lisbon');
  assert.throws(() => renameTrip(trip, '   '));
  assert.throws(() => renameTrip(trip, 'x'.repeat(121)));
});

test('automatic trip names follow all stops and update after route changes', () => {
  const porto = { placeId: 'porto', name: 'Porto', latitude: 41.1, longitude: -8.6 };
  const routed = addStop(lisbon, porto);
  assert.equal(tripTitle(routed), 'Lisbon → Porto');
  assert.equal(tripTitle(moveStop(routed, 1, -1)), 'Porto → Lisbon');
  assert.equal(tripTitle(removeStop(routed, 'porto')), 'Lisbon');
});

test('a clicked map location can be named and saved when Google details are unavailable, without invented provider data', () => {
  const storage = memory(), trip = { ...lisbon, startDate: '2026-10-10', endDate: '2026-10-13', items: [] };
  const clicked = { placeId: 'google-clicked-place', latitude: 38.71, longitude: -9.13, day: '2026-10-10' };
  assert.throws(() => addPlace(trip, clicked), /Choose a place/);
  const next = addPlace(trip, { ...clicked, name: 'Place named by the traveler', kind: 'Activity' });
  saveTrip(next, storage);
  const reopened = readTrips(storage)[0].items[0];
  for (const [key, value] of Object.entries(clicked)) assert.equal(reopened[key], value);
  assert.equal(reopened.name, 'Place named by the traveler');
  assert.equal(reopened.rating, undefined); assert.equal(reopened.editorialSummary, undefined);
  assert.equal(addPlace(next, { ...clicked, name: reopened.name }), next);
});

const datedRoute = () => ({ ...lisbon, startDate: '2026-10-01', endDate: '2026-10-08',
  stops: [ { ...lisbon, date: '2026-10-01' }, { placeId: 'porto', name: 'Porto', latitude: 41.15, longitude: -8.63, date: '2026-10-04' } ],
  items: [{ id: 'dinner', name: 'Dinner', day: '2026-10-03', booked: true }],
  transport: [{ id: 'train', departure_date: '2026-10-04', arrival_date: '2026-10-04' }] });

test('legacy arrivals infer departure ranges and share the transfer day without duplicating trip days', () => {
  const trip = datedRoute(), schedule = stopSchedule(trip);
  assert.deepEqual(schedule.map(({start, end}) => [start, end]), [['2026-10-01', '2026-10-04'], ['2026-10-04', '2026-10-08']]);
  assert.equal(stopForDay(trip, '2026-10-03').name, 'Lisbon');
  assert.equal(stopForDay(trip, '2026-10-04').name, 'Porto');
  assert.ok(datesForStop(trip, lisbon.placeId).includes('2026-10-04'));
  assert.ok(datesForStop(trip, 'porto').includes('2026-10-04'));
});

test('stop dates survive saving and do not move bookings or transportation', () => {
  const trip = datedRoute(), next = setStopDates(trip, 'porto', '2026-10-05', '2026-10-08'), storage = memory();
  saveTrip(next, storage);
  assert.equal(readTrips(storage)[0].stops[1].endDate, '2026-10-08');
  assert.equal(next.items, trip.items); assert.equal(next.transport, trip.transport);
  assert.equal(stopForDay(next, '2026-10-04').name, 'Lisbon');
});

test('stop editing rejects reversed ranges, outside dates, and overlap across the route', () => {
  const trip = datedRoute();
  assert.throws(() => setStopDates(trip, 'porto', '2026-10-05', '2026-10-04'), /Departure/);
  assert.throws(() => setStopDates(trip, 'porto', '2026-10-04', '2026-10-09'), /within/);
  assert.throws(() => setStopDates(trip, lisbon.placeId, '2026-10-01', '2026-10-06'), /next stop/);
  const explicit = setStopDates(trip, lisbon.placeId, '2026-10-01', '2026-10-03');
  assert.throws(() => setStopDates(explicit, 'porto', '2026-10-02', '2026-10-08'), /previous stop/);
  assert.equal(stopForDay({...explicit, stops: [explicit.stops[0], {...explicit.stops[1], date: '2026-10-05'}]}, '2026-10-04'), null);
});

test('route reordering moves stay durations and plans while keeping booked transportation intact', () => {
  const trip = datedRoute(), next = moveStop(trip, 1, -1);
  assert.deepEqual(stopSchedule(next).map(entry => [entry.stop.name, entry.start, entry.end]), [['Porto', '2026-10-01', '2026-10-05'], ['Lisbon', '2026-10-05', '2026-10-08']]);
  assert.equal(next.items[0].day, '2026-10-07');
  assert.equal(next.items[0].booked, true); assert.deepEqual(next.transport, trip.transport);
  assert.equal(trip.items[0].day, '2026-10-03');
});

test('unscheduled added destinations do not take ownership of existing days', () => {
  const trip = addStop(datedRoute(), {placeId:'coimbra',name:'Coimbra',latitude:40.2,longitude:-8.4});
  assert.equal(stopSchedule(trip)[2].start, null);
  assert.deepEqual(datesForStop(trip, 'coimbra'), []);
  assert.equal(stopForDay(trip, '2026-10-07').name, 'Porto');
});


test('adding a later stay extends trip dates while preserving the first stay and bookings', () => {
  const original = { ...lisbon, startDate: '2026-10-01', endDate: '2026-10-04', items: datedRoute().items, transport: datedRoute().transport };
  const porto = { placeId: 'porto', name: 'Porto', latitude: 41.15, longitude: -8.63 };
  const extended = setStopDates(addStop(original, porto), 'porto', '2026-10-06', '2026-10-10', { extendTrip: true });
  assert.equal(extended.startDate, '2026-10-01'); assert.equal(extended.endDate, '2026-10-10');
  assert.deepEqual(stopSchedule(extended).map(({start, end}) => [start, end]), [['2026-10-01', '2026-10-04'], ['2026-10-06', '2026-10-10']]);
  assert.equal(stopForDay(extended, '2026-10-05'), null);
  assert.equal(extended.items, original.items); assert.equal(extended.transport, original.transport);
  const storage = memory(); saveTrip(extended, storage);
  assert.equal(readTrips(storage)[0].endDate, '2026-10-10');
});

test('stop edits can extend either end of a trip while retaining neighboring stays', () => {
  const trip = datedRoute();
  const earlier = setStopDates(trip, lisbon.placeId, '2026-09-29', '2026-10-04', { extendTrip: true });
  assert.equal(earlier.startDate, '2026-09-29');
  assert.equal(stopSchedule(earlier)[1].start, '2026-10-04');
  const later = setStopDates(earlier, 'porto', '2026-10-04', '2026-10-11', { extendTrip: true });
  assert.equal(later.endDate, '2026-10-11');
  assert.equal(stopSchedule(later)[0].end, '2026-10-04');
  assert.throws(() => setStopDates(trip, lisbon.placeId, '2026-09-29', '2026-10-05', { extendTrip: true }), /next stop/);
  assert.throws(() => setStopDates(trip, 'porto', '2026-09-29', '2026-10-10', { extendTrip: true }), /previous stop/);
});

test('stop dates establish an undated trip and reject invalid or excessive ranges', () => {
  const dated = setStopDates(lisbon, lisbon.placeId, '2026-12-30', '2027-01-03', { extendTrip: true });
  assert.equal(dated.startDate, '2026-12-30'); assert.equal(dated.endDate, '2027-01-03');
  assert.throws(() => setStopDates(dated, lisbon.placeId, '2027-01-05', '2027-01-04', { extendTrip: true }), /Departure/);
  assert.throws(() => setStopDates(dated, lisbon.placeId, '2027-02-30', '2027-03-01', { extendTrip: true }), /Choose arrival/);
  assert.throws(() => setStopDates(dated, lisbon.placeId, '2028-01-01', '2028-01-02', { extendTrip: true }), /one year/);
});


test('reordering unequal stays keeps activities, manual day order, gaps and ideas', () => {
  const trip = { ...lisbon, startDate:'2026-12-28', endDate:'2027-01-08', stops:[
    {...lisbon,date:'2026-12-28',endDate:'2026-12-30'},
    {placeId:'porto',name:'Porto',latitude:41,longitude:-8,date:'2027-01-01',endDate:'2027-01-04'},
    {placeId:'coimbra',name:'Coimbra',latitude:40,longitude:-8,date:'2027-01-05',endDate:'2027-01-08'}
  ],items:[{id:'a',name:'Dinner',day:'2026-12-29',time:'19:00',reference:'Ticket'}, {id:'b',name:'Museum',day:'2027-01-03'}, {id:'idea',name:'Someday',day:'ideas'}, {id:'gap',name:'Transit day',day:'2026-12-31'}],dayOrder:{'2026-12-29':['plan:a'],'2027-01-03':['plan:b'],'2026-12-31':['plan:gap']},transport:[{id:'booked',service_id:'AB 1',departure_date:'2026-12-28',arrival_date:'2026-12-28'}, {id:'old-draft',draft:true,leg:'transfer',fromPlaceId:lisbon.placeId,toPlaceId:'porto'}] };
  const next = reorderStops(trip, ['coimbra','porto',lisbon.placeId]);
  assert.deepEqual(stopSchedule(next).map(({start,end})=>[start,end]), [['2026-12-28','2026-12-31'],['2027-01-02','2027-01-05'],['2027-01-06','2027-01-08']]);
  assert.deepEqual(next.items.map(item=>item.day), ['2027-01-07','2027-01-04','ideas','2026-12-31']);
  assert.equal(next.items[0].reference,'Ticket');
  assert.deepEqual(next.dayOrder, {'2027-01-07':['plan:a'],'2027-01-04':['plan:b'],'2026-12-31':['plan:gap']});
  assert.deepEqual(next.transport,[trip.transport[0]]);
  const storage=memory();saveTrip(next,storage);assert.equal(readTrips(storage)[0].stops[0].name,'Coimbra');
  assert.equal(trip.items[0].day,'2026-12-29');
});

test('route changes are atomic when a moved plan overlaps a flight', () => {
  const trip={...datedRoute(),timeZone:'UTC',items:[{id:'x',name:'Museum',day:'2026-10-03',time:'12:00'}],transport:[{id:'flight',mode:'Flight',service_id:'AB 2',departure_date:'2026-10-07',departure_time:'10:00',departure_time_zone:'UTC',arrival_date:'2026-10-07',arrival_time:'15:00',arrival_time_zone:'UTC'}]};
  assert.throws(()=>reorderStops(trip,['porto',lisbon.placeId]), /overlaps flight/);
  assert.equal(trip.stops[0].name,'Lisbon');assert.equal(trip.items[0].day,'2026-10-03');
});

test('route order validates membership and does not guess dates for partially scheduled stops', () => {
  const trip=datedRoute();
  assert.throws(()=>reorderStops(trip,['porto','porto']), /each stop once/);
  assert.throws(()=>reorderStops(trip,['porto','unknown']), /each stop once/);
  assert.equal(reorderStops(trip,tripStops(trip).map(stop=>stop.placeId)),trip);
  const partial=addStop(trip,{placeId:'third',name:'Third',latitude:0,longitude:0});
  assert.throws(()=>reorderStops(partial,['third','porto',lisbon.placeId]),/Set dates/);
  assert.equal(moveStop(trip,9,-1),trip);
});


test('shared transfer days keep activity ownership through repeated route changes', () => {
  const trip={...datedRoute(),items:[{id:'last',name:'Porto dinner',day:'2026-10-08',time:'19:00'}, {id:'first',name:'Lisbon lunch',day:'2026-10-02'}]};
  const swapped=reorderStops(trip,['porto',lisbon.placeId]);
  assert.equal(swapped.items[0].day,'2026-10-05');
  assert.equal(stopForDay(swapped,'2026-10-05').placeId,lisbon.placeId);
  assert.equal(stopForPlan(swapped,swapped.items[0]).placeId,'porto');
  const restored=reorderStops(swapped,[lisbon.placeId,'porto']);
  assert.deepEqual(restored.items.map(item=>item.day),trip.items.map(item=>item.day));
  assert.equal(stopForPlan(restored,{...restored.items[0],day:'2026-10-02'}).placeId,lisbon.placeId);
});
