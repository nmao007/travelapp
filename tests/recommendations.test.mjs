import test from 'node:test';
import assert from 'node:assert/strict';
import { dayForArea, nearbyPicks } from '../lib/recommendations.ts';

test('nearby picks exclude saved places and favor diverse places by an actual day anchor', () => {
  const center={latitude:38.7078,longitude:-9.1366};
  const place=(id,category,latitude)=>({id,name:id,category,latitude,longitude:center.longitude,distanceKm:0,address:'',sourceUrl:'https://www.openstreetmap.org/node/1',fetchedAt:''});
  const trip={entries:[{date:'2026-10-11',place:place('saved','Culture',38.708),id:'entry'}]};
  const picks=nearbyPicks([place('saved','Culture',38.708),place('a','Food',38.7081),place('b','Food',38.7082),place('c','Nature',38.7083)],trip,'2026-10-11',center);
  assert.deepEqual(picks.map(pick=>pick.place.id),['a','c','b']);
  assert.equal(picks[0].reason,'Near your day plan');
  assert.equal(picks.length,3);
});

test('multi-city discovery does not silently attach a new city to the first day',()=>{
  const lisbon={id:'lisbon',latitude:38.7,longitude:-9.1};
  const madrid={id:'madrid',latitude:40.4,longitude:-3.7};
  const trip={destinations:[lisbon,madrid],entries:[]};
  assert.equal(dayForArea(trip,'2026-10-10',lisbon),'2026-10-10');
  assert.equal(dayForArea(trip,'2026-10-10',madrid),'');
  trip.entries=[{date:'2026-10-11',place:{latitude:40.401,longitude:-3.7}}];
  assert.equal(dayForArea(trip,'2026-10-11',madrid),'2026-10-11');
  assert.equal(dayForArea(trip,'2026-10-11',lisbon),'');
});
