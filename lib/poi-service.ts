import { PlaceSearchError, type RealPlace } from './place-service.ts';
export type PoiCategory='Sights'|'Culture'|'Nature'|'Food';
export type Poi = RealPlace & {category:PoiCategory;distanceKm:number};
type Element={type?:unknown;id?:unknown;lat?:unknown;lon?:unknown;center?:{lat?:unknown;lon?:unknown};tags?:Record<string,unknown>};
const categories: [keyof Element | string,RegExp,PoiCategory][]=[['amenity',/^(restaurant|cafe)$/,'Food'],['tourism',/^(museum|gallery)$/,'Culture'],['historic',/^(castle|monument|archaeological_site|memorial)$/,'Culture'],['leisure',/^(park|garden|nature_reserve)$/,'Nature'],['natural',/^(beach|waterfall|peak)$/,'Nature'],['tourism',/^(attraction|viewpoint|zoo|aquarium|theme_park)$/,'Sights']];
function distanceKm(a:number,b:number,c:number,d:number){const r=Math.PI/180,p=(c-a)*r,l=(d-b)*r,x=Math.sin(p/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(l/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));}
function safeWebsite(value:unknown):string|undefined{if(typeof value!=='string')return;try{const url=new URL(value.trim());return url.protocol==='https:'&&url.hostname.length>2?url.toString():undefined;}catch{return;}}
function safePhone(value:unknown):string|undefined{return typeof value==='string'&&/^\+?[\d\s().-]{6,30}$/.test(value.trim())?value.trim():undefined;}
export function normalizePois(data:unknown,latitude:number,longitude:number,at:string):Poi[]{
  if(!data || typeof data!=='object' || !Array.isArray((data as {elements?:unknown}).elements)) throw new PlaceSearchError('Nearby places returned an unexpected response.',502);
  const seen=new Set<string>();
  return (data as {elements:unknown[]}).elements.slice(0,500).flatMap(raw=>{
    if(!raw || typeof raw!=='object') return [];
    const value=raw as Element,tags=value.tags;
    if(!['node','way','relation'].includes(String(value.type)) || !Number.isSafeInteger(value.id) || Number(value.id)<1 || !tags || typeof tags.name!=='string' || !tags.name.trim()) return [];
    const lat=Number(value.lat ?? value.center?.lat),lon=Number(value.lon ?? value.center?.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) return [];
    const category=categories.find(([key,pattern])=>pattern.test(String(tags[key]||'')))?.[2];
    if(!category)return [];
    const distance=distanceKm(latitude,longitude,lat,lon);
    if(distance>7)return [];
    const id=`osm:${value.type}:${value.id}`;if(seen.has(id))return [];seen.add(id);
    const nativeName=tags.name.trim().slice(0,160);
    const englishName=typeof tags['name:en']==='string'?tags['name:en'].trim().slice(0,160):'';
    const name=englishName||nativeName,address=[tags['addr:street'],tags['addr:city']].filter(item=>typeof item==='string').join(', ').slice(0,300);
    const hoursText=typeof tags.opening_hours==='string'?tags.opening_hours.trim().slice(0,160):undefined;
    return [{id,name,nativeName:name!==nativeName?nativeName:undefined,address,latitude:lat,longitude:lon,category,website:safeWebsite(tags.website??tags['contact:website']),phone:safePhone(tags.phone??tags['contact:phone']),hoursText,sourceUrl:`https://www.openstreetmap.org/${value.type}/${value.id}`,fetchedAt:at,distanceKm:Math.round(distance*10)/10}];
  }).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,60);
}
export class PoiService {
  private cache=new Map<string,{until:number;pois:Poi[]}>();
  private pending=new Map<string,Promise<Poi[]>>();
  private nextAt=0;
  private queue:Promise<void>=Promise.resolve();
  private requests:number[]=[];
  private endpoint:string;
  private fetcher:typeof fetch;
  constructor(endpoint='https://overpass-api.de/api/interpreter',fetcher:typeof fetch=fetch){if(new URL(endpoint).protocol!=='https:')throw new Error('POI provider must use HTTPS.');this.endpoint=endpoint;this.fetcher=fetcher;}
  nearby(latitude:number,longitude:number):Promise<Poi[]>{
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return Promise.reject(new PlaceSearchError('Choose a valid destination.',400));
    const key=`${latitude.toFixed(3)},${longitude.toFixed(3)}`,cached=this.cache.get(key);
    if(cached && cached.until>Date.now())return Promise.resolve(cached.pois);
    if(this.pending.has(key))return this.pending.get(key)!;
    this.requests=this.requests.filter(time=>time>Date.now()-3600000);
    if(this.pending.size>=2||this.requests.length>=20)return Promise.reject(new PlaceSearchError('Nearby discovery is busy. Try again shortly.',429));
    this.requests.push(Date.now());
    const task=this.queue.then(async()=>{
      const delay=this.nextAt-Date.now();if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));this.nextAt=Date.now()+3000;
      const query=`[out:json][timeout:12];(nwr(around:4000,${latitude},${longitude})[name][tourism~"^(attraction|viewpoint|zoo|aquarium|theme_park|museum|gallery)$"];nwr(around:4000,${latitude},${longitude})[name][historic~"^(castle|monument|archaeological_site|memorial)$"];nwr(around:4000,${latitude},${longitude})[name][leisure~"^(park|garden|nature_reserve)$"];nwr(around:4000,${latitude},${longitude})[name][natural~"^(beach|waterfall|peak)$"];nwr(around:2000,${latitude},${longitude})[name][amenity~"^(restaurant|cafe)$"];);out center 300;`;
      let response:Response;
      try{response=await this.fetcher(this.endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json','User-Agent':'TripPilot/0.4 (bounded destination exploration)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(18000),redirect:'error',cache:'no-store'});}catch{throw new PlaceSearchError('Nearby places could not connect. Try again.',503);}
      if(!response.ok)throw new PlaceSearchError('Nearby places are temporarily unavailable.',response.status===429?429:502);
      const body=await response.text();if(body.length>1_500_000)throw new PlaceSearchError('Nearby response was too large.',502);
      let data:unknown;try{data=JSON.parse(body);}catch{throw new PlaceSearchError('Nearby response was invalid.',502);}
      const pois=normalizePois(data,latitude,longitude,new Date().toISOString());if(this.cache.size>=100)this.cache.delete(this.cache.keys().next().value!);this.cache.set(key,{until:Date.now()+4*3600000,pois});return pois;
    });
    this.queue=task.then(()=>{},()=>{});this.pending.set(key,task);void task.finally(()=>this.pending.delete(key)).catch(()=>{});return task;
  }
}
