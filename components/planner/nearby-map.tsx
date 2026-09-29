'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { Destination } from '@/lib/destination';
import type { Entry } from '@/lib/planner';
import type { Poi, PoiCategory } from '@/lib/poi-service';
import { createPlacePin } from './map-markers';
import { preferEnglishMapLabels } from './map-language';
import { GoogleMapCanvas } from './google-map';
import { kilometers } from '@/lib/recommendations';

const categoryForTrip = (value: string): PoiCategory => ['Sights','Culture','Nature','Food'].includes(value) ? value as PoiCategory : 'Sights';

type NearbyMapProps = {
  destination: Destination;
  initialCenter?: { latitude: number; longitude: number };
  mapLabel?: string;
  places: Poi[];
  tripEntries: Entry[];
  activeId: string;
  selectPlace: (place: Poi) => void;
  selectTrip: (entry: Entry) => void;
  onViewportMove: (center: { latitude: number; longitude: number }) => void;
};

export function NearbyMap(props: NearbyMapProps) {
  const [google, setGoogle] = useState<{ googleKey: string; googleMapId: string } | null | undefined>(undefined);
  const focus = props.initialCenter || props.destination;
  const nearbyTrips = useMemo(() => props.tripEntries.filter(entry => entry.place && kilometers(entry.place, focus) < 15), [props.tripEntries, focus.latitude, focus.longitude]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/map-config', { signal: controller.signal }).then(response => response.json()).then(config => {
      if (!controller.signal.aborted) setGoogle(config.provider === 'google' && typeof config.googleKey === 'string' && typeof config.googleMapId === 'string' ? config : null);
    }).catch(() => { if (!controller.signal.aborted) setGoogle(null); });
    return () => controller.abort();
  }, []);
  if (google === undefined) return <div className="m-nearby-map" role="status">Loading map…</div>;
  if (google) {
    const tripIds = new Set(nearbyTrips.map(entry => entry.place?.id));
    const points = [...props.places.filter(place => !tripIds.has(place.id)).map((place, index) => ({ id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude, category: place.category, compact: index > 6 })), ...nearbyTrips.map(entry => ({ id: entry.place!.id, name: entry.title, latitude: entry.place!.latitude, longitude: entry.place!.longitude, category: categoryForTrip(entry.place!.category), planned: !!entry.date, idea: !entry.date }))];
    return <GoogleMapCanvas keyValue={google.googleKey} mapId={google.googleMapId} points={points} center={props.initialCenter || {latitude:props.destination.latitude,longitude:props.destination.longitude}} selectedId={props.activeId} label={props.mapLabel || `Map of places near ${props.destination.name}`} onSelect={id => { const entry = props.tripEntries.find(item => item.place?.id === id); if (entry) props.selectTrip(entry); else { const place = props.places.find(item => item.id === id); if (place) props.selectPlace(place); } }} onViewportMove={props.onViewportMove} onError={() => setGoogle(null)}/>;
  }
  return <OpenNearbyMap {...props} tripEntries={nearbyTrips}/>;
}

function OpenNearbyMap({ destination, initialCenter, mapLabel, places, tripEntries, activeId, selectPlace, selectTrip, onViewportMove }: NearbyMapProps) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Array<{ id: string; marker: Marker; element: HTMLButtonElement; compact: boolean }>>([]);
  const callbacks = useRef({ selectPlace, selectTrip, onViewportMove });
  callbacks.current = { selectPlace, selectTrip, onViewportMove };
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading map…');

  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    const controller = new AbortController();
    async function initialize() {
      try {
        const response = await fetch('/api/map-config', { signal: controller.signal });
        const config = await response.json();
        if (!response.ok) throw new Error(config.error || 'Map unavailable.');
        const M = await import('maplibre-gl');
        if (!active || !root.current) return;
        M.setWorkerUrl(config.workerUrl);
        const start = initialCenter || destination;
        const instance = new M.Map({ container: root.current, style: config.style, center: [start.longitude, start.latitude], zoom: 12, attributionControl: false, cooperativeGestures: true });
        instance.addControl(new M.NavigationControl({ showCompass: false }), 'top-right');
        instance.addControl(new M.AttributionControl({ compact: false }), 'bottom-right');
        instance.on('load', () => { if (active) { preferEnglishMapLabels(instance); setReady(true); setStatus(''); } });
        instance.on('error', () => { if (active && !instance.loaded()) setStatus('Map could not load. Nearby places remain in the list.'); });
        instance.on('dragend', () => {
          const center = instance.getCenter();
          callbacks.current.onViewportMove({ latitude: center.lat, longitude: center.lng });
        });
        map.current = instance;
        observer = new ResizeObserver(() => instance.resize());
        observer.observe(root.current);
      } catch (error) { if (active) setStatus(error instanceof Error ? error.message : 'Map unavailable.'); }
    }
    void initialize();
    return () => { active = false; controller.abort(); observer?.disconnect(); markers.current.forEach(item => item.marker.remove()); markers.current = []; map.current?.remove(); map.current = null; };
  }, [destination.id, destination.latitude, destination.longitude]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    let active = true;
    markers.current.forEach(item => item.marker.remove());
    markers.current = [];
    void import('maplibre-gl').then(M => {
      if (!active || !map.current) return;
      const tripIds = new Set(tripEntries.map(entry => entry.place?.id));
      const bounds = new M.LngLatBounds();
      const labeled: Array<{ latitude: number; longitude: number }> = [];
      for (const place of places.slice(0, 40)) {
        bounds.extend([place.longitude, place.latitude]);
        if (tripIds.has(place.id)) continue;
        const canLabel = labeled.length < 7 && labeled.every(previous => Math.abs(previous.latitude - place.latitude) > 0.0012 || Math.abs(previous.longitude - place.longitude) > 0.0018);
        if (canLabel) labeled.push(place);
        const button = createPlacePin(place.name, place.category, { compact: !canLabel, selected: place.id === activeId });
        button.addEventListener('click', () => callbacks.current.selectPlace(place));
        const marker = new M.Marker({ element: button, anchor: 'left' }).setLngLat([place.longitude, place.latitude]).addTo(instance);
        markers.current.push({ id: place.id, marker, element: button, compact: !canLabel });
      }
      for (const entry of tripEntries) {
        if (!entry.place) continue;
        const button = createPlacePin(entry.title, categoryForTrip(entry.place.category), { planned: !!entry.date, idea: !entry.date, selected: entry.place.id === activeId });
        button.addEventListener('click', () => callbacks.current.selectTrip(entry));
        const marker = new M.Marker({ element: button, anchor: 'left' }).setLngLat([entry.place.longitude, entry.place.latitude]).addTo(instance);
        markers.current.push({ id: entry.place.id, marker, element: button, compact: false });
      }
      if (!fitted.current && !bounds.isEmpty()) {
        fitted.current = true;
        instance.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
      }
    });
    return () => { active = false; };
  }, [ready, places, tripEntries]);

  useEffect(() => {
    markers.current.forEach(item => { item.element.classList.toggle('selected', item.id === activeId); item.element.classList.toggle('compact', item.compact && item.id !== activeId); });
    const selected = places.find(place => place.id === activeId) || tripEntries.find(entry => entry.place?.id === activeId)?.place;
    if (selected && map.current) map.current.easeTo({ center: [selected.longitude, selected.latitude], duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220 });
  }, [activeId, places, tripEntries]);

  return <div className="m-nearby-map"><div ref={root} role="region" aria-label={mapLabel || `Map of places near ${destination.name}`}/>{status && <span role="status">{status}</span>}</div>;
}
