import test from 'node:test';
import assert from 'node:assert/strict';
import { changeTripDates, offsetDate } from '../dist/trip-dates.js';

const trip = {
  id: 'trip', startDate: '2026-10-30', endDate: '2026-11-10', timeZone: 'America/Los_Angeles',
  stops: [{placeId:'la',date:'2026-10-30',endDate:'2026-11-03'},{placeId:'sd',date:'2026-11-04',endDate:'2026-11-10'}],
  items: [{id:'a',day:'2026-10-30',name:'Museum',time:'11:30',booked:true,reference:'TICKET',notes:'Bring pass'}, {id:'b',day:'2026-11-04',name:'Beach'}, {id:'idea',day:'ideas',name:'Maybe'}],
  transport:[{id:'flight',mode:'Flight',service_id:'BA 172',departure_date:'2026-10-29',departure_time:'22:00',departure_time_zone:'America/Los_Angeles',arrival_date:'2026-10-30',arrival_time:'03:00',arrival_time_zone:'America/Los_Angeles',flightData:{status:'Landed'},notes:'Seat 4A'}],
  dayOrder:{'2026-10-30':['transport:flight:arrival','plan:a'],'2026-11-04':['plan:b']}
};
// Include the overnight departure in the trip window.
trip.startDate='2026-10-29';

test('moving a trip preserves relative days, local times, bookings, stops and manual order', () => {
  const original = structuredClone(trip);
  const next = changeTripDates(trip,'2026-11-05','2026-11-17');
  assert.deepEqual(next.items.map(item=>item.day),['2026-11-06','2026-11-11','ideas']);
  assert.equal(next.items[0].time,'11:30'); assert.equal(next.items[0].reference,'TICKET'); assert.equal(next.items[0].notes,'Bring pass'); assert.equal(next.items[0].booked,true);
  assert.deepEqual(next.stops.map(stop=>[stop.date,stop.endDate]),[['2026-11-06','2026-11-10'],['2026-11-11','2026-11-17']]);
  assert.equal(next.transport[0].departure_date,'2026-11-05'); assert.equal(next.transport[0].arrival_date,'2026-11-06'); assert.equal(next.transport[0].arrival_time,'03:00'); assert.equal(next.transport[0].notes,'Seat 4A'); assert.equal(next.transport[0].flightData,undefined);
  assert.deepEqual(next.dayOrder['2026-11-06'],trip.dayOrder['2026-10-30']);
  assert.deepEqual(trip,original);
});

test('shifting earlier across a year and leap day uses calendar days rather than elapsed local hours', () => {
  assert.equal(offsetDate('2028-03-01',-1),'2028-02-29');
  assert.equal(offsetDate('2027-01-01',-2),'2026-12-30');
  const next=changeTripDates(trip,'2026-10-22','2026-11-03');
  assert.equal(next.items[0].day,'2026-10-23');
});

test('keeping existing dates and shortening a trip never flatten, hide or remove plans', () => {
  const next=changeTripDates(trip,'2026-10-25','2026-11-12',{movePlans:false});
  assert.deepEqual(next.items,trip.items); assert.deepEqual(next.transport,trip.transport); assert.deepEqual(next.dayOrder,trip.dayOrder);
  assert.throws(()=>changeTripDates(trip,'2026-11-05','2026-11-08'),/wide enough/);
  assert.throws(()=>changeTripDates(trip,'2026-11-05','2026-11-17',{movePlans:false}),/Nothing has been changed/);
});

test('a shift through a nonexistent daylight-saving time is rejected without losing the booking', () => {
  const spring={startDate:'2027-03-13',endDate:'2027-03-13',items:[{id:'a',name:'Early booking',day:'2027-03-13',time:'02:30',timeZone:'America/Los_Angeles',booked:true}]};
  assert.throws(()=>changeTripDates(spring,'2027-03-14','2027-03-14'),/clocks change/);
  assert.equal(spring.items[0].day,'2027-03-13');
});
