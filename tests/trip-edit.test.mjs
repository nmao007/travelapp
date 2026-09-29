import test from 'node:test';
import assert from 'node:assert/strict';
import {tripFromDestinations} from '../lib/destination.ts';
import {addStop,editableStops,moveStop,reviseTrip} from '../lib/trip-edit.ts';

const lisbon={id:'osm:relation:5400890',name:'Lisbon',country:'Portugal',address:'Lisbon, Portugal',latitude:38.7078,longitude:-9.1366,category:'city',sourceUrl:'https://www.openstreetmap.org/relation/5400890',fetchedAt:'2026-09-27T00:00:00Z',zones:['Europe/Lisbon'],zoneSource:'timezone-boundary-builder'};
const porto={...lisbon,id:'osm:relation:3370764',name:'Porto',address:'Porto, Portugal',latitude:41.1496,longitude:-8.611};
const madrid={...lisbon,id:'osm:relation:532678',name:'Madrid',country:'Spain',address:'Madrid, Spain',latitude:40.4168,longitude:-3.7038,zones:['Europe/Madrid']};
const details={title:'Portugal and Spain',start:'2026-11-04',end:'2026-11-12',travelers:2,pace:'Balanced',budget:null};

test('one trip can hold sourced cities in travel order',()=>{
  const trip=tripFromDestinations([lisbon,porto,madrid],details.start,details.end);
  assert.deepEqual(trip.stops,['Lisbon, Portugal','Porto, Portugal','Madrid, Spain']);
  assert.deepEqual(trip.destinations?.map(item=>item.id),[lisbon.id,porto.id,madrid.id]);
  assert.equal(trip.zone,'Europe/Lisbon');
  assert.throws(()=>tripFromDestinations([lisbon,lisbon]));
});

test('editing route order preserves geography and updates the first stop time zone',()=>{
  const trip=tripFromDestinations([lisbon,porto],details.start,details.end);
  const stops=moveStop(addStop(editableStops(trip),madrid),2,-1);
  const edited=reviseTrip(trip,moveStop(stops,1,-1),details);
  assert.deepEqual(edited.destinations?.map(item=>item.id),[madrid.id,lisbon.id,porto.id]);
  assert.equal(edited.zone,'Europe/Madrid');
  const removed=reviseTrip(edited,editableStops(edited).filter(stop=>stop.destination?.id!==porto.id),details);
  assert.deepEqual(removed.destinations?.map(item=>item.id),[madrid.id,lisbon.id]);
  assert.equal(addStop(editableStops(removed),madrid).length,2);
});

test('editing rejects date changes that strand existing plan items',()=>{
  const trip=tripFromDestinations([lisbon],details.start,details.end);
  trip.entries=[{id:'a',title:'Museum',date:'2026-11-11',type:'activity',time:'',location:'',notes:'',cost:null,paid:false,checklist:[],travelers:[]}];
  assert.throws(()=>reviseTrip(trip,editableStops(trip),{...details,end:'2026-11-08'}),/Move existing plan items/);
});

test('older unsourced stop names remain editable without invented coordinates',()=>{
  const trip=tripFromDestinations([lisbon]);
  const old={...trip,stops:['Somewhere later'],destinations:[]};
  const edited=reviseTrip(old,addStop(editableStops(old),porto),{...details,start:'',end:''});
  assert.deepEqual(edited.stops,['Somewhere later','Porto, Portugal']);
  assert.deepEqual(edited.destinations?.map(item=>item.id),[porto.id]);
});
