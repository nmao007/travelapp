'use client';
import {useEffect,useState} from 'react';
import type {PlannerTrip} from '@/lib/planner';
import {makeEntry,uid} from '@/lib/planner';
import type {Poi,PoiCategory} from '@/lib/poi-service';
import {Icon} from '@/components/journey/icon';

const kinds:PoiCategory[]=['Sights','Culture','Nature','Food'];
function aFew(places:Poi[]){return kinds.map(kind=>places.find(place=>place.category===kind)).filter((place):place is Poi=>!!place).slice(0,3);}
export function TripDiscovery({trip,update,explore}:{trip:PlannerTrip;update:(next:PlannerTrip)=>void;explore:()=>void}){
  const destination=trip.destinations?.[0];
  const [places,setPlaces]=useState<Poi[]>([]),[notice,setNotice]=useState('');
  useEffect(()=>{
    if(!destination)return;
    const controller=new AbortController();
    void fetch(`/api/recommendations?${new URLSearchParams({lat:String(destination.latitude),lon:String(destination.longitude)})}`,{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('Unavailable');return response.json();})
      .then(body=>{if(!controller.signal.aborted&&Array.isArray(body.places))setPlaces(body.places);})
      .catch(()=>{});
    return()=>controller.abort();
  },[destination?.id,destination?.latitude,destination?.longitude]);
  function save(place:Poi){
    if(trip.entries.some(item=>item.place?.id===place.id)){setNotice(`${place.name} is already saved.`);return;}
    const entry={...makeEntry(trip,{title:place.name,date:'',location:place.address||place.name,notes:''},uid()),place};
    update({...trip,entries:[...trip.entries,entry]});setNotice(`${place.name} saved to ideas.`);
  }
  return <section className="m-trip-discovery"><div className="m-trip-discovery-heading"><div><span>NEAR YOUR FIRST STOP</span><h2>{destination ? `See ${destination.name} your way` : 'Find your next stop'}</h2></div><button type="button" className="p-text-button" onClick={explore}>Explore <Icon name="arrow" size={15}/></button></div>{aFew(places).length ? <div className="m-trip-discovery-cards">{aFew(places).map(place=><article key={place.id}><span>{place.category}</span><strong>{place.name}</strong><button type="button" aria-label={`Save ${place.name} to ideas`} onClick={()=>save(place)}><Icon name="plus" size={16}/></button></article>)}</div> : <button type="button" className="m-trip-discovery-empty" onClick={explore}>Browse real places near {destination?.name || trip.stops[0]} <Icon name="arrow" size={17}/></button>}{notice&&<p className="m-success" role="status">{notice}</p>}</section>;
}
