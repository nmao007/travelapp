import test from "node:test";
import assert from "node:assert/strict";
import { initialJourney, captureJourney, addBookingToPlan, searchJourney, tripDays } from "../lib/journey.ts";
const form = (values) => { const data=new FormData(); for(const [key,value] of Object.entries(values)) data.set(key,value); return data; };
test("a reservation becomes one plan and edits keep its linked details consistent",()=>{
  const original=initialJourney();
  const linked=addBookingToPlan(original,"return","flight-plan");
  assert.equal(linked.activities.length,original.activities.length+1);
  assert.equal(addBookingToPlan(linked,"return","duplicate"),linked);
  const edited=captureJourney(linked,"booking",form({id:"return",title:"Train home",category:"Transport",date:"2026-10-01",time:"17:00",reference:"TRAIN123",location:"Tokyo Station"}),"unused").state;
  const plan=edited.activities.find((value)=>value.id==="flight-plan");
  assert.equal(plan.category,"Transport");assert.equal(plan.time,"17:00");assert.match(plan.notes,/TRAIN123/);
  assert.equal(original.bookings.find((value)=>value.id==="return").activity_id,undefined);
});
test("capture enforces date, daylight-saving, category and currency constraints",()=>{
  const source=initialJourney();
  assert.ok(captureJourney(source,"activity",form({title:"Late",date:"2026-11-01"}),"id").error);
  assert.ok(captureJourney(source,"expense",form({title:"Fraction",date:"2026-09-27",amount:"1.5"}),"id").error);
  assert.ok(captureJourney(source,"task",form({title:"Bad group",category:"Unknown"}),"id").error);
  const dst={...source,trip:{...source.trip,start_date:"2026-03-08",end_date:"2026-03-09"}};
  assert.match(captureJourney(dst,"activity",form({title:"Missing clock",date:"2026-03-08",time:"02:30",timeZone:"America/New_York"}),"id").error,/does not exist/);
  const result=captureJourney(source,"expense",form({title:"Coffee",date:"2026-09-27",category:"Food",amount:"500"}),"coffee").state;
  assert.equal(result.expenses.at(-1).amount_minor,500);assert.equal(source.expenses.length,2);
});
test("global search finds references, note contents and packing while empty searches stay quiet",()=>{
  const source=initialJourney();
  assert.equal(searchJourney(source,"sample-home48")[0].id,"return");
  assert.equal(searchJourney(source,"sample content")[0].section,"tools");
  assert.ok(searchJourney(source,source.packing[0].name).some((value)=>value.section==="tools"));
  assert.deepEqual(searchJourney(source," "),[]);
  assert.equal(tripDays(source.trip).length,5);
});
