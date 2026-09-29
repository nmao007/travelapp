'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map, Marker } from 'maplibre-gl';
import type { Destination } from '@/lib/destination';
import { makeEntry, uid, type PlannerTrip } from '@/lib/planner';
import type { Poi, PoiCategory } from '@/lib/poi-service';
import { Icon } from '@/components/journey/icon';
const categories:['All',...PoiCategory[]]=['All','Sights','Culture','Nature','Food'];
const colors:Record<PoiCategory,string>={Sights:'#334f82',Culture:'#9a6447',Nature:'#47816d',Food:'#9b5680'};
function selectBalanced(places:Poi[]):Poi[]{
  const result:Poi[]=[];
  for(let index=0;index<4;index++)for(const category of categories.slice(1)){
    const place=places.filter(item=>item.category===category)[index];if(place)result.push(place);
  }
  return result.slice(0,16);
}
function NearbyMap({destination,places,select}:{destination:Destination;places:Poi[];select:(place:Poi)=>void}){
  const root=useRef<HTMLDivElement>(null),[status,setStatus]=useState('Loading map…');
  useEffect(()=>{
    let active=true,map:Map|undefined,observer:ResizeObserver|undefined;const markers:Marker[]=[];const controller=new AbortController();
    async function initialize(){try{
      const response=await fetch('/api/map-config',{signal:controller.signal});const config=await response.json();if(!response.ok)throw new Error(config.error || 'Map unavailable.');
      const M=await import('maplibre-gl');if(!active||!root.current)return;M.setWorkerUrl(config.workerUrl);
      map=new M.Map({container:root.current,style:config.style,center:[destination.longitude,destination.latitude],zoom:12,attributionControl:false,cooperativeGestures:true});
      map.addControl(new M.NavigationControl({showCompass:false}),'top-right');map.addControl(new M.AttributionControl({compact:false}),'bottom-right');
      for(const place of places.slice(0,24)){
        const button=document.createElement('button');button.type='button';button.className='m-poi-pin';button.style.background=colors[place.category];button.setAttribute('aria-label',`${place.name}, ${place.category}`);button.addEventListener('click',()=>select(place));
        markers.push(new M.Marker({element:button}).setLngLat([place.longitude,place.latitude]).addTo(map));
      }
      if(places.length){const bounds=new M.LngLatBounds();for(const place of places)bounds.extend([place.longitude,place.latitude]);map.fitBounds(bounds,{padding:46,maxZoom:15,duration:0});}
      map.on('load',()=>{if(active)setStatus('');});map.on('error',()=>{if(active)setStatus('Map could not load. Nearby places remain below.');});
      observer=new ResizeObserver(()=>map?.resize());observer.observe(root.current);
    }catch(err){if(active)setStatus(err instanceof Error?err.message:'Map unavailable.');}}
    void initialize();return()=>{active=false;controller.abort();observer?.disconnect();markers.forEach(marker=>marker.remove());map?.remove();};
  },[destination,places,select]);
  return <div className="m-nearby-map"><div ref={root} role="region" aria-label={`Map of places near ${destination.name}`}/>{status && <span role="status">{status}</span>}</div>;
}
export function NearbyExplore({trip,update,day,openDetails}:{trip:PlannerTrip;update:(trip:PlannerTrip)=>void;day:string;openDetails:()=>void}){
  const destinations=trip.destinations || [];
  const [selectedId,setSelectedId]=useState(destinations[0]?.id || ''),[places,setPlaces]=useState<Poi[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[category,setCategory]=useState<(typeof categories)[number]>('All'),[active,setActive]=useState<Poi|null>(null),[notice,setNotice]=useState(''),[retry,setRetry]=useState(0);
  const destination=destinations.find(item=>item.id===selectedId)||destinations[0];
  useEffect(()=>{
    if(!destination)return;const controller=new AbortController();setBusy(true);setError('');setPlaces([]);setActive(null);
    void fetch(`/api/recommendations?${new URLSearchParams({lat:String(destination.latitude),lon:String(destination.longitude)})}`,{signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error || 'Nearby places are unavailable.');if(!Array.isArray(body.places))throw new Error('Unexpected nearby response.');return body.places as Poi[];})
      .then(results=>{if(!controller.signal.aborted)setPlaces(results);})
      .catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Nearby places are unavailable.');})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[destination?.id,destination?.latitude,destination?.longitude,retry]);
  const visible=useMemo(()=>category==='All'?selectBalanced(places):places.filter(place=>place.category===category).slice(0,16),[places,category]);
  function add(place:Poi,date:string){
    if(trip.entries.some(item=>item.place?.id===place.id&&item.date===date)){setNotice(`${place.name} is already ${date?'on that day':'in your ideas'}.`);return;}
    const entry={...makeEntry(trip,{title:place.name,date,location:place.address || place.name,notes:''},uid()),place};
    update({...trip,entries:[...trip.entries,entry]});setNotice(date?`${place.name} added to the selected day.`:`${place.name} saved for later.`);
  }
  if(!destination)return <div className="m-nearby-empty"><Icon name="globe" size={28}/><h2>Choose a place to explore</h2><p>This older trip has no verified destination coordinates yet.</p><button className="p-primary" onClick={openDetails}>Edit destinations</button></div>;
  return <div className="m-nearby"><div className="m-nearby-top"><div><h2>Explore near {destination.name}</h2><p>Places from OpenStreetMap · opening hours and popularity unknown</p></div>{destinations.length>1 && <select aria-label="Explore destination" value={destination.id} onChange={event=>{setSelectedId(event.target.value);setCategory('All');setNotice('');}}>{destinations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>
    <div className="m-nearby-layout"><div><div className="m-nearby-categories" aria-label="Place types">{categories.map(value=><button type="button" key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>{value}</button>)}</div>{busy&&<div className="m-nearby-loading" role="status">Finding places nearby…</div>}{error&&<div className="m-nearby-error" role="alert"><p>{error}</p><button type="button" className="p-secondary" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>}{notice&&<p className="m-success" role="status">{notice}</p>}{!busy&&!error&&!visible.length&&<div className="m-quiet-empty">No mapped places in this category nearby. Try another area or search by name.</div>}
      <div className="m-nearby-cards">{visible.map(place=><article key={place.id} className={active?.id===place.id?'active':''}><button className="m-nearby-card-main" onClick={()=>setActive(place)}><span className="m-nearby-category" style={{color:colors[place.category]}}>{place.category}</span><strong>{place.name}</strong><small>{place.distanceKm} km from {destination.name} · {place.address || 'Address not listed'}</small></button><button type="button" aria-label={`Save ${place.name} for later`} title="Save for later" onClick={()=>add(place,'')}><Icon name="bookmark" size={17}/></button></article>)}</div></div>
      <aside><NearbyMap destination={destination} places={visible} select={setActive}/>{active&&<div className="m-nearby-selected"><div><span>{active.category} · {active.distanceKm} km away</span><button type="button" aria-label="Close place details" onClick={()=>setActive(null)}><Icon name="close" size={16}/></button></div><h3>{active.name}</h3><p>{active.address || 'Address not listed'}</p><a href={active.sourceUrl} target="_blank" rel="noreferrer">OpenStreetMap details ↗</a><button className="p-primary" onClick={()=>add(active,day||'')}>{day?'Add to selected day':'Save to ideas'} <Icon name="plus" size={16}/></button></div>}</aside></div>
    <p className="m-provider-label"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p>
  </div>;
}
