'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map, Marker } from 'maplibre-gl';
import type { Destination } from '@/lib/destination';
import { Icon } from '@/components/journey/icon';

export function DestinationGlobe({choose}: {choose: (destination: Destination) => void}) {
  const root=useRef<HTMLDivElement>(null), choicesRef=useRef<HTMLDivElement>(null), mapRef=useRef<Map | null>(null), markerRef=useRef<Marker | null>(null), requestRef=useRef<AbortController | null>(null);
  const [status,setStatus]=useState('Loading the world…'), [candidates,setCandidates]=useState<Destination[]>([]), [selected,setSelected]=useState<[number,number] | null>(null);
  const [busy,setBusy]=useState(false);
  function discover(latitude: number,longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) return;
    requestRef.current?.abort();const request=new AbortController();requestRef.current=request;
    setCandidates([]);setSelected([latitude,longitude]);setBusy(true);setStatus('Finding nearby places…');
    import('maplibre-gl').then(M => {
      markerRef.current?.remove();
      if (!mapRef.current) return;
      const pin=document.createElement('div');pin.className='d-globe-pin';
      markerRef.current=new M.Marker({element:pin}).setLngLat([longitude,latitude]).addTo(mapRef.current);
    });
    void fetch(`/api/destinations?${new URLSearchParams({lat:String(latitude),lon:String(longitude)})}`,{signal:request.signal})
      .then(async response => {const body=await response.json();if (!response.ok) throw new Error(body.error || 'Could not find places here.');if (!Array.isArray(body.destinations)) throw new Error('Unexpected place response.');return body.destinations as Destination[];})
      .then(results => {if (!request.signal.aborted) {setCandidates(results);setStatus(results.length ? '' : 'No nearby city found. Try another area, or search by name.');}})
      .catch(error => {if (!request.signal.aborted) setStatus(error instanceof Error ? error.message : 'Could not find places here.');})
      .finally(() => {if (!request.signal.aborted) setBusy(false);});
  }
  useEffect(() => {
    if (candidates.length) choicesRef.current?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  },[candidates]);
  useEffect(() => {
    let active=true,map:Map | undefined,observer:ResizeObserver | undefined;
    const controller=new AbortController();
    const timer=setTimeout(() => {if (active) setStatus(value => value === 'Loading the world…' ? 'The globe could not load. Search for a destination instead.' : value);},12000);
    async function initialize() {
      try {
        const response=await fetch('/api/map-config',{signal:controller.signal});const config=await response.json();
        if (!response.ok) throw new Error(config.error || 'The globe is unavailable.');
        const M=await import('maplibre-gl');if (!active || !root.current) return;
        M.setWorkerUrl(config.workerUrl);
        map=new M.Map({container:root.current,style:config.style,center:[2.35,48.86],zoom:root.current.clientWidth<500 ? 0.45 : 1.45,minZoom:0.1,attributionControl:false,renderWorldCopies:false,cooperativeGestures:true});
        mapRef.current=map;
        map.addControl(new M.NavigationControl({showCompass:false}),'top-right');
        map.addControl(new M.AttributionControl({compact:false}),'bottom-right');
        map.on('style.load',() => map?.setProjection({type:'globe'}));
        map.on('load',() => {if (active) {setStatus('');clearTimeout(timer);}});
        map.on('error',() => {if (active) setStatus(value => value === 'Loading the world…' ? 'The globe is unavailable. Search for a destination instead.' : value);});
        map.on('click',event => {
          if (!active || !map) return;
          const visible=map.project(event.lngLat);
          if (Math.hypot(visible.x-event.point.x,visible.y-event.point.y)>8 || !map.queryRenderedFeatures(event.point).some(feature => feature.layer.type !== 'background')) return;
          discover(event.lngLat.lat,event.lngLat.lng);
        });
        observer=new ResizeObserver(() => map?.resize());observer.observe(root.current);
      } catch(error) {if (active) setStatus(error instanceof Error ? error.message : 'The globe is unavailable.');}
    }
    void initialize();
    return () => {active=false;controller.abort();requestRef.current?.abort();clearTimeout(timer);observer?.disconnect();markerRef.current?.remove();mapRef.current=null;map?.remove();};
  // This map is initialized once. The map click handler only calls state setters and refs.
  },[]);
  return <div className="d-globe-section">
    <div className="d-globe-heading"><span>Tap anywhere to find a destination</span><button type="button" className="d-globe-center" onClick={() => {const center=mapRef.current?.getCenter();if (center) discover(center.lat,center.lng);}}><Icon name="pin" size={16}/> Use center</button></div>
    <div className={`d-globe-wrap ${candidates.length ? 'has-results' : ''}`}><div className="d-globe" ref={root} role="region" aria-label="Interactive destination globe. Drag to rotate, zoom, or use find destinations at map center."/>{selected && <span className="d-globe-point" aria-live="polite">Selected area</span>}</div>
    {status && <p className="d-globe-status" role="status">{status}</p>}
    {!!candidates.length && !busy && <div className="d-globe-choices" ref={choicesRef} aria-label="Nearby destinations"><span>Destinations near this point</span>{candidates.map(candidate => <button key={candidate.id} type="button" onClick={() => choose(candidate)}><span><strong>{candidate.name}</strong><small>{[candidate.region,candidate.country].filter(Boolean).join(' · ') || candidate.address}</small></span><Icon name="arrow" size={18}/></button>)}</div>}
  </div>;
}
