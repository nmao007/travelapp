'use client';
import { useEffect, useRef, useState } from 'react';
import type { Destination } from '@/lib/destination';
import type { Map } from 'maplibre-gl';
export function DestinationMap({destination}: {destination: Destination}) {
  const root = useRef<HTMLDivElement>(null);
  const [state,setState] = useState('Loading map…');
  useEffect(() => {
    let active=true, map: Map | undefined, observer: ResizeObserver | undefined, loaded=false;
    const controller=new AbortController();
    const timer=setTimeout(() => {if (active && !loaded) setState('Map could not load. Your destination is still selected.');},12000);
    async function initialize() {
      try {
        const response=await fetch('/api/map-config',{signal:controller.signal});const config=await response.json();
        if (!response.ok) throw new Error(config.error || 'Map is unavailable.');
        const M=await import('maplibre-gl');if (!active || !root.current) return;
        M.setWorkerUrl(config.workerUrl);
        map=new M.Map({container:root.current,style:config.style,center:[destination.longitude,destination.latitude],zoom:10.5,attributionControl:false,renderWorldCopies:false,cooperativeGestures:true});
        map.addControl(new M.NavigationControl({showCompass:false}),'top-right');
        map.addControl(new M.AttributionControl({compact:false}),'bottom-right');
        const marker=document.createElement('div');marker.className='d-vector-marker';marker.setAttribute('aria-label',destination.name);
        new M.Marker({element:marker}).setLngLat([destination.longitude,destination.latitude]).addTo(map);
        map.on('load',() => {if (active) {loaded=true;setState('');clearTimeout(timer);}});
        map.on('error',() => {if (active && !loaded) setState('Map is unavailable. Your destination is still selected.');});
        observer=new ResizeObserver(() => {map?.resize();map?.setCenter([destination.longitude,destination.latitude]);});observer.observe(root.current);
      } catch (error) {if (active) setState(error instanceof Error ? error.message : 'Map is unavailable.');}
    }
    initialize();
    return () => {active=false;controller.abort();clearTimeout(timer);observer?.disconnect();map?.remove();};
  },[destination]);
  return <div className="d-map-wrap"><div className="d-map" ref={root} role="region" aria-label={`Map of ${destination.name}`}/>{state && <p className="d-map-state" role="status">{state}</p>}</div>;
}
