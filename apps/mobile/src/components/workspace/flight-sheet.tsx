import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { datesForTrip, makeTransport, removeItineraryEvent, upsertTransport } from '@trippilot/core/itinerary-model';
import { normalizeFlightNumber, sameFlightDetails } from '@trippilot/core/flight-model';
import { destinationForDay } from '@trippilot/core/place-model';
import { tripStops } from '@trippilot/core/trip-model';
import { Icon } from '../icons';
import { Dropdown } from '../popover';
import { BottomSheet } from '../sheet';
import { findFlights } from '@/lib/flights';
import { flightForm, formWithFlight, legs, lookupNotes, transportInput, type Flight, type FlightData, type FlightForm, type Leg, type LegForm, type LookupResult } from '@/lib/flight-form';
import { autocomplete, newSession, placeDetails, placeZone, type Suggestion } from '@/lib/places';
import { formatClock, formatDay } from '@/lib/format';
import { colors, fonts, sq } from '@/lib/theme';
import type { Trip } from '@/lib/trips';

type Removal = { trip: Trip; removal: unknown };
const zones = ['UTC', ...((Intl as unknown as { supportedValuesOf?(key: string): string[] }).supportedValuesOf?.('timeZone') ?? [])];
const zoneOptions = zones.map(zone => ({ value: zone, label: zone.replaceAll('_', ' ') }));

// The site's #transport-dialog on phones (openTransport, searchFlight and the
// #transport-form submit in itinerary-ui.js), for flights only. Typing a flight
// number with a departure date looks it up; when lookup isn't connected (no
// AERODATABOX_API_KEY on the server) the same fields are filled in by hand.
// The workspace mounts it for each flight it opens and drops it once closed.
export function FlightSheet({ trip, editing, onClose, commit, onSaved, onRemoved }: {
  trip: Trip; editing: { segment: Flight | null; day: string }; onClose(): void; commit(trip: Trip): void;
  onSaved(segment: Flight): void; onRemoved(result: Removal): void;
}) {
  const days = datesForTrip(trip) as string[];
  const defaultZone = (day: string) => (destinationForDay(trip, tripStops(trip), day) as { timeZone?: string } | null)?.timeZone || trip.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [form, setForm] = useState<FlightForm>(() => flightForm(editing.segment, days.includes(editing.day) ? editing.day : days[0], defaultZone));
  const [lookup, setLookup] = useState<LookupResult | 'loading' | null>(null);
  const [notesOpen, setNotesOpen] = useState(Boolean(editing.segment?.notes));
  const [pendingZones, setPendingZones] = useState(0);
  const [error, setError] = useState('');
  const selected = useRef<FlightData | null>(editing.segment?.flightData || null);
  const automaticArrival = useRef(!editing.segment?.arrival_date);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), request = useRef<AbortController | null>(null);
  const version = useRef(0);
  useEffect(() => () => { clearTimeout(timer.current); request.current?.abort(); }, []);

  const stored = Boolean(editing.segment && (trip.transport || []).some(item => item.id === editing.segment!.id));

  function clearLookup() { clearTimeout(timer.current); request.current?.abort(); request.current = null; setLookup(null); }

  async function search(number: string, date: string) {
    clearLookup();
    const flightNumber = normalizeFlightNumber(number);
    if (!flightNumber || !date) return;
    const controller = new AbortController(); request.current = controller;
    setLookup('loading');
    try {
      const result = await findFlights(flightNumber, date, controller.signal);
      if (!controller.signal.aborted) setLookup(result);
    } catch { /* A newer search or closing the sheet replaced this one. */ }
  }
  function scheduleSearch(number: string, date: string, delay: number) {
    clearLookup();
    timer.current = setTimeout(() => { search(number, date); }, delay);
  }

  function setLeg(key: Leg, patch: Partial<LegForm>) {
    setForm(current => {
      const next = { ...current, [key]: { ...current[key], ...patch } };
      // syncArrivalDate(): until arrival gets its own date, it follows departure.
      if (key === 'departure' && patch.date && automaticArrival.current) next.arrival = { ...next.arrival, date: patch.date };
      return next;
    });
  }

  function choose(flight: FlightData) {
    if (![flight.departure_date, flight.arrival_date].every(day => days.includes(String(day)))) { setError(lookupNotes.outsideTrip); return; }
    automaticArrival.current = false; selected.current = flight; version.current++;
    setForm(formWithFlight(form, flight)); setPendingZones(0); setError(''); clearLookup();
  }

  // An airport picked from search sets that leg's time zone, unless the zone
  // was changed by hand meanwhile (the site's autocomplete for #departure-search).
  async function pickAirport(key: Leg, place: Suggestion, session: string) {
    const ticket = version.current, previousZone = form[key].zone;
    setLeg(key, { location: place.name });
    setPendingZones(count => count + 1);
    try {
      const details = await placeDetails(place.placeId, session);
      const zone = await placeZone(details);
      if (zone && ticket === version.current) setForm(current => current[key].location === place.name && current[key].zone === previousZone ? { ...current, [key]: { ...current[key], zone } } : current);
    } catch { /* Keep the editable time zone. */ }
    finally { if (ticket === version.current) setPendingZones(count => Math.max(0, count - 1)); }
  }

  function save(close: () => void) {
    if (pendingZones) return;
    const segment = editing.segment;
    try {
      const next = makeTransport(trip, transportInput(form, segment?.mode === 'Train' ? 'Train' : 'Flight'), (stored ? segment!.id : undefined) as never) as Flight;
      if (sameFlightDetails(next, selected.current)) next.flightData = selected.current;
      commit(upsertTransport(trip, next) as Trip);
      setError(''); clearLookup(); onSaved(next); close();
    } catch (failure) { setError((failure as Error).message); }
  }

  const dayOptions = days.map(day => ({ value: day, label: formatDay(day) }));
  return (
    <BottomSheet visible onClose={() => { clearLookup(); onClose(); }}
      header={close => (
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{stored ? editing.segment!.service_id || editing.segment!.mode : 'Add flight'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close flight editor" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Icon name="close" size={18} color="#555555" />
          </Pressable>
        </View>
      )}
      footer={close => (
        <View style={styles.actions}>
          {stored ? (
            <Pressable accessibilityRole="button" onPress={() => {
              try { const result = removeItineraryEvent(trip, 'transport', editing.segment!.id) as Removal; clearLookup(); close(); onRemoved(result); }
              catch (failure) { setError((failure as Error).message); }
            }} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: pendingZones > 0 }} disabled={pendingZones > 0} onPress={() => save(close)}
            style={({ pressed }) => [styles.done, pendingZones > 0 && styles.disabled, pressed && styles.donePressed]}>
            <Text style={styles.doneText}>Save</Text>
          </Pressable>
        </View>
      )}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Number</Text>
          <TextInput style={styles.input} value={form.service_id} placeholder="Flight number" placeholderTextColor={colors.inputPlaceholder} maxLength={40}
            autoFocus={!stored} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Flight number"
            onChangeText={service_id => { setForm({ ...form, service_id }); scheduleSearch(service_id, form.departure.date, 900); }} />
        </View>
        {lookup ? <LookupResults lookup={lookup} onChoose={choose} /> : null}
        {legs.map(key => (
          <View key={key} style={styles.leg}>
            <Text style={styles.legTitle} accessibilityRole="header">{key === 'departure' ? 'Departure' : 'Arrival'}</Text>
            <AirportField label={key === 'departure' ? 'Departure airport' : 'Arrival airport'} value={form[key].location}
              onChange={location => setLeg(key, { location })} onPick={(place, session) => pickAirport(key, place, session)} />
            <View style={styles.pair}>
              <View style={[styles.field, styles.pairDate]}>
                <Text style={styles.label}>Date</Text>
                <Dropdown value={form[key].date} options={dayOptions} label={key === 'departure' ? 'Departure date' : 'Arrival date'} fullWidth gap={8}
                  triggerStyle={styles.trigger} valueStyle={styles.triggerValue} chevronColor="#333333"
                  onChange={date => {
                    if (key === 'arrival') automaticArrival.current = false;
                    setLeg(key, { date });
                    if (key === 'departure') scheduleSearch(form.service_id, date, 0);
                  }} />
              </View>
              <View style={[styles.field, styles.pairTime]}>
                <Text style={styles.label}>Local time</Text>
                <ClockField leg={form[key]} label={key === 'departure' ? 'Departure time' : 'Arrival time'} onChange={patch => setLeg(key, patch)} />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Time zone</Text>
              <Dropdown value={form[key].zone} options={zoneOptions} label={key === 'departure' ? 'Departure time zone' : 'Arrival time zone'} fullWidth gap={8}
                triggerStyle={styles.trigger} valueStyle={styles.triggerValue} chevronColor="#333333" onChange={zone => setLeg(key, { zone })} />
            </View>
          </View>
        ))}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: notesOpen }} onPress={() => setNotesOpen(!notesOpen)} style={styles.summary}>
          <Text style={styles.summaryText}>Notes</Text>
          <Icon name="chevron" size={16} color={colors.muted} style={notesOpen ? styles.flipped : undefined} />
        </Pressable>
        {notesOpen ? (
          <TextInput style={[styles.input, styles.notes]} value={form.notes} onChangeText={notes => setForm({ ...form, notes })} multiline maxLength={4000}
            textAlignVertical="top" accessibilityLabel="Flight notes" />
        ) : null}
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      </ScrollView>
    </BottomSheet>
  );
}

// #flight-results: a note, or the matching flights and the AeroDataBox credit.
function LookupResults({ lookup, onChoose }: { lookup: LookupResult | 'loading'; onChoose(flight: FlightData): void }) {
  return (
    <View style={styles.results} accessibilityLiveRegion="polite">
      {lookup === 'loading' ? <Text style={styles.note}>{lookupNotes.finding}</Text>
        : 'note' in lookup ? <Text style={styles.note}>{lookup.note}</Text>
          : (
            <>
              {lookup.flights.map((flight, index) => (
                <Pressable key={`${flight.service_id}:${flight.departure_date}:${flight.departure_time}:${index}`} accessibilityRole="button" onPress={() => onChoose(flight)}
                  style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
                  <Text style={styles.choiceTitle}>{`${flight.service_id} · ${flight.departure_code || flight.departure_location} → ${flight.arrival_code || flight.arrival_location}`}</Text>
                  <Text style={styles.choiceDetail}>{`${formatClock(String(flight.departure_time || ''))} – ${formatClock(String(flight.arrival_time || ''))} · ${flight.airline || flight.status || ''}`}</Text>
                </Pressable>
              ))}
              <Text accessibilityRole="link" onPress={() => Linking.openURL('https://aerodatabox.com')} style={styles.source}>AeroDataBox</Text>
            </>
          )}
    </View>
  );
}

// "Airport or station": free text, with place search suggestions under it.
function AirportField({ label, value, onChange, onPick }: { label: string; value: string; onChange(value: string): void; onPick(place: Suggestion, session: string): void }) {
  const [results, setResults] = useState<Suggestion[]>([]);
  const session = useRef(newSession()), request = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Airport</Text>
      <TextInput style={styles.input} value={value} maxLength={240} autoCorrect={false} accessibilityLabel={label}
        onChangeText={text => {
          onChange(text); clearTimeout(timer.current);
          const id = ++request.current, query = text.trim();
          if (query.length < 2) { setResults([]); return; }
          timer.current = setTimeout(async () => {
            try { const found = await autocomplete(query, { scope: 'all', session: session.current }); if (id === request.current) setResults(found.slice(0, 5)); }
            catch { if (id === request.current) setResults([]); }
          }, 450);
        }} />
      {results.map(item => (
        <Pressable key={item.placeId} accessibilityRole="button" onPress={() => {
          const current = session.current;
          request.current++; setResults([]); session.current = newSession();
          onPick(item, current);
        }} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
          <View style={styles.suggestionIcon}><Icon name="plane" size={18} color={colors.action} /></View>
          <View style={styles.suggestionCopy}>
            <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
            {item.detail ? <Text style={styles.suggestionDetail} numberOfLines={1}>{item.detail}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// The site's .time-picker: hour, minute and AM/PM.
function ClockField({ leg, label, onChange }: { leg: LegForm; label: string; onChange(patch: Partial<LegForm>): void }) {
  return (
    <View style={styles.clock} accessibilityLabel={label}>
      <TextInput style={styles.clockNumber} value={leg.hour} onChangeText={hour => onChange({ hour: hour.replace(/\D/g, '').slice(0, 2) })} placeholder="hh" placeholderTextColor={colors.inputPlaceholder} keyboardType="number-pad" maxLength={2} accessibilityLabel={`${label}, hour`} />
      <Text style={styles.colon}>:</Text>
      <TextInput style={styles.clockNumber} value={leg.minute} onChangeText={minute => onChange({ minute: minute.replace(/\D/g, '').slice(0, 2) })} placeholder="mm" placeholderTextColor={colors.inputPlaceholder} keyboardType="number-pad" maxLength={2} accessibilityLabel={`${label}, minute`} />
      <Dropdown value={leg.period} options={[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]} onChange={period => onChange({ period })} label={`${label}, AM or PM`} fullWidth gap={3}
        triggerStyle={styles.periodTrigger} valueStyle={styles.periodValue} chevronColor="#333333" />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.pressed },
  disabled: { opacity: 0.5 },
  flipped: { transform: [{ rotate: '180deg' }] },
  heading: { minHeight: 77, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, paddingLeft: 20, paddingRight: 16, borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 25, lineHeight: 31, letterSpacing: -0.7, color: '#252525' },
  close: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyContent: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  field: { gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  input: { minHeight: 48, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: '#dddddd', borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.white, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: '#333333' },
  // .transport-legs h3 on phones: 16pt, 18pt above, in the action color.
  leg: { gap: 12 },
  legTitle: { marginTop: 6, fontFamily: fonts.bold, fontSize: 16, color: colors.action },
  // .transport-legs .editor-pair: date and time side by side (1fr / 1.3fr, 12pt apart).
  pair: { flexDirection: 'row', gap: 12 },
  pairDate: { flex: 1, minWidth: 0 },
  pairTime: { flex: 1.3, minWidth: 0 },
  trigger: { minHeight: 48, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: '#dddddd', backgroundColor: colors.white, justifyContent: 'space-between' },
  triggerValue: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 15, color: '#333333' },
  clock: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, borderWidth: 1, borderColor: colors.inputLine, borderRadius: sq(16), borderCurve: 'continuous', backgroundColor: '#fafbfc' },
  clockNumber: { width: 29, height: 44, textAlign: 'center', fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  colon: { width: 6, textAlign: 'center', fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  periodTrigger: { minHeight: 44, paddingVertical: 7, paddingHorizontal: 5, justifyContent: 'space-between' },
  periodValue: { fontFamily: fonts.regular, fontSize: 16, color: '#333333' },
  // .flight-results: a bordered box with the note or one row per match.
  results: { padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: sq(18), borderCurve: 'continuous' },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted },
  choice: { gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  choicePressed: { backgroundColor: '#fff2eb' },
  choiceTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  choiceDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  source: { alignSelf: 'flex-start', marginTop: 4, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.muted },
  suggestion: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingHorizontal: 6, borderRadius: sq(20), borderCurve: 'continuous' },
  suggestionIcon: { width: 36, height: 36, borderRadius: sq(13), borderCurve: 'continuous', backgroundColor: '#fff2eb', alignItems: 'center', justifyContent: 'center' },
  suggestionCopy: { flex: 1, minWidth: 0, gap: 3 },
  suggestionName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  suggestionDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  summary: { minHeight: 45, marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ececec', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  notes: { height: 76 },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.danger },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#eeeeee', backgroundColor: colors.white },
  remove: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 12, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, justifyContent: 'center' },
  removeText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18.2, color: colors.danger },
  done: { flex: 1, minHeight: 48, paddingVertical: 12, paddingHorizontal: 19, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  donePressed: { backgroundColor: colors.accentPressed },
  doneText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.white },
});
