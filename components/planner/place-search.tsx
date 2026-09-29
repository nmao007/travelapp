'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/journey/icon';
import { makeEntry, uid } from '@/lib/planner';
import type { RealPlace } from '@/lib/place-service';
import { days } from '@/lib/planner';
import { formatDate } from '@/lib/domain';
import type { ScreenProps } from './screens';
import { Modal } from './forms';
import { NearbyExplore } from './nearby-explore';
export function PlaceSearch({ trip, update, day, compose }: ScreenProps) {
  const [mode,setMode]=useState<'nearby'|'search'>('nearby');
  const [query, setQuery] = useState(''), [destination, setDestination] = useState(trip.stops[0]), [results, setResults] = useState<RealPlace[]>([]), [searched, setSearched] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [detail, setDetail] = useState<RealPlace | null>(null), [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); controller.current?.abort(); const next = new AbortController(); controller.current = next;
    setBusy(true); setError(''); setNotice(''); setResults([]); setSearched(false);
    try {
      const response = await fetch(`/api/places?${new URLSearchParams({ q: query.trim(), destination })}`, { signal: next.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search is unavailable.');
      if (!next.signal.aborted) { setResults(data.places); setSearched(true); }
    } catch (err) { if (!next.signal.aborted) setError(err instanceof Error ? err.message : 'Search could not connect.'); }
    finally { if (!next.signal.aborted) setBusy(false); }
  }
  function add(place: RealPlace, date: string) {
    const existing = trip.entries.find(e => e.place?.id === place.id && e.date === date);
    if (existing) { setNotice(`${place.name} is already in ${date ? formatDate(date) : 'your saved ideas'}.`); setDetail(null); return; }
    const entry = { ...makeEntry(trip, { title: place.name, date, location: place.address, notes: '' }, uid()), place };
    update({ ...trip, entries: [...trip.entries, entry] });
    setDetail(null); setNotice(`${place.name} added to ${date ? formatDate(date) : 'Ideas'}.`);
  }
  const saved = trip.entries.filter(e => e.place);
  return <section className="m-explore"><div className="m-page-title"><h1>Explore</h1></div>
    <div className="m-explore-switch" role="group" aria-label="Explore mode"><button type="button" aria-pressed={mode==='nearby'} onClick={()=>setMode('nearby')}>Nearby</button><button type="button" aria-pressed={mode==='search'} onClick={()=>setMode('search')}>Search places</button></div>
    {mode==='nearby' ? <NearbyExplore trip={trip} update={update} day={day} openDetails={()=>compose({type:'settings'})}/> : <><div className="m-search-heading"><h2>Search places</h2>{trip.stops.length > 1 && <select aria-label="Search destination" value={destination} onChange={e => { setDestination(e.target.value); setResults([]); setSearched(false); }}>{trip.stops.map((stop,i) => <option key={`${stop}-${i}`}>{stop}</option>)}</select>}</div>
    <form onSubmit={search} className="m-place-search"><label className="p-search-field"><Icon name="search" /><input aria-label="Search real places" value={query} onChange={e => setQuery(e.target.value)} minLength={2} maxLength={160} required placeholder={`Place name or type in ${destination.split(',')[0]}`} /></label><button className="p-primary" disabled={busy} type="submit">{busy ? 'Searching…' : 'Search'}</button></form>
    <p className="m-provider-label">Public places only · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p>
    {error && <p className="p-error" role="alert">{error}</p>}{notice && <p className="m-success" role="status">{notice}</p>}
    {busy && <div className="m-place-loading" role="status">Finding places…</div>}
    {!busy && searched && !results.length && <div className="m-quiet-empty">No matches. Try a specific place name.</div>}
    {!!results.length && <div className="m-place-results">{results.map(place => <article key={place.id}><span className="m-result-icon"><Icon name="pin" /></span><button className="m-result-summary" onClick={() => setDetail(place)}><strong>{place.name}</strong><span>{place.address}</span></button><button className="p-icon-button" aria-label={`Save ${place.name} to ideas`} onClick={() => add(place, '')}><Icon name="plus" /></button></article>)}</div>}
    {!searched && !busy && !error && <div className="m-quiet-empty">Search for a museum, café, landmark, or neighborhood.</div>}</>}
    {!!saved.length && <section className="m-saved-places"><h2>Saved places <span className="p-count">{saved.length}</span></h2>{saved.map(e => <button key={e.id} onClick={() => setDetail(e.place!)}><Icon name="pin" size={17} /><strong>{e.title}</strong><span>{e.date ? formatDate(e.date) : 'Idea'}</span><Icon name="chevron" size={16} /></button>)}</section>}
    {detail && <Modal title={detail.name} close={() => setDetail(null)}><div className="m-place-detail"><p>{detail.address}</p><dl><dt>Category</dt><dd>{detail.category}</dd><dt>Source</dt><dd><a href={detail.sourceUrl} target="_blank" rel="noreferrer">OpenStreetMap ↗</a></dd></dl><p className="m-detail-note">Hours, tickets, ratings, and availability are not supplied by this lookup.</p><form onSubmit={e => {e.preventDefault();add(detail, String(new FormData(e.currentTarget).get('date') || ''));}}><label className="p-field"><span>Add to</span><select name="date" defaultValue={day || ''}><option value="">Unscheduled ideas</option>{days(trip).map(date => <option key={date} value={date}>{formatDate(date,{weekday:'short',month:'short',day:'numeric'})}</option>)}</select></label><button className="p-primary" type="submit">Add to plan</button></form></div></Modal>}
  </section>;
}
