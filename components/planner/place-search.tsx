'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/journey/icon';
import { addPlaceToTrip } from '@/lib/itinerary';
import type { RealPlace } from '@/lib/place-service';
import { formatDate } from '@/lib/domain';
import { dayForArea } from '@/lib/recommendations';
import type { ScreenProps } from './screens';
import { Modal } from './forms';
import { NearbyExplore } from './nearby-explore';

const suggestions = ['Museum', 'Viewpoint', 'Park', 'Café'];
export function PlaceSearch({ trip, update, day, compose, navigate }: ScreenProps) {
  const [mode, setMode] = useState<'nearby' | 'search'>('nearby');
  const [query, setQuery] = useState(''), [destination, setDestination] = useState(trip.stops[0] || '');
  const [results, setResults] = useState<RealPlace[]>([]);
  const [resultsKey, setResultsKey] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [detail, setDetail] = useState<RealPlace | null>(null), [notice, setNotice] = useState('');

  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 2) { setResults([]); setResultsKey(''); setBusy(false); setError(''); return; }
    const controller = new AbortController();
    const requestedKey = `${destination}:${query.trim()}`;
    const timer = window.setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const response = await fetch(`/api/places?${new URLSearchParams({ q: query.trim(), destination })}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Search is unavailable.');
        if (!controller.signal.aborted) { setResults(Array.isArray(data.places) ? data.places : []); setResultsKey(requestedKey); }
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Search could not connect.'); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, 460);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [mode, query, destination]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4200); return () => window.clearTimeout(timer); }, [notice]);

  function add(place: RealPlace, date: string) {
    const result = addPlaceToTrip(trip, place, date);
    if (result.trip !== trip) update(result.trip);
    setDetail(null);
    setNotice(result.action === 'already' ? `${place.name} is already in your trip.` : result.action === 'scheduled' ? `${place.name} moved to ${formatDate(date)}.` : `${place.name} added to ${date ? formatDate(date) : 'Ideas'}.`);
  }
  const saved = trip.entries.filter(entry => entry.place);
  const currentResults = resultsKey === `${destination}:${query.trim()}` ? results : [];
  const hasSearched = resultsKey === `${destination}:${query.trim()}`;
  const selectedDestination = trip.destinations?.[trip.stops.indexOf(destination)];
  const suggestedDay = selectedDestination ? dayForArea(trip, day, selectedDestination) : trip.destinations?.length ? '' : day;
  const quickAction = suggestedDay ? `Add to ${formatDate(day, { month: 'short', day: 'numeric' })}` : 'Save to Ideas';
  return <section className="m-explore"><div className="m-page-title"><h1>Explore</h1></div>
    <div className="m-explore-switch" role="group" aria-label="Explore mode"><button type="button" aria-pressed={mode === 'nearby'} onClick={() => setMode('nearby')}>Discover</button><button type="button" aria-pressed={mode === 'search'} onClick={() => setMode('search')}>Search</button></div>
    {mode === 'nearby' ? <NearbyExplore trip={trip} update={update} day={day} openDetails={() => compose({ type:'settings' })} openPlan={date => navigate('plan', undefined, date || day)}/> : <>
      <div className="m-search-heading"><h2>Find a place</h2>{trip.stops.length > 1 && <div className="m-destination-picks" role="group" aria-label="Search destination">{trip.stops.map((stop, index) => <button key={`${stop}-${index}`} type="button" aria-pressed={destination === stop} onClick={() => setDestination(stop)}>{stop}</button>)}</div>}</div>
      <label className="m-live-search"><Icon name="search" size={20}/><input aria-label="Search places" value={query} onChange={event => setQuery(event.target.value)} maxLength={160} autoComplete="off" placeholder={`What sounds good in ${destination.split(',')[0]}?`}/>{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><Icon name="close" size={16}/></button>}</label>
      {!query.trim() && <div className="m-search-suggestions" aria-label="Try a search">{suggestions.map(value => <button type="button" key={value} onClick={() => setQuery(value)}>{value}</button>)}</div>}
      {error && <p className="p-error" role="alert">{error}</p>}{notice && <p className="m-nearby-notice" role="status"><Icon name="check" size={16}/>{notice}</p>}
      {busy && <div className="m-live-status" role="status">Finding matches…</div>}
      {!busy && hasSearched && !error && !currentResults.length && <div className="m-quiet-empty">No matches. Try a place name or another category.</div>}
      {!!currentResults.length && <div className="m-place-results">{currentResults.map(place => { const existing = trip.entries.find(entry => entry.place?.id === place.id); return <article key={place.id}><span className="m-result-icon"><Icon name="pin"/></span><button className="m-result-summary" onClick={() => setDetail(place)}><strong>{place.name}</strong><span>{place.address}{existing ? ' · In your trip' : ''}</span></button><button className="p-icon-button" aria-label={existing ? `View ${place.name} in Plan` : `${quickAction}: ${place.name}`} onClick={() => existing ? navigate('plan', undefined, existing.date || day) : add(place, suggestedDay)}><Icon name={existing ? 'check' : 'plus'}/></button></article>; })}</div>}
      <p className="m-provider-label">Places from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></p>
    </>}
    {!!saved.length && <section className="m-saved-places"><h2>In your trip <span className="p-count">{saved.length}</span></h2>{saved.slice(0, 4).map(entry => <button key={entry.id} onClick={() => navigate('plan', undefined, entry.date || day)}><Icon name="pin" size={17}/><strong>{entry.title}</strong><span>{entry.date ? formatDate(entry.date) : 'Idea'}</span><Icon name="chevron" size={16}/></button>)}</section>}
    {detail && <Modal title={detail.name} close={() => setDetail(null)}><div className="m-place-detail"><p>{detail.nativeName && <span className="m-native-name">Locally: {detail.nativeName}<br/></span>}{detail.address}</p><p className="m-detail-note">Hours and ticket availability are not supplied by this lookup.</p><a href={detail.sourceUrl} target="_blank" rel="noreferrer">Source details ↗</a>{trip.entries.some(entry => entry.place?.id === detail.id && entry.date) ? <button className="p-primary" onClick={() => navigate('plan', undefined, trip.entries.find(entry => entry.place?.id === detail.id)?.date || day)}>View in Plan</button> : <div className="m-place-quick-actions"><button className="p-primary" onClick={() => add(detail, suggestedDay)}>{quickAction} <Icon name="plus" size={16}/></button>{suggestedDay && <button className="p-secondary" onClick={() => add(detail, '')}>Save for later</button>}</div>}</div></Modal>}
  </section>;
}
