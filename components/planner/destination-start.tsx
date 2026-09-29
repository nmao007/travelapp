'use client';
import { useEffect, useRef, useState } from 'react';
import { calendarMonth, tripFromDestinations, type Destination } from '@/lib/destination';
import type { PlannerTrip } from '@/lib/planner';
import { formatDate } from '@/lib/domain';
import { DestinationMap } from './destination-map';
import { DestinationGlobe } from './destination-globe';
import { Icon } from '@/components/journey/icon';
import { addStop, moveStop, type TripStop } from '@/lib/trip-edit';

export function DestinationStart({cancel, complete}: {cancel: () => void; complete: (trip: PlannerTrip, booked: boolean) => void}) {
  const [query,setQuery] = useState(''), [results,setResults] = useState<Destination[]>([]), [searched,setSearched] = useState(false), [loading,setLoading] = useState(false), [error,setError] = useState('');
  const [destination,setDestination] = useState<Destination | null>(null), [chosen,setChosen] = useState<TripStop[]>([]), [zone,setZone] = useState(''), [start,setStart] = useState(''), [end,setEnd] = useState('');
  const [month,setMonth] = useState(() => {const now = new Date();return [now.getFullYear(),now.getMonth()];});
  const controller = useRef<AbortController | null>(null), searchInput = useRef<HTMLInputElement>(null);
  const [activeResult,setActiveResult] = useState(-1), [example,setExample] = useState(0);
  const [globe,setGlobe] = useState(false);
  const examples = ['Lisbon, Portugal','Kyoto, Japan','Barcelona, Spain','Cape Town, South Africa'];
  useEffect(() => {
    if (query || destination || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {if (document.visibilityState === 'visible') setExample(value => (value + 1) % 4);},3200);
    return () => clearInterval(timer);
  },[query,destination]);
  useEffect(() => {
    if (destination || query.trim().length < 3) return;
    const request = new AbortController();controller.current=request;
    setLoading(true);setError('');setSearched(false);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/destinations?${new URLSearchParams({q:query.trim()})}`,{signal:request.signal});
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Destination search is unavailable.');
        if (!Array.isArray(body.destinations)) throw new Error('Destination search returned an unexpected response.');
        if (!request.signal.aborted) {setResults(body.destinations);setSearched(true);}
      } catch (err) {if (!request.signal.aborted) setError(err instanceof Error ? err.message : 'Could not connect. Try again.');}
      finally {if (!request.signal.aborted) setLoading(false);}
    },400);
    return () => {clearTimeout(timer);request.abort();};
  },[query,destination]);
  function choose(result: Destination) {
    controller.current?.abort();setLoading(false);setGlobe(false);
    if (chosen.some(stop => stop.destination?.id===result.id)) {setError('That destination is already in this trip.');return;}
    const next=addStop(chosen,result);setChosen(next);setDestination(result);
    if (!chosen.length) setZone(result.zones.length===1 ? result.zones[0] : '');
    setQuery('');setResults([]);setError('');
  }
  function backToSearch(removeSelected = false) {if (removeSelected) setChosen(value => value.filter(stop => stop.destination?.id!==destination?.id));setDestination(null);setQuery('');setResults([]);setSearched(false);setLoading(false);setError('');}
  function finish(flexible = false) {
    if (!destination) return;
    try {complete(tripFromDestinations(chosen.flatMap(stop => stop.destination ? [stop.destination] : []), flexible ? '' : start, flexible ? '' : end, zone), false);}
    catch (err) {setError(err instanceof Error ? err.message : 'Check the selected dates.');}
  }
  function moveMonth(delta: number) {const date = new Date(Date.UTC(month[0],month[1] + delta,1));setMonth([date.getUTCFullYear(),date.getUTCMonth()]);}
  function selectDate(date: string) {setError('');if (!start || end || date < start) {setStart(date);setEnd('');} else setEnd(date);}
  return <section className="d-start">
    <button className="p-text-button d-back" onClick={() => {if (destination) backToSearch(true); else if(chosen.length) setDestination(chosen.at(-1)?.destination || null); else cancel();}}>← {destination ? 'Destinations' : chosen.length ? 'Route' : 'My trips'}</button>
    {!destination ? <>
      <h1>{chosen.length ? 'Add another stop' : 'Where to?'}</h1>
      {chosen.length>0 && <div className="d-trip-so-far">{chosen.map((stop,index)=><span key={stop.destination?.id || index}>{index+1}. {stop.label}</span>)}<button type="button" onClick={()=>setDestination(chosen.at(-1)?.destination || null)}>Done adding</button></div>}
      <div className="d-search d-autocomplete">
        <label className="p-search-field"><Icon name="search" size={20}/><input ref={searchInput} role="combobox" aria-label="Search destinations" aria-autocomplete="list" aria-expanded={!loading && results.length > 0} aria-controls="destination-results" aria-activedescendant={activeResult >= 0 && results[activeResult] ? `destination-result-${activeResult}` : undefined} autoFocus autoComplete="off" placeholder={`Try ${examples[example]}`} value={query} maxLength={160} onChange={event => {controller.current?.abort();setLoading(false);setGlobe(false);setQuery(event.target.value);setSearched(false);setResults([]);setActiveResult(-1);setError('');}} onKeyDown={event => {
          if (event.key === 'Escape') {controller.current?.abort();setQuery('');setResults([]);setActiveResult(-1);setSearched(false);setLoading(false);setError('');}
          else if (results.length && !loading && ['ArrowDown','ArrowUp','Enter'].includes(event.key)) {
            event.preventDefault();
            if (event.key === 'Enter') choose(results[activeResult >= 0 ? activeResult : 0]);
            else setActiveResult(value => event.key === 'ArrowDown' ? (value + 1) % results.length : value <= 0 ? results.length - 1 : value - 1);
          }
        }}/>{query && <button type="button" className="d-clear" aria-label="Clear destination search" onClick={() => {controller.current?.abort();setQuery('');setResults([]);setActiveResult(-1);setSearched(false);setLoading(false);setError('');searchInput.current?.focus();}}><Icon name="close" size={18}/></button>}</label>
        <button type="button" className={`d-explore-toggle ${globe ? 'active' : ''}`} aria-label={globe ? 'Close destination globe' : 'Explore destinations on globe'} aria-pressed={globe} onClick={() => {controller.current?.abort();setQuery('');setResults([]);setSearched(false);setLoading(false);setActiveResult(-1);setError('');setGlobe(value => !value);}}><Icon name="globe" size={21}/><span>Explore</span></button>
      </div>
      {globe && <DestinationGlobe choose={choose}/>}
      {loading && <p className="d-status" role="status">Finding destinations…</p>}
      <div className="d-results" id="destination-results" role="listbox" aria-label="Destination suggestions" aria-busy={loading}>{results.map((result,index) => <button role="option" aria-selected={activeResult === index} id={`destination-result-${index}`} className={activeResult === index ? 'active' : ''} key={result.id} onClick={() => choose(result)}>
        <span className="d-pin"><Icon name="pin" size={22}/></span><span><strong>{result.name}</strong><small>{[result.region,result.country].filter(Boolean).join(' · ') || result.address}</small></span><Icon name="chevron" size={18}/>
      </button>)}</div>
      {searched && !results.length && <p className="d-status" role="status">No destinations found. Try the city and country.</p>}
      <p className="d-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p>
    </> : <>
      <div className="d-heading"><div><h1>{destination.name}</h1><p>{[destination.region,destination.country].filter(Boolean).join(' · ')}</p></div><button className="p-text-button" onClick={() => backToSearch(true)}>Change</button></div>
      <div className="d-trip-stops"><div className="d-trip-stops-head"><strong>{chosen.length===1 ? 'Your destination' : 'Your route'}</strong><button type="button" onClick={() => backToSearch()}><Icon name="plus" size={16}/> Add stop</button></div><ol>{chosen.map((stop,index)=><li key={stop.destination?.id || index}><span>{index+1}</span><strong>{stop.label}</strong>{chosen.length>1 && <><button type="button" aria-label={`Move ${stop.label} earlier`} disabled={index===0} onClick={() => {const next=moveStop(chosen,index,-1);setChosen(next);setZone(next[0].destination?.zones[0] || zone);}}><Icon name="arrow" size={14} style={{transform:'rotate(180deg)'}}/></button><button type="button" aria-label={`Move ${stop.label} later`} disabled={index===chosen.length-1} onClick={() => {const next=moveStop(chosen,index,1);setChosen(next);setZone(next[0].destination?.zones[0] || zone);}}><Icon name="arrow" size={14}/></button><button type="button" aria-label={`Remove ${stop.label}`} onClick={() => {const next=chosen.filter((_,i)=>i!==index);setChosen(next);setDestination(next.at(-1)?.destination || null);setZone(next[0]?.destination?.zones[0] || '');}}><Icon name="close" size={14}/></button></>}</li>)}</ol></div>
      <div className="d-selection-layout"><div className="d-geography"><DestinationMap destination={destination}/><details><summary>Location details</summary><p>{destination.address}</p><p>{destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}</p><p>Time zone: {zone || 'Choose below'}</p><a href={destination.sourceUrl} target="_blank" rel="noreferrer">OpenStreetMap source ↗</a></details></div>
      <div className="d-dates"><h2>When are you going?</h2>
        {destination.zones.length > 1 && <fieldset className="d-zones"><legend>This location uses multiple time zones. Choose yours.</legend>{destination.zones.map(value => <button key={value} type="button" aria-pressed={zone === value} onClick={() => setZone(value)}>{value}</button>)}</fieldset>}
        <div className="d-date-summary" aria-live="polite"><span className={start && !end ? '' : 'active'}>{start ? formatDate(start) : 'Departure'}</span><Icon name="arrow" size={16}/><span className={start && !end ? 'active' : ''}>{end ? formatDate(end) : 'Return'}</span></div>
        <div className="d-month"><button className="p-icon-button" aria-label="Previous month" onClick={() => moveMonth(-1)}>←</button><strong>{new Date(Date.UTC(month[0],month[1],1)).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button className="p-icon-button" aria-label="Next month" onClick={() => moveMonth(1)}>→</button></div>
        <div className="d-calendar">{['M','T','W','T','F','S','S'].map((day,index) => <span key={index} aria-hidden="true">{day}</span>)}{calendarMonth(month[0],month[1]).map((date,index) => date ? <button key={date} aria-label={formatDate(date,{weekday:'long',month:'long',day:'numeric',year:'numeric'})} aria-pressed={date === start || date === end} className={`${date === start || date === end ? 'selected' : ''} ${start && end && date > start && date < end ? 'in-range' : ''}`} onClick={() => selectDate(date)}>{Number(date.slice(-2))}</button> : <span key={`blank-${index}`}/>)}</div>
        <div className="d-actions"><button className="p-primary" disabled={!start || !end || !zone} onClick={() => finish()}>Continue <Icon name="arrow" size={18}/></button><button className="p-text-button" disabled={!zone} onClick={() => finish(true)}>Decide dates later</button></div>
      </div></div>
    </>}
    {error && <p className="p-error" role="alert">{error}</p>}
  </section>;
}
