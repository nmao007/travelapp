import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarStops, calendarStopOnDay } from '../dist/calendar-stops.js';
import { setStopDates, addStop } from '../dist/trip-store.js';
const la = {placeId:'la',name:'Los Angeles',latitude:34,longitude:-118,date:'2026-10-01',endDate:'2026-10-08'};
const sd = {placeId:'sd',name:'San Diego',latitude:32,longitude:-117,date:'2026-10-08',endDate:'2026-10-16'};
const trip = {id:'route',...la,startDate:'2026-10-01',endDate:'2026-10-16',stops:[la,sd],items:[]};
test('calendar ownership changes to the arriving stop on a shared travel day', () => {
  const entries = calendarStops(trip);
  assert.equal(calendarStopOnDay(trip,'2026-10-07',entries).stop.placeId,'la');
  assert.equal(calendarStopOnDay(trip,'2026-10-08',entries).stop.placeId,'sd');
  assert.notEqual(entries[0].color, entries[1].color);
  assert.equal(calendarStopOnDay(trip,'2026-10-17',entries),null);
});
test('editing a stop updates both calendar ranges and ownership without retaining old dates', () => {
  const next = setStopDates(trip,'sd','2026-10-09','2026-10-18',{extendTrip:true});
  assert.equal(calendarStopOnDay(next,'2026-10-08').stop.placeId,'la');
  assert.equal(calendarStopOnDay(next,'2026-10-09').stop.placeId,'sd');
  assert.equal(calendarStops(next)[1].end,'2026-10-18');
  assert.equal(next.endDate,'2026-10-18');
});
test('an undated new destination is editable but cannot claim existing calendar days', () => {
  const next = addStop(trip,{placeId:'sf',name:'San Francisco',latitude:37,longitude:-122});
  const entries = calendarStops(next);
  assert.equal(entries[2].start,null);
  assert.equal(calendarStopOnDay(next,'2026-10-10',entries).stop.placeId,'sd');
});
test('implicit ranges cross month boundaries and uncovered gaps stay unassigned', () => {
  const implicit = {...trip,startDate:'2026-10-30',endDate:'2026-11-04',stops:[{...la,date:null,endDate:null},{...sd,date:'2026-11-02',endDate:null}]};
  assert.equal(calendarStopOnDay(implicit,'2026-10-31').stop.placeId,'la');
  assert.equal(calendarStopOnDay(implicit,'2026-11-02').stop.placeId,'sd');
  const gap = {...trip,stops:[{...la,endDate:'2026-10-06'},{...sd,date:'2026-10-09'}]};
  assert.equal(calendarStopOnDay(gap,'2026-10-07'),null);
});
