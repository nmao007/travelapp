'use client';
import {useEffect,useMemo,useState} from 'react';
import type {PlannerTrip} from '@/lib/planner';
import {addPlaceToTrip} from '@/lib/itinerary';
import {dayForArea,kilometers,nearbyPicks} from '@/lib/recommendations';
import {formatDate} from '@/lib/domain';
import type {Poi,PoiCategory} from '@/lib/poi-service';
import {Icon,type IconName} from '@/components/journey/icon';

const categoryIcons:Record<PoiCategory,IconName>={Sights:'explore',Culture:'document',Nature:'globe',Food:'food'};
export function TripDiscovery({trip,day,update,explore}:{trip:PlannerTrip;day:string;update:(next:PlannerTrip)=>void;explore:()=>void}){
  const mappedToday=trip.entries.find(entry=>entry.date===day&&entry.place)?.place;
  const destinations=trip.destinations||[];
  const destination=mappedToday ? destinations.reduce((closest,item)=>!closest||kilometers(item,mappedToday)<kilometers(closest,mappedToday)?item:closest,destinations[0]) : destinations[0];
  const [places,setPlaces]=useState<Poi[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    if(!destination)return;
    const controller=new AbortController();setBusy(true);setError(false);setPlaces([]);
    void fetch(`/api/recommendations?${new URLSearchParams({lat:String(destination.latitude),lon:String(destination.longitude)})}`,{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('Unavailable');return response.json();})
      .then(body=>{if(!controller.signal.aborted&&Array.isArray(body.places))setPlaces(body.places);})
      .catch(()=>{if(!controller.signal.aborted)setError(true);})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[destination?.id,destination?.latitude,destination?.longitude]);
  const suggestedDay=destination?dayForArea(trip,day,destination):'';
  const picks=useMemo(()=>destination?nearbyPicks(places,trip,day,destination):[],[places,trip,day,destination]);
  function save(place:Poi){
    const result=addPlaceToTrip(trip,place,suggestedDay);
    if(result.trip!==trip)update(result.trip);
    setNotice(result.action==='already'?`${place.name} is already in your trip.`:`${place.name} added to ${suggestedDay?formatDate(suggestedDay):'Ideas'}.`);
  }
  if(!destination)return null;
  return <section className="m-trip-discovery"><div className="m-trip-discovery-heading"><div><span>DISCOVER NEARBY</span><h2>Worth exploring in {destination.name}</h2></div><button type="button" className="p-text-button" onClick={explore}>See map <Icon name="arrow" size={15}/></button></div>
    {picks.length?<div className="m-trip-discovery-cards">{picks.map(({place,reason})=><article key={place.id} className={`m-trip-pick m-trip-pick-${place.category.toLowerCase()}`}><span className="m-trip-pick-icon"><Icon name={categoryIcons[place.category]} size={21}/></span><small>{place.category} · {reason}</small><strong>{place.name}</strong><button type="button" onClick={()=>save(place)} aria-label={`Add ${place.name} to ${suggestedDay?formatDate(suggestedDay):'Ideas'}`}><Icon name="plus" size={16}/><span>{suggestedDay?'Add to day':'Save idea'}</span></button></article>)}</div>
    :<button type="button" className="m-trip-discovery-empty" onClick={explore}>{busy?'Finding places nearby…':error?'Nearby places are unavailable. Open Explore to try again.':`Explore places near ${destination.name}`}<Icon name="arrow" size={17}/></button>}{notice&&<p className="m-success" role="status">{notice}</p>}</section>;
}
