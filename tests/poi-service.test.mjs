import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePois,PoiService} from '../lib/poi-service.ts';

const latitude=38.7078,longitude=-9.1366;
const nearby={elements:[
  {type:'node',id:1,lat:38.708,lon:-9.137,tags:{name:'Viewpoint',tourism:'viewpoint'}},
  {type:'way',id:2,center:{lat:38.709,lon:-9.138},tags:{name:'Museum',tourism:'museum','addr:street':'Museum Street'}},
  {type:'node',id:3,lat:40,lon:-9.13,tags:{name:'Far away',tourism:'attraction'}},
  {type:'node',id:4,lat:38.708,lon:-9.137,tags:{tourism:'viewpoint'}},
  {type:'node',id:1,lat:38.708,lon:-9.137,tags:{name:'Duplicate',tourism:'viewpoint'}},
]};

test('nearby results are sourced named POIs with valid map positions',()=>{
  const places=normalizePois(nearby,latitude,longitude,'2026-09-27T00:00:00Z');
  assert.deepEqual(places.map(item=>item.name),['Viewpoint','Museum']);
  assert.deepEqual(places.map(item=>item.category),['Sights','Culture']);
  assert.equal(places[1].address,'Museum Street');
  assert.equal(places[1].sourceUrl,'https://www.openstreetmap.org/way/2');
  assert.throws(()=>normalizePois({},latitude,longitude,''));
});

test('nearby provider uses bounded coordinates and caches repeat requests',async()=>{
  let calls=0;
  const fetcher=async (_url,options)=>{calls++;const query=new URLSearchParams(options.body).get('data');assert.match(query,/around:4000,38\.7078,-9\.1366/);return new Response(JSON.stringify(nearby),{status:200});};
  const service=new PoiService('https://example.com/api/interpreter',fetcher);
  assert.equal((await service.nearby(latitude,longitude)).length,2);
  assert.equal((await service.nearby(latitude,longitude)).length,2);
  assert.equal(calls,1);
  await assert.rejects(service.nearby(999,longitude));
});

test('provider failures never create fictional fallback places',async()=>{
  const service=new PoiService('https://example.com/api/interpreter',async()=>new Response('unavailable',{status:503}));
  await assert.rejects(service.nearby(latitude,longitude),/temporarily unavailable/);
});
