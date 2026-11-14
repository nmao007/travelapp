import { activityInstant } from './domain.js';
export const isTourOperator = place => place?.primaryType === 'tour_agency' || (place?.primaryType === 'travel_agency' && place?.tourOperator === true);
export function tourDetails(input) {
  if (!input || typeof input.operatorPlaceId !== 'string' || !input.operatorPlaceId.trim() || input.operatorPlaceId.length > 300 || typeof input.operatorName !== 'string' || !input.operatorName.trim() || input.operatorName.length > 160) throw new Error('Choose a tour operator.');
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 30 || input.durationMinutes > 1440) throw new Error('Choose a tour duration between 30 minutes and 24 hours.');
  if (!Number.isInteger(input.people) || input.people < 1 || input.people > 50) throw new Error('Choose a group size between 1 and 50 people.');
  if (input.meetingName !== undefined && (typeof input.meetingName !== 'string' || input.meetingName.length > 160)) throw new Error('Choose a valid meeting point.');
  const hasOffice = input.operatorLatitude !== undefined || input.operatorLongitude !== undefined;
  if (hasOffice && (!Number.isFinite(input.operatorLatitude) || Math.abs(input.operatorLatitude) > 90 || !Number.isFinite(input.operatorLongitude) || Math.abs(input.operatorLongitude) > 180)) throw new Error('Choose a valid operator location.');
  return { ...(input.meetingName ? { meetingName: input.meetingName.trim() } : {}), ...(hasOffice ? { operatorLatitude: input.operatorLatitude, operatorLongitude: input.operatorLongitude } : {}), operatorPlaceId: input.operatorPlaceId.trim(), operatorName: input.operatorName.trim(), durationMinutes: input.durationMinutes, people: input.people };
}
export function tourDraft(operator) {
  if (!isTourOperator(operator)) throw new Error('Choose a tour operator.');
  // The operator office is deliberately separate from a confirmed meeting point.
  return { name: `Tour with ${operator.name}`.slice(0, 160), kind: 'Tour', booked: false, tour: tourDetails({ operatorPlaceId: operator.placeId, operatorName: operator.name, ...(Number.isFinite(operator.latitude) && Number.isFinite(operator.longitude) ? { operatorLatitude: operator.latitude, operatorLongitude: operator.longitude } : {}), durationMinutes: 120, people: 1 }) };
}
export function tourSummary(tour) {
  const minutes = tour.durationMinutes, hours = Math.floor(minutes / 60), rest = minutes % 60;
  return `${hours ? `${hours} hr` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest} min` : ''} · ${tour.people} ${tour.people === 1 ? 'person' : 'people'}`;
}

export function tourEndLabel(item) {
  if (!item.time || !item.tour) return '';
  const start = activityInstant({ date: item.day, time: item.time, time_zone: item.timeZone || 'UTC' });
  if (start === null) return '';
  const end = new Date(start + item.tour.durationMinutes * 60000), zone = item.timeZone || 'UTC';
  const date = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone }).format(end);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).format(end);
  return `Ends ${time}${date !== item.day ? ` · ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: zone }).format(end)}` : ''}`;
}
