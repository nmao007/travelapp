import { normalizePlaces, PlaceSearchError, type RealPlace } from './place-service.ts';

export function photonPlaces(data: unknown, fetchedAt: string): RealPlace[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as {features?: unknown}).features)) throw new PlaceSearchError('Destination search returned an unexpected response.',502);
  return (data as {features: unknown[]}).features.slice(0,8).flatMap(raw => {
    if (!raw || typeof raw !== 'object') return [];
    const feature = raw as {geometry?: {type?: unknown; coordinates?: unknown}; properties?: Record<string,unknown>};
    const p = feature.properties, coordinates = feature.geometry?.coordinates;
    if (!p || feature.geometry?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2 || coordinates.some(v => typeof v !== 'number' || !Number.isFinite(v)) || typeof p.name !== 'string' || !p.name.trim()) return [];
    const types: Record<string,string> = {N:'node',W:'way',R:'relation',node:'node',way:'way',relation:'relation'};
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    return normalizePlaces([{osm_type:types[text(p.osm_type)],osm_id:p.osm_id,name:p.name,display_name:[p.name,text(p.state),text(p.country)].filter(Boolean).join(', '),lat:String(coordinates[1]),lon:String(coordinates[0]),type:text(p.type) || text(p.osm_value),address:{state:text(p.state),country:text(p.country)}}],fetchedAt);
  }).filter((place,index,all) => all.findIndex(other => other.id === place.id) === index);
}

/** Photon supports autocomplete. The public endpoint is limited to development. */
export class DestinationSearch {
  private cache = new Map<string,{until:number;places:RealPlace[]}>();
  private pending = new Map<string,Promise<RealPlace[]>>();
  private queue: Promise<void> = Promise.resolve();
  private nextAt = 0;
  private requests: number[] = [];
  private endpoint: string;
  private fetcher: typeof fetch;
  constructor(endpoint = 'https://photon.komoot.io/api/',fetcher: typeof fetch = fetch) {
    if (new URL(endpoint).protocol !== 'https:') throw new Error('Destination services must use HTTPS.');
    this.endpoint=endpoint;this.fetcher=fetcher;
  }
  search(query: string): Promise<RealPlace[]> {
    const q = query.trim().replace(/\s+/g,' '), key=q.toLocaleLowerCase('en');
    if (q.length < 3 || q.length > 160 || /[\x00-\x1f]/.test(query)) return Promise.reject(new PlaceSearchError('Type at least three characters, up to 160.',400));
    const url=new URL(this.endpoint);url.searchParams.set('q',q);url.searchParams.set('lang','en');url.searchParams.set('limit','6');url.searchParams.append('layer','city');url.searchParams.append('layer','state');
    return this.request(`search:${key}`,url);
  }
  nearby(latitude: number, longitude: number): Promise<RealPlace[]> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) return Promise.reject(new PlaceSearchError('Choose a valid point on the globe.',400));
    const url=new URL(this.endpoint);
    if (!/\/api\/?$/.test(url.pathname)) return Promise.reject(new PlaceSearchError('Map discovery needs a Photon API endpoint.',503));
    url.pathname=url.pathname.replace(/\/api\/?$/,'/reverse');url.search='';
    url.searchParams.set('lat',String(latitude));url.searchParams.set('lon',String(longitude));url.searchParams.set('radius','150');url.searchParams.set('limit','6');url.searchParams.set('lang','en');url.searchParams.set('layer','city');
    // Broad world-view taps suggest nearby cities; they never become invented coordinates or names.
    return this.request(`nearby:${latitude}:${longitude}`,url).then(places => places
      .filter(place => distanceKm(latitude,longitude,place.latitude,place.longitude)<=150)
      .sort((a,b) => distanceKm(latitude,longitude,a.latitude,a.longitude)-distanceKm(latitude,longitude,b.latitude,b.longitude)).slice(0,3));
  }
  private request(key: string,url: URL): Promise<RealPlace[]> {
    const cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return Promise.resolve(cached.places);
    if (this.pending.has(key)) return this.pending.get(key)!;
    this.requests=this.requests.filter(time => time > Date.now()-60000);
    if (this.pending.size >= 4 || this.requests.length >= 30) return Promise.reject(new PlaceSearchError('Destination search is busy. Try again shortly.',429));
    this.requests.push(Date.now());
    const task = this.queue.then(async () => {
      const wait=this.nextAt-Date.now();if (wait>0) await new Promise(resolve => setTimeout(resolve,wait));
      this.nextAt=Date.now()+1000;
      let response: Response;
      try {response=await this.fetcher(url,{headers:{Accept:'application/json','User-Agent':'TripPilot/0.3 (destination suggestions)'},signal:AbortSignal.timeout(6000),redirect:'error',cache:'no-store'});}
      catch {throw new PlaceSearchError('Destination search could not connect. Try again.',503);}
      if (!response.ok) throw new PlaceSearchError('Destination search is temporarily unavailable.',response.status===429 ? 429 : 502);
      const body=await response.text();if (body.length>250000) throw new PlaceSearchError('Destination response was too large.',502);
      let parsed: unknown;try {parsed=JSON.parse(body);} catch {throw new PlaceSearchError('Destination response was invalid.',502);}
      const places=photonPlaces(parsed,new Date().toISOString());
      if (this.cache.size>=256) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key,{until:Date.now()+3600000,places});return places;
    });
    this.queue=task.then(() => {},() => {});this.pending.set(key,task);
    void task.finally(() => this.pending.delete(key)).catch(() => {});
    return task;
  }
}

function distanceKm(lat: number,lon: number,otherLat: number,otherLon: number): number {
  const rad=Math.PI/180,deltaLat=(otherLat-lat)*rad,deltaLon=(otherLon-lon)*rad;
  const a=Math.sin(deltaLat/2)**2+Math.cos(lat*rad)*Math.cos(otherLat*rad)*Math.sin(deltaLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
