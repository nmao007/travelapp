'use client';
import { useEffect, useMemo, useState } from 'react';
import type { PlannerTrip } from '@/lib/planner';
import type { Poi, PoiCategory } from '@/lib/poi-service';
import { dayForArea, kilometers, nearbyPicks } from '@/lib/recommendations';
import { addPlaceToTrip } from '@/lib/itinerary';
import { formatDate } from '@/lib/domain';
import { Icon, type IconName } from '@/components/journey/icon';
import { NearbyMap } from './nearby-map';

const categories: ['All', ...PoiCategory[]] = ['All', 'Sights', 'Culture', 'Nature', 'Food'];
const categoryIcons: Record<PoiCategory, IconName> = { Sights: 'explore', Culture: 'document', Nature: 'globe', Food: 'food' };
function balanced(places: Poi[]): Poi[] {
  const result: Poi[] = [];
  for (let index = 0; index < 8; index++) for (const category of categories.slice(1)) {
    const place = places.filter(item => item.category === category)[index]; if (place) result.push(place);
  }
  return result.slice(0, 24);
}

export function NearbyExplore({ trip, update, day, openDetails, openPlan }: {
  trip: PlannerTrip; update: (trip: PlannerTrip) => void; day: string; openDetails: () => void; openPlan: (date?: string) => void;
}) {
  const destinations = trip.destinations || [];
  const [selectedId, setSelectedId] = useState(destinations[0]?.id || '');
  const [places, setPlaces] = useState<Poi[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [active, setActive] = useState<Poi | null>(null), [activeTripId, setActiveTripId] = useState('');
  const [notice, setNotice] = useState(''), [retry, setRetry] = useState(0), [expanded, setExpanded] = useState(false);
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingCenter, setPendingCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [resultsCenter, setResultsCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapReset, setMapReset] = useState(0);
  const [nearMe, setNearMe] = useState(false), [locating, setLocating] = useState(false), [locationError, setLocationError] = useState('');
  const destination = destinations.find(item => item.id === selectedId) || destinations[0];
  const queryCenter = center || (destination ? { latitude: destination.latitude, longitude: destination.longitude } : null);
  const suggestedDay = destination && queryCenter && kilometers(queryCenter, destination) < 10 ? dayForArea(trip, day, destination) : '';
  const tripPlaces = useMemo(() => trip.entries.filter(entry => entry.place), [trip.entries]);
  const existingByPlace = useMemo(() => new Map(tripPlaces.map(entry => [entry.place!.id, entry])), [tripPlaces]);
  const activeTrip = trip.entries.find(entry => entry.id === activeTripId);

  useEffect(() => {
    if (!queryCenter) return;
    const controller = new AbortController(); setBusy(true); setError(''); setActive(null); setActiveTripId('');
    void fetch(`/api/recommendations?${new URLSearchParams({ lat: String(queryCenter.latitude), lon: String(queryCenter.longitude) })}`, { signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Nearby places are unavailable.'); if (!Array.isArray(body.places)) throw new Error('Unexpected nearby response.'); return body.places as Poi[]; })
      .then(results => { if (!controller.signal.aborted) { setPlaces(results); setResultsCenter(queryCenter); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Nearby places are unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [queryCenter?.latitude, queryCenter?.longitude, retry]);
  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => setNotice(''), 4200); return () => window.clearTimeout(timeout); }, [notice]);
  const visible = useMemo(() => category === 'All' ? balanced(places) : places.filter(place => place.category === category).slice(0, 24), [places, category]);
  const picks = useMemo(() => category === 'All' && queryCenter ? nearbyPicks(visible, trip, suggestedDay, queryCenter) : [], [visible, trip, suggestedDay, queryCenter?.latitude, queryCenter?.longitude, category]);
  const pickIds = new Set(picks.map(pick => pick.place.id));
  const morePlaces = category === 'All' ? visible.filter(place => !pickIds.has(place.id)) : visible;
  const listed = expanded ? morePlaces : morePlaces.slice(0, 6);
  const showingPrevious = !!(resultsCenter && queryCenter && (resultsCenter.latitude.toFixed(3) !== queryCenter.latitude.toFixed(3) || resultsCenter.longitude.toFixed(3) !== queryCenter.longitude.toFixed(3)));

  function add(place: Poi, date: string) {
    const result = addPlaceToTrip(trip, place, date); if (result.trip !== trip) update(result.trip);
    setActiveTripId(result.entry.id); setActive(null);
    setNotice(result.action === 'already' ? `${place.name} is already in your trip.` : result.action === 'scheduled' ? `${place.name} moved to ${formatDate(date)}.` : `${place.name} added to ${date ? formatDate(date) : 'Ideas'}.`);
  }
  function chooseDestination(id: string) { setSelectedId(id); setCenter(null); setNearMe(false); setLocationError(''); setPendingCenter(null); setResultsCenter(null); setCategory('All'); setNotice(''); setPlaces([]); setExpanded(false); setMapReset(value => value + 1); }
  function searchThisArea() { if (!pendingCenter) return; setCenter(pendingCenter); setNearMe(false); setPendingCenter(null); setCategory('All'); setExpanded(false); setNotice(''); }
  function findNearMe() {
    if (!navigator.geolocation) { setLocationError('Location is unavailable on this device. Move the map to explore another area.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(position => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCenter(next); setNearMe(true); setPendingCenter(null); setResultsCenter(null); setPlaces([]); setExpanded(false); setCategory('All'); setMapReset(value => value + 1); setLocating(false);
    }, () => { setLocating(false); setLocationError('Location was not shared. Choose a city or move the map instead.'); }, { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false });
  }
  function onViewportMove(next: { latitude: number; longitude: number }) { setPendingCenter({ latitude: Math.max(-90, Math.min(90, next.latitude)), longitude: ((next.longitude + 180) % 360 + 360) % 360 - 180 }); }
  function focusPlace(place: Poi) { setActive(place); setActiveTripId(''); }
  const quickAction = suggestedDay ? `Add to ${formatDate(suggestedDay, { month: 'short', day: 'numeric' })}` : 'Save to Ideas';
  if (!destination) return <div className="m-nearby-empty"><Icon name="globe" size={28}/><h2>Choose a place to explore</h2><p>This trip needs a verified destination on the map.</p><button className="p-primary" onClick={openDetails}>Edit destinations</button></div>;

  return <div className="m-nearby"><div className="m-nearby-top"><div><h2>{nearMe ? 'Near you' : center ? 'Explore this area' : `Around ${destination.name}`}</h2><p>{busy ? 'Finding places…' : error ? 'Showing the last loaded area' : 'Real places from OpenStreetMap'}</p></div><div className="m-nearby-top-actions">{destinations.length > 1 && <div className="m-destination-picks" role="group" aria-label="Explore destination">{destinations.map(item => <button key={item.id} type="button" aria-pressed={!center && destination.id === item.id} onClick={() => chooseDestination(item.id)}>{item.name}</button>)}</div>}<button type="button" className="m-near-me" disabled={locating} onClick={findNearMe}><Icon name="pin" size={15}/>{locating ? 'Locating…' : 'Near me'}</button></div></div>
    <div className="m-nearby-layout"><div className="m-nearby-results"><div className="m-nearby-categories" aria-label="Place types">{categories.map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => { setCategory(value); setExpanded(false); }}>{value}</button>)}</div>
      {error && <div className="m-nearby-error" role="alert"><span>{error}{visible.length ? ' Previous results remain visible.' : ''}</span><button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
      {locationError && <p className="m-location-error" role="alert">{locationError}</p>}
      {busy && !!visible.length && <div className="m-nearby-progress" role="status">Updating places…</div>}
      {notice && <p className="m-nearby-notice" role="status"><Icon name="check" size={16}/>{notice}</p>}
      {!busy && !error && !visible.length && <div className="m-quiet-empty">No mapped places found here. Move the map or search by name.</div>}
      {category === 'All' && !!picks.length && <section className="m-nearby-picks"><div className="m-nearby-section-head"><h3>{picks.some(pick => pick.reason === 'Near your day plan') ? 'Near your plan' : 'Start nearby'}</h3><span>Based on distance · check hours before visiting</span></div><div className="m-pick-grid">{picks.map(({ place, reason }) => { const existing = existingByPlace.get(place.id); return <article key={place.id} className={`m-pick-card m-pick-${place.category.toLowerCase()}`}><button className="m-pick-main" type="button" onClick={() => focusPlace(place)}><span className="m-pick-icon"><Icon name={categoryIcons[place.category]} size={18}/></span><small>{place.category} · {reason}</small><strong>{place.name}</strong>{place.nativeName && <span className="m-native-name">{place.nativeName}</span>}</button><button className="m-pick-action" type="button" onClick={() => existing ? openPlan(existing.date || day) : add(place, suggestedDay)}>{existing ? 'In your trip →' : `${quickAction} →`}</button></article>; })}</div></section>}
      {!!listed.length && <section className="m-nearby-more"><div className="m-nearby-section-head"><h3>{category === 'All' ? 'More nearby' : category}</h3><span>{showingPrevious ? 'Previous map area' : `${visible.length} mapped places`}</span></div><div className="m-nearby-cards">{listed.map(place => { const existing = existingByPlace.get(place.id); return <article key={place.id} className={active?.id === place.id ? 'active' : ''}><span className={`m-list-place-icon m-list-${place.category.toLowerCase()}`}><Icon name={categoryIcons[place.category]} size={17}/></span><button className="m-nearby-card-main" onClick={() => focusPlace(place)}><strong>{place.name}</strong><small>{place.nativeName ? `${place.nativeName} · ` : ''}{place.distanceKm} km away{place.address ? ` · ${place.address}` : ''}</small></button><button type="button" aria-label={existing ? `View ${place.name} in Plan` : `${quickAction}: ${place.name}`} title={existing ? 'In your trip' : quickAction} onClick={() => existing ? openPlan(existing.date || day) : add(place, suggestedDay)}><Icon name={existing ? 'check' : 'plus'} size={17}/></button></article>; })}</div>{morePlaces.length > listed.length && <button type="button" className="m-show-more" onClick={() => setExpanded(true)}>Show {morePlaces.length - listed.length} more places <Icon name="chevron" size={15}/></button>}</section>}
    </div><aside><div className="m-map-discovery"><NearbyMap key={`${destination.id}-${mapReset}`} destination={destination} initialCenter={center || undefined} mapLabel={nearMe ? 'Map of places near your location' : center ? 'Map of this area' : undefined} places={visible} tripEntries={tripPlaces} activeId={activeTrip?.place?.id || active?.id || ''} selectPlace={focusPlace} selectTrip={entry => { setActiveTripId(entry.id); setActive(null); }} onViewportMove={onViewportMove}/>{pendingCenter && <button type="button" className="m-search-area" onClick={searchThisArea}><Icon name="search" size={15}/> Search this area</button>}</div>{center && <button type="button" className="m-area-reset" onClick={() => { setCenter(null); setNearMe(false); setPendingCenter(null); setResultsCenter(null); setPlaces([]); setMapReset(value => value + 1); }}>Back to {destination.name}</button>}
      {active && <div className="m-nearby-selected"><div><span>{active.category} · {active.distanceKm} km away</span><button type="button" aria-label="Close place details" onClick={() => setActive(null)}><Icon name="close" size={16}/></button></div><h3>{active.name}</h3>{active.nativeName && <p className="m-native-name">Locally: {active.nativeName}</p>}<p>{active.address || 'Address not listed'}</p>{active.hoursText && <p>Listed hours: {active.hoursText} · verify before visiting</p>}<div className="m-place-links">{active.website && <a href={active.website} target="_blank" rel="noreferrer">Website ↗</a>}{active.phone && <a href={`tel:${active.phone.replace(/[^+\d]/g, '')}`}>Call</a>}<a href={active.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></div>{existingByPlace.has(active.id) && !(suggestedDay && !existingByPlace.get(active.id)?.date) ? <button className="p-primary" onClick={() => openPlan(existingByPlace.get(active.id)?.date)}>View in Plan <Icon name="arrow" size={16}/></button> : <><button className="p-primary" onClick={() => add(active, suggestedDay)}>{quickAction} <Icon name="plus" size={16}/></button>{suggestedDay && <button className="m-detail-secondary" onClick={() => add(active, '')}>Save as an idea</button>}</>}</div>}
      {activeTrip && <div className="m-nearby-selected"><div><span>{activeTrip.date ? `Planned · ${formatDate(activeTrip.date)}` : 'Saved idea'}</span><button type="button" aria-label="Close place details" onClick={() => setActiveTripId('')}><Icon name="close" size={16}/></button></div><h3>{activeTrip.title}</h3><p>{activeTrip.place?.address || activeTrip.location || 'Address not listed'}</p><button className="p-primary" onClick={() => openPlan(activeTrip.date)}>View in Plan <Icon name="arrow" size={16}/></button></div>}
    </aside></div><p className="m-provider-label"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p></div>;
}
