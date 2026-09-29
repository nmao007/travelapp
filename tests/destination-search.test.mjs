import test from 'node:test';
import assert from 'node:assert/strict';
import { photonPlaces, DestinationSearch } from '../lib/destination-search.ts';
const feature = {geometry:{type:'Point',coordinates:[-9.14,38.72]},properties:{osm_type:'R',osm_id:123,name:'Lisbon',country:'Portugal',state:'Lisbon',type:'city'}};
const payload = {features:[feature]};
test('live suggestions validate geography and supplier identity, deduplicate, and build safe source URLs', () => {
 const places=photonPlaces({features:[feature,feature,{...feature,geometry:{type:'Point',coordinates:[200,90]}},{...feature,properties:{...feature.properties,osm_type:'https://bad.example'}},{...feature,properties:{...feature.properties,name:''}}]},'2026-09-27T00:00:00Z');
 assert.equal(places.length,1);assert.equal(places[0].id,'osm:relation:123');assert.equal(places[0].longitude,-9.14);assert.equal(places[0].latitude,38.72);assert.equal(places[0].sourceUrl,'https://www.openstreetmap.org/relation/123');assert.equal(places[0].country,'Portugal');
 assert.throws(() => photonPlaces({},''));
});
test('autocomplete coalesces requests, caches matches, and uses Photon rather than prohibited Nominatim autocomplete', async () => {
 let count=0;let request;
 const service=new DestinationSearch(undefined,async url => {count++;request=new URL(url);return new Response(JSON.stringify(payload));});
 const results=await Promise.all([service.search('Lis'),service.search('Lis')]);
 assert.equal(count,1);assert.deepEqual(results[0],results[1]);assert.equal(request.hostname,'photon.komoot.io');assert.deepEqual(request.searchParams.getAll('layer'),['city','state']);
 await service.search(' LIS ');assert.equal(count,1);
 await assert.rejects(service.search('Li'));await assert.rejects(service.search('a'.repeat(161)));
});
test('provider failure cannot become a fictional destination or leak raw supplier errors',async () => {
 const service=new DestinationSearch(undefined,async () => new Response('secret error detail',{status:403}));
 await assert.rejects(service.search('Lisbon'),error => error.status===502 && !error.message.includes('secret'));
 const broken=new DestinationSearch(undefined,async () => new Response('not JSON'));
 await assert.rejects(broken.search('Lisbon'));
 assert.throws(() => new DestinationSearch('http://example.com/api'));
});
test('different autocomplete queries are bounded and serialized; duplicate queries still share work',async () => {
 const times=[];
 const service=new DestinationSearch(undefined,async () => {times.push(Date.now());return new Response(JSON.stringify(payload));});
 await Promise.all([service.search('Lis'),service.search('Lisb')]);assert.ok(times[1]-times[0]>=950);
});
test('globe discovery uses reverse geocoding with real source records and rejects distant results',async () => {
 let request;
 const near={...feature,geometry:{type:'Point',coordinates:[-9.14,38.72]}};
 const far={...feature,geometry:{type:'Point',coordinates:[2.35,48.86]},properties:{...feature.properties,osm_id:456,name:'Paris'}};
 const service=new DestinationSearch(undefined,async url => {request=new URL(url);return new Response(JSON.stringify({features:[near,far]}));});
 const places=await service.nearby(38.72,-9.14);
 assert.equal(request.pathname,'/reverse');assert.equal(request.searchParams.get('lat'),'38.72');assert.equal(request.searchParams.get('lon'),'-9.14');assert.equal(request.searchParams.get('radius'),'150');assert.deepEqual(request.searchParams.getAll('layer'),['city']);
 assert.deepEqual(places.map(place => place.name),['Lisbon']);
 await assert.rejects(service.nearby(91,0),error => error.status===400);
 await assert.rejects(service.nearby(Number.NaN,0),error => error.status===400);
});
