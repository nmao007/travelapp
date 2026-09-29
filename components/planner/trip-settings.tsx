'use client';
import { useEffect, useRef, useState } from 'react';
import type { Destination } from '@/lib/destination';
import type { PlannerTrip } from '@/lib/planner';
import { moneyInput, parseMoney } from '@/lib/domain';
import { addStop, editableStops, moveStop, reviseTrip, type TripStop } from '@/lib/trip-edit';
import { Icon } from '@/components/journey/icon';
import { Modal } from './forms';

export function TripSettings({trip,update,close,requestDelete}:{trip:PlannerTrip;update:(trip:PlannerTrip)=>void;close:()=>void;requestDelete:()=>void}) {
  const [stops,setStops]=useState<TripStop[]>(()=>editableStops(trip));
  const [query,setQuery]=useState(''),[results,setResults]=useState<Destination[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const controller=useRef<AbortController | null>(null);
  useEffect(()=>{
    if (query.trim().length<3) {setResults([]);return;}
    const request=new AbortController();controller.current=request;setBusy(true);
    const timer=setTimeout(async()=>{
      try {const response=await fetch(`/api/destinations?${new URLSearchParams({q:query.trim()})}`,{signal:request.signal});const body=await response.json();if(!response.ok) throw new Error(body.error || 'Search is unavailable.');if(!request.signal.aborted) setResults(body.destinations || []);}
      catch(err){if(!request.signal.aborted) setError(err instanceof Error ? err.message : 'Search is unavailable.');}
      finally{if(!request.signal.aborted) setBusy(false);}
    },400);
    return()=>{clearTimeout(timer);request.abort();};
  },[query]);
  function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();const values=new FormData(event.currentTarget);
    try {
      const budgetText=String(values.get('budget') || '').trim();
      const budget=budgetText ? parseMoney(budgetText,trip.currency) : null;
      if (budgetText && budget===null) throw new Error('Choose a valid budget.');
      update(reviseTrip(trip,stops,{title:String(values.get('title') || ''),start:String(values.get('start') || ''),end:String(values.get('end') || ''),travelers:Number(values.get('travelers') || 1),pace:String(values.get('pace') || 'Balanced'),budget}));close();
    } catch(err){setError(err instanceof Error ? err.message : 'Check these trip details.');}
  }
  return <Modal title="Trip details" close={close}><form className="d-settings" onSubmit={submit}>
    <div className="d-settings-section"><div className="d-settings-heading"><h3>Destinations</h3><span>{stops.length} of 20</span></div><ol className="d-edit-stops">{stops.map((stop,index)=><li key={stop.destination?.id || `legacy-${index}`}><span className="d-edit-index">{index+1}</span><div><strong>{stop.label}</strong>{!stop.destination && <small>Saved before place selection · location unverified</small>}</div><button type="button" aria-label={`Move ${stop.label} earlier`} disabled={index===0} onClick={()=>setStops(moveStop(stops,index,-1))}>↑</button><button type="button" aria-label={`Move ${stop.label} later`} disabled={index===stops.length-1} onClick={()=>setStops(moveStop(stops,index,1))}>↓</button><button type="button" aria-label={`Remove ${stop.label}`} disabled={stops.length===1} onClick={()=>setStops(stops.filter((_,i)=>i!==index))}><Icon name="close" size={15}/></button></li>)}</ol>
    <label className="p-search-field d-settings-search"><Icon name="search" size={19}/><input value={query} onChange={event=>{setQuery(event.target.value);setError('');}} aria-label="Add a destination" placeholder="Add a city or region" autoComplete="off" maxLength={160}/></label>
    {busy && <p className="d-settings-status" role="status">Finding destinations…</p>}{results.length>0 && <div className="d-settings-results">{results.map(result=><button type="button" key={result.id} onClick={()=>{try{setStops(addStop(stops,result));setQuery('');setResults([]);setError('');}catch(err){setError(err instanceof Error ? err.message : 'Could not add destination.');}}}><span><strong>{result.name}</strong><small>{[result.region,result.country].filter(Boolean).join(' · ')}</small></span><Icon name="plus" size={17}/></button>)}</div>}</div>
    <details className="d-settings-details"><summary>Dates and other details</summary><div className="d-settings-fields"><label className="p-field"><span>Trip name</span><input name="title" required maxLength={160} defaultValue={trip.title}/></label><div className="p-two-fields"><label className="p-field"><span>Departure</span><input name="start" type="date" defaultValue={trip.start}/></label><label className="p-field"><span>Return</span><input name="end" type="date" defaultValue={trip.end}/></label></div><div className="p-two-fields"><label className="p-field"><span>Travelers</span><input name="travelers" type="number" min={1} max={100} defaultValue={trip.travelers}/></label><label className="p-field"><span>Pace</span><select name="pace" defaultValue={trip.pace}>{['Relaxed','Balanced','Full days'].map(value=><option key={value}>{value}</option>)}</select></label></div><label className="p-field"><span>Budget · {trip.currency}</span><input name="budget" inputMode="decimal" defaultValue={moneyInput(trip.budget,trip.currency)}/></label></div></details>
    {error && <p className="p-error" role="alert">{error}</p>}<div className="d-settings-footer"><button type="button" className="p-text-button d-delete-trip" onClick={requestDelete}>Delete trip</button><button type="button" className="p-secondary" onClick={close}>Cancel</button><button type="submit" className="p-primary">Save changes</button></div>
  </form></Modal>;
}
