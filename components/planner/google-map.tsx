'use client';
import { useEffect, useRef, useState } from 'react';
import type { PoiCategory } from '@/lib/poi-service';
import { createPlacePin } from './map-markers';

type Position = { lat: number; lng: number };
type GoogleMarker = { map: GoogleMap | null; content: HTMLElement };
type GoogleMap = { panTo: (position: Position) => void; fitBounds: (bounds: GoogleBounds, padding?: number) => void; getCenter: () => { lat: () => number; lng: () => number } | undefined; addListener: (name: string, listener: () => void) => { remove: () => void } };
type GoogleBounds = { extend: (position: Position) => void };
type GoogleApi = { maps: { Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap; LatLngBounds: new () => GoogleBounds; importLibrary: (name: string) => Promise<{ AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleMarker }> } };
type GoogleWindow = Window & { google?: GoogleApi; __tripPilotGoogleReady?: () => void };
let scriptPromise: Promise<GoogleApi> | null = null;
function loadGoogle(key: string): Promise<GoogleApi> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const view = window as GoogleWindow;
    if (view.google?.maps) { resolve(view.google); return; }
    const script = document.createElement('script');
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.search = new URLSearchParams({ key, loading: 'async', language: document.documentElement.lang || 'en', v: 'weekly', callback: '__tripPilotGoogleReady' }).toString();
    const timeout = window.setTimeout(() => { scriptPromise = null; reject(new Error('Google Maps did not load.')); }, 15000);
    view.__tripPilotGoogleReady = () => { window.clearTimeout(timeout); if (view.google?.maps) resolve(view.google); else reject(new Error('Google Maps did not initialize.')); };
    script.onerror = () => { window.clearTimeout(timeout); scriptPromise = null; reject(new Error('Google Maps could not connect.')); };
    script.src = url.toString(); script.async = true; document.head.appendChild(script);
  });
  return scriptPromise;
}

export type GoogleMapPoint = { id: string; name: string; latitude: number; longitude: number; category: PoiCategory; planned?: boolean; idea?: boolean; compact?: boolean };
export function GoogleMapCanvas({ keyValue, mapId, points, center, selectedId, label, onSelect, onViewportMove, onError }: {
  keyValue: string; mapId: string; points: GoogleMapPoint[]; center: { latitude: number; longitude: number }; selectedId: string; label: string;
  onSelect: (id: string) => void; onViewportMove?: (center: { latitude: number; longitude: number }) => void; onError?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null), map = useRef<GoogleMap | null>(null);
  const markers = useRef<Array<{ id: string; marker: GoogleMarker; element: HTMLButtonElement; compact: boolean }>>([]);
  const callback = useRef({ onSelect, onViewportMove }); callback.current = { onSelect, onViewportMove };
  const fitted = useRef(false);
  const [api, setApi] = useState<GoogleApi | null>(null), [status, setStatus] = useState('Loading Google Maps…');
  const markerKey = points.map(point => `${point.id}:${point.latitude}:${point.longitude}:${point.name}:${point.compact}`).join('|');

  useEffect(() => {
    let active = true;
    let listener: { remove: () => void } | null = null;
    void loadGoogle(keyValue).then(loaded => {
      if (!active || !root.current) return;
      const instance = new loaded.maps.Map(root.current, { center: { lat: center.latitude, lng: center.longitude }, zoom: 13, mapId, mapTypeControl: false, fullscreenControl: false, streetViewControl: false, clickableIcons: true, zoomControl: true, gestureHandling: 'cooperative' });
      map.current = instance; setApi(loaded); setStatus('');
      listener = instance.addListener('dragend', () => { const position = instance.getCenter(); if (position) callback.current.onViewportMove?.({ latitude: position.lat(), longitude: position.lng() }); });
    }).catch(error => { if (active) { setStatus(error instanceof Error ? error.message : 'Map unavailable.'); onError?.(); } });
    return () => { active = false; listener?.remove(); markers.current.forEach(item => { item.marker.map = null; }); markers.current = []; map.current = null; };
    // Center is only the initial view; changing day layers should not recreate the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyValue, mapId]);

  useEffect(() => {
    if (!api || !map.current) return;
    let active = true;
    markers.current.forEach(item => { item.marker.map = null; }); markers.current = [];
    void api.maps.importLibrary('marker').then(({ AdvancedMarkerElement }) => {
      if (!active || !map.current) return;
      const bounds = new api.maps.LatLngBounds();
      for (const point of points) {
        const element = createPlacePin(point.name, point.category, { planned: point.planned, idea: point.idea, compact: point.compact, selected: point.id === selectedId });
        element.addEventListener('click', () => callback.current.onSelect(point.id));
        const position = { lat: point.latitude, lng: point.longitude };
        const marker = new AdvancedMarkerElement({ map: map.current, position, content: element, title: point.name });
        markers.current.push({ id: point.id, marker, element, compact: !!point.compact });
        bounds.extend(position);
      }
      if (!fitted.current && points.length) { fitted.current = true; map.current.fitBounds(bounds, 55); }
    }).catch(() => { if (active) { setStatus('Map markers could not load. Places remain in the list.'); onError?.(); } });
    return () => { active = false; };
    // markerKey intentionally changes only when point identity or position changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, markerKey]);

  useEffect(() => {
    markers.current.forEach(item => { item.element.classList.toggle('selected', item.id === selectedId); item.element.classList.toggle('compact', item.compact && item.id !== selectedId); });
    const point = points.find(item => item.id === selectedId);
    if (point && map.current) map.current.panTo({ lat: point.latitude, lng: point.longitude });
  }, [selectedId, markerKey]);

  return <div className="m-nearby-map m-google-map"><div ref={root} role="region" aria-label={label}/>{status && <span role="status">{status}</span>}</div>;
}
