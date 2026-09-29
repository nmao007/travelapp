import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlaces, placeQuery, PlaceSearchService } from '../lib/place-service.ts';
const record = { osm_type:'way',osm_id:123,name:'Museum',display_name:'Museum, Test City',lat:'35.5',lon:'139.5',type:'museum' };
test('destination searches use city filtering and share the application queue without reusing general place results', async () => {
  const calls = [];
  const service = new PlaceSearchService(undefined,async url => {calls.push(new URL(url));return new Response(JSON.stringify([record]));});
  await service.search('Lisbon','');await service.search('Lisbon','','destination');
  assert.equal(calls.length,2);assert.equal(calls[0].searchParams.has('featureType'),false);
  assert.equal(calls[1].searchParams.get('featureType'),'city');assert.equal(calls[1].searchParams.get('addressdetails'),'1');
  await service.search('Lisbon','','destination');assert.equal(calls.length,2);
});
test('provider data is validated and source links cannot inject arbitrary URLs', () => {
  const places = normalizePlaces([record,record,{...record,osm_type:'https://bad.example'},{...record,osm_id:999,lat:'999'},{...record,osm_id:998,lon:''}], '2026-09-27T00:00:00Z');
  assert.equal(places.length,1);assert.equal(places[0].id,'osm:way:123');assert.equal(places[0].sourceUrl,'https://www.openstreetmap.org/way/123');assert.equal(places[0].latitude,35.5);
  assert.throws(() => normalizePlaces({},''));
});
test('search terms are bounded and combined with the selected destination', () => {
  assert.equal(placeQuery('  museum  ','Tokyo, Japan'),'museum, Tokyo, Japan');
  assert.equal(placeQuery('museum, Tokyo, Japan','Tokyo, Japan'),'museum, Tokyo, Japan');
  for(const q of ['','a','x'.repeat(161),'museum\u0000']) assert.throws(() => placeQuery(q,'Tokyo'));
});
test('identical concurrent queries share one request and repeat searches use the cache', async () => {
  let calls = 0;
  const fetcher = async (url, options) => { calls++;assert.equal(url.searchParams.get('limit'),'8');assert.match(options.headers['User-Agent'],/TripPilot/);return new Response(JSON.stringify([record]),{status:200}); };
  const service = new PlaceSearchService(undefined,fetcher);
  const [a,b] = await Promise.all([service.search('Museum','Tokyo'),service.search('museum','Tokyo')]);
  assert.deepEqual(a,b);await service.search('Museum','Tokyo');assert.equal(calls,1);
});
test('provider failures return an error without fabricated fallback results', async () => {
  const service = new PlaceSearchService(undefined,async () => new Response('{}',{status:429}));
  await assert.rejects(service.search('Museum','Tokyo'),error => error.status === 429);
  const offline = new PlaceSearchService(undefined,async () => {throw new Error('offline');});
  await assert.rejects(offline.search('Museum','Tokyo'),error => error.status === 503);
  assert.throws(() => new PlaceSearchService('http://untrusted.example'));
});
test('different provider searches are serialized and spaced at least one second apart', async () => {
  const times = [];
  const service = new PlaceSearchService(undefined,async () => {times.push(Date.now());return new Response(JSON.stringify([record]),{status:200});});
  await Promise.all([service.search('Museum','Tokyo'),service.search('Temple','Tokyo')]);
  assert.equal(times.length,2);assert.ok(times[1]-times[0]>=1000);
});
