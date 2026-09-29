import test from 'node:test';
import assert from 'node:assert/strict';
import { tripFromDestination, calendarMonth } from '../lib/destination.ts';
import { find } from 'geo-tz/dist/find-all';
const city = { id:'osm:relation:5400890',name:'Lisbon',country:'Portugal',address:'Lisbon, Portugal',latitude:38.7078,longitude:-9.1366,category:'city',sourceUrl:'https://www.openstreetmap.org/relation/5400890',fetchedAt:'2026-09-27T00:00:00Z',zones:find(38.7078,-9.1366),zoneSource:'timezone-boundary-builder' };
test('selected geography supplies zone and identity, independent of device or city-name guessing', () => {
  const trip = tripFromDestination(city,'2026-11-04','2026-11-07');
  assert.equal(trip.zone,'Europe/Lisbon'); assert.equal(trip.title,'Lisbon');assert.deepEqual(trip.stops,['Lisbon, Portugal']);
  assert.deepEqual(JSON.parse(JSON.stringify(trip)).destinations,[city]);assert.equal(trip.entries.length,0);
  assert.equal(tripFromDestination({...city,name:'A localized city name'}).zone,'Europe/Lisbon');
});
test('flexible dates and ambiguous zones require actual selection; malformed geography is rejected', () => {
  assert.equal(tripFromDestination(city).start,'');
  assert.throws(() => tripFromDestination({...city,latitude:999}));
  assert.throws(() => tripFromDestination({...city,id:'unverified'}));
  assert.throws(() => tripFromDestination(city,'2026-11-07','2026-11-04'));
  assert.throws(() => tripFromDestination({...city,zones:['Asia/Shanghai','Asia/Urumqi']},'','',''));
  assert.equal(tripFromDestination({...city,zones:['Asia/Shanghai','Asia/Urumqi']},'','','Asia/Urumqi').zone,'Asia/Urumqi');
});
test('calendar handles Monday alignment, leap days and month transitions without local-zone shifts', () => {
  const leap = calendarMonth(2028,1);assert.equal(leap.filter(Boolean).length,29);assert.equal(leap[1],'2028-02-01');assert.equal(leap.at(-1),'2028-02-29');
  assert.equal(calendarMonth(2026,11).at(-1),'2026-12-31');assert.equal(calendarMonth(2026,12).find(Boolean),'2027-01-01');
});
