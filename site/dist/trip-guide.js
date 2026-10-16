import { datesForTrip, eventsForDay } from './itinerary-model.js';
import { stopForDay, tripTitle } from './trip-store.js';
import { directionsMapsURL, placeMapsURL } from './maps-links.js';
import { placeArt } from './place-art.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const date = (value, options = {}) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC', ...options }).format(new Date(`${value}T12:00:00Z`));
const zone = value => String(value || '').replaceAll('_', ' ');
function time(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(value || '')) return 'Time not set';
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}
const paragraph = (value, className = '') => value ? `<p class="${className}">${escape(value)}</p>` : '';
const link = (url, label) => url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${label} ↗</a>` : '';
const symbols = { Food: 'food', Stay: 'stay', Flight: 'plane', Train: 'train', Tour: 'guide', Transport: 'car', Activity: 'pin' };
function activity(item, trip) {
  const info = [paragraph(item.address, 'address')];
  if (item.kind === 'Tour' && item.tour) {
    const tour = item.tour;
    info.push(paragraph([tour.operatorName, tour.durationMinutes ? `${tour.durationMinutes} min` : '', tour.people ? `${tour.people} people` : ''].filter(Boolean).join(' · ')));
    if (tour.meetingName) info.push(paragraph(`Meet at ${tour.meetingName}`));
  }
  if (item.reference) info.push(paragraph(`Confirmation · ${item.reference}`, 'confirmation'));
  if (item.notes) info.push(paragraph(item.notes, 'notes'));
  const maps = placeMapsURL(item);
  return `<article class="event"><div class="art">${placeArt(symbols[item.kind] || 'pin')}</div><div class="event-copy"><header><h3>${escape(item.name)}</h3><span class="time">${item.time ? escape(time(item.time)) : item.booked ? 'Time not set' : 'Flexible'}</span></header>${item.booked ? '<span class="booked">Booked</span>' : ''}${item.time ? paragraph(zone(item.timeZone || trip.timeZone), 'zone') : ''}${info.join('')}<div class="links">${link(maps, 'Place')}${link(directionsMapsURL(item, null, trip.routeMode || 'DRIVE'), 'Directions')}</div></div></article>`;
}
function transport(event) {
  const segment = event.transport, arrival = event.leg === 'arrival', data = segment.flightData || {};
  const legs = arrival ? ['arrival'] : ['departure', 'arrival'];
  const stops = legs.map(leg => `<div class="journey-stop"><span class="eyebrow">${leg === 'arrival' ? 'Arrive' : 'Depart'}</span><strong>${escape(segment[`${leg}_location`])}</strong><span>${escape(date(segment[`${leg}_date`]))} · ${escape(time(segment[`${leg}_time`]))}</span><small>${escape(zone(segment[`${leg}_time_zone`]))}</small>${paragraph([data[`${leg}_terminal`] ? `Terminal ${data[`${leg}_terminal`]}` : '', data[`${leg}_gate`] ? `Gate ${data[`${leg}_gate`]}` : ''].filter(Boolean).join(' · '))}</div>`).join('');
  const checked = data.fetchedAt && Number.isFinite(Date.parse(data.fetchedAt)) ? `Flight details checked ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(data.fetchedAt))} UTC. Recheck with your airline.` : '';
  return `<article class="event flight"><div class="art">${placeArt(segment.mode === 'Train' ? 'train' : 'plane')}</div><div class="event-copy"><header><h3>${escape(segment.service_id)}</h3><span class="time">${arrival ? 'Arrival' : escape(segment.mode)}</span></header>${paragraph(data.airline)}<div class="journey">${stops}</div>${paragraph(segment.notes, 'notes')}${paragraph(checked, 'zone')}</div></article>`;
}
const styles = `
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:20px}body{margin:0;background:#fff;color:#242528;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}main{max-width:800px;margin:auto;padding:36px 24px 60px}.brand{font-weight:800;letter-spacing:-.7px;font-size:17px}.brand b{color:#ec591e}h1{font-size:clamp(30px,7vw,44px);letter-spacing:-1.5px;line-height:1.1;margin:18px 0 10px}h2{font-size:22px;letter-spacing:-.5px;margin:0}h3{font-size:17px;line-height:1.3;margin:0;overflow-wrap:anywhere}p{margin:6px 0;overflow-wrap:anywhere}.sub,.zone,.eyebrow{color:#747478}.sub{margin:0}.saved{font-size:12px;color:#747478;margin:12px 0 22px}.day-nav{display:flex;gap:6px;overflow-x:auto;max-width:100%;padding:0 0 12px;scrollbar-width:thin}.day-nav a{display:grid;place-content:center;flex:0 0 52px;min-height:60px;background:#f6f5f3;border-radius:18px;corner-shape:squircle;color:#444;text-decoration:none;text-align:center;font-size:12px}.day-nav b{font-size:19px;color:#242528}.day{padding-top:28px}.day-title{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;border-bottom:2px solid #f2e8df;padding-bottom:12px}.destination{color:#bc4919;font-size:14px;font-weight:600}.event{display:flex;gap:14px;padding:22px 0;border-bottom:1px solid #eee;break-inside:avoid}.art{display:grid;place-items:center;width:44px;height:46px;flex:0 0 44px;border-radius:17px;corner-shape:squircle;background:#fff3e9}.art svg{width:36px;height:36px}.event-copy{flex:1;min-width:0}.event header{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;justify-content:space-between}.time{font-size:14px;font-weight:600;white-space:nowrap}.booked{display:inline-block;color:#6754a1;font-size:12px;font-weight:600}.zone{font-size:12px}.address{color:#626268}.confirmation{font-size:14px;font-weight:600;overflow-wrap:anywhere}.notes{white-space:pre-wrap}.links{display:flex;gap:20px;flex-wrap:wrap;margin-top:10px}.links a{display:inline-flex;align-items:center;min-height:36px;color:#bc4919;text-decoration:none;font-weight:600;font-size:13px}.flight .art{background:#edf3ff}.journey{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:14px 0}.journey-stop{display:flex;flex-direction:column;min-width:0;overflow-wrap:anywhere}.journey-stop strong{font-size:15px}.journey-stop small{font-size:12px;color:#747478}.eyebrow{font-size:10px;letter-spacing:1px;font-weight:700;text-transform:uppercase}.free{padding:22px 0;color:#85858b}.footer{font-size:12px;color:#747478;margin-top:40px;border-top:1px solid #eee;padding-top:16px}.footer p{margin:4px 0}a:focus-visible{outline:2px solid #ee651f;outline-offset:3px}@media(max-width:480px){main{padding:24px 18px 40px}.event{gap:10px}.art{width:38px;height:42px;flex-basis:38px}.art svg{width:32px;height:32px}.journey{gap:12px}.journey-stop{font-size:13px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{main{max-width:none;padding:0}.day-nav{display:none}.day{padding-top:22px}.day-title{break-after:avoid}a{color:inherit}.links{display:none}.footer{margin-top:24px}.event{padding:16px 0}body{font-size:11pt}}
`;

// A local, script-free document. No keys, account data, provider payloads,
// photos or tracking pixels are embedded, and nothing is fetched on open.
export function exportTripGuide(trip, { now = new Date() } = {}) {
  if (!trip?.id) throw new Error('Open a trip first.');
  const days = datesForTrip(trip);
  if (!days.length) throw new Error('Choose trip dates before saving an itinerary.');
  const included = new Set(days);
  if (days.at(-1) !== trip.endDate) throw new Error('Keep the trip within one year.');
  if ((trip.items || []).some(item => !item.name?.trim() || (item.day !== 'ideas' && !included.has(item.day)))) throw new Error('Check that every plan has a name and a day within the trip.');
  if ((trip.transport || []).some(segment => !['Flight', 'Train'].includes(segment.mode) || !segment.service_id?.trim() || !segment.departure_location || !segment.arrival_location || !included.has(segment.departure_date) || !included.has(segment.arrival_date))) throw new Error('Check the flight or train details before saving an itinerary.');
  const title = tripTitle(trip) || 'Trip';
  const nav = days.map(day => `<a href="#day-${day}" aria-label="${escape(date(day, { weekday: 'long' }))}">${escape(date(day, { weekday: 'short', month: undefined, day: undefined }))}<b>${Number(day.slice(-2))}</b></a>`).join('');
  let lastStop = null, count = 0;
  const sections = days.map(day => {
    const events = eventsForDay(trip, day), stop = stopForDay(trip, day);
    const label = stop?.placeId !== lastStop ? stop?.name : ''; lastStop = stop?.placeId;
    count += events.length;
    return `<section class="day" id="day-${day}"><div class="day-title"><h2>${escape(date(day, { weekday: 'short' }))}</h2>${label ? `<span class="destination">${escape(label)}</span>` : ''}</div>${events.length ? events.map(event => event.kind === 'activity' ? activity(event.item, trip) : transport(event)).join('') : '<p class="free">Free day</p>'}</section>`;
  }).join('');
  const ideas = (trip.items || []).filter(item => item.day === 'ideas');
  const saved = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(now);
  const content = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(title)} · TripPilot</title><style>${styles}</style></head><body><main><div class="brand">TRIP<b>/</b>PILOT</div><h1>${escape(title)}</h1><p class="sub">${escape(date(days[0], { year: 'numeric' }))} – ${escape(date(days.at(-1), { year: 'numeric' }))}</p><p class="saved">Offline itinerary · Saved ${escape(saved)} UTC</p><nav class="day-nav" aria-label="Jump to a day">${nav}</nav>${sections}${ideas.length ? `<section class="day"><div class="day-title"><h2>Saved ideas</h2></div>${ideas.map(item => activity(item, trip)).join('')}</section>` : ''}<footer class="footer"><p>Saved details work offline. Map links need a connection.</p><p>This is a snapshot. Save again after changing your plans.</p></footer></main></body></html>`;
  const name = [...title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/^[.\s]+|[.\s]+$/g, '')].slice(0, 50).join('') || 'Trip';
  return { content, filename: `${name} - itinerary.html`, count };
}

export function downloadTripGuide(trip) {
  const result = exportTripGuide(trip), url = URL.createObjectURL(new Blob([result.content], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.filename; anchor.hidden = true;
  try { document.body.append(anchor); anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
  return result;
}
