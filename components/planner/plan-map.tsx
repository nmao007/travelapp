'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { Entry } from '@/lib/planner';
import { preferEnglishMapLabels } from './map-language';
import { GoogleMapCanvas } from './google-map';
import type { PoiCategory } from '@/lib/poi-service';

type PlanMapProps = { entries: Entry[]; selectedId: string; select: (id: string) => void; label: string };
export function PlanMap(props: PlanMapProps) {
  const [google, setGoogle] = useState<{ googleKey: string; googleMapId: string } | null | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/map-config', { signal: controller.signal }).then(response => response.json()).then(config => {
      if (!controller.signal.aborted) setGoogle(config.provider === 'google' && typeof config.googleKey === 'string' && typeof config.googleMapId === 'string' ? config : null);
    }).catch(() => { if (!controller.signal.aborted) setGoogle(null); });
    return () => controller.abort();
  }, []);
  if (google === undefined) return <div className="p-plan-map" role="status">Loading map…</div>;
  if (google) {
    const points = props.entries.filter(entry => entry.place).map(entry => ({ id: entry.id, name: entry.title, latitude: entry.place!.latitude, longitude: entry.place!.longitude, category: (['Sights','Culture','Nature','Food'].includes(entry.place!.category) ? entry.place!.category : 'Sights') as PoiCategory, planned: !!entry.date, idea: !entry.date }));
    const first = props.entries.find(entry => entry.place)?.place;
    return <div className="p-plan-map"><GoogleMapCanvas keyValue={google.googleKey} mapId={google.googleMapId} points={points} center={{latitude:first?.latitude ?? 0,longitude:first?.longitude ?? 0}} selectedId={props.selectedId} label={`Map of ${props.label}`} onSelect={props.select} onError={() => setGoogle(null)}/></div>;
  }
  return <OpenPlanMap {...props}/>;
}

function OpenPlanMap({ entries, selectedId, select, label }: PlanMapProps) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Array<{ id: string; marker: Marker; element: HTMLButtonElement }>>([]);
  const selectRef = useRef(select);
  selectRef.current = select;
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading map…');
  const markerKey = entries.map(entry => `${entry.id}:${entry.date}:${entry.order}:${entry.place?.latitude}:${entry.place?.longitude}`).join('|');

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
        const first = entries.find(entry => entry.place)?.place;
        const instance = new M.Map({ container: root.current, style: config.style, center: [first?.longitude ?? 0, first?.latitude ?? 0], zoom: 12, attributionControl: false, cooperativeGestures: true });
        instance.addControl(new M.NavigationControl({ showCompass: false }), 'top-right');
        instance.addControl(new M.AttributionControl({ compact: false }), 'bottom-right');
        instance.on('load', () => { if (active) { preferEnglishMapLabels(instance); setReady(true); setStatus(''); } });
        instance.on('error', () => { if (active && !instance.loaded()) setStatus('Map unavailable. Your plan remains in the list.'); });
        map.current = instance;
        observer = new ResizeObserver(() => instance.resize());
        observer.observe(root.current);
      } catch (error) { if (active) setStatus(error instanceof Error ? error.message : 'Map unavailable.'); }
    }
    void initialize();
    return () => { active = false; controller.abort(); observer?.disconnect(); markers.current.forEach(item => item.marker.remove()); markers.current = []; map.current?.remove(); map.current = null; };
    // The map remains mounted while the user changes day and layer filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    let active = true;
    markers.current.forEach(item => item.marker.remove());
    markers.current = [];
    void import('maplibre-gl').then(M => {
      if (!active || !map.current) return;
      const bounds = new M.LngLatBounds();
      const counters = new Map<string, number>();
      for (const entry of entries) {
        if (!entry.place) continue;
        const button = document.createElement('button'); button.type = 'button';
        button.className = `p-plan-pin ${entry.date ? 'scheduled' : 'idea'}`;
        if (entry.id === selectedId) button.classList.add('selected');
        const badge = document.createElement('span'); badge.className = 'p-plan-pin-badge';
        if (entry.date) {
          const number = (counters.get(entry.date) || 0) + 1;
          counters.set(entry.date, number);
          badge.textContent = String(number);
        } else badge.textContent = '★';
        const name = document.createElement('span'); name.className = 'p-plan-pin-name'; name.textContent = entry.title;
        button.append(badge, name);
        button.setAttribute('aria-label', `${entry.title}, ${entry.date || 'saved idea'}`);
        button.addEventListener('click', () => selectRef.current(entry.id));
        const marker = new M.Marker({ element: button, anchor: 'left' }).setLngLat([entry.place.longitude, entry.place.latitude]).addTo(instance);
        markers.current.push({ id: entry.id, marker, element: button });
        bounds.extend([entry.place.longitude, entry.place.latitude]);
      }
      if (!bounds.isEmpty()) instance.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250 });
    });
    return () => { active = false; };
    // The key describes the visible place identities, coordinates and visit order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markerKey]);

  useEffect(() => {
    markers.current.forEach(item => item.element.classList.toggle('selected', item.id === selectedId));
    const chosen = entries.find(entry => entry.id === selectedId)?.place;
    if (chosen && map.current) map.current.easeTo({ center: [chosen.longitude, chosen.latitude], duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220 });
    // Selection should not rebuild the map or its pins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, markerKey]);

  return <div className="p-plan-map"><div ref={root} role="region" aria-label={`Map of ${label}`} />{status && <p role="status">{status}</p>}</div>;
}
