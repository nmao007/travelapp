import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { addStop, removeStop, reorderStops, setStopDates, stopSchedule, tripStops } from '@trippilot/core/trip-model';
import { Icon } from '../icons';
import { BottomSheet, afterSheetCloses } from '../sheet';
import { RangeCalendar } from './trip-dates-sheet';
import { stopRangeLabel } from './chrome';
import { autocomplete, newSession, placeDetails, placeZone, type Place, type Suggestion } from '@/lib/places';
import { formatDay } from '@/lib/format';
import { colors, fonts, sq } from '@/lib/theme';
import type { Stop, Trip } from '@/lib/trips';

export type StopSheetState = null | { kind: 'search' } | { kind: 'dates'; placeId: string } | { kind: 'order' };
type Entry = { stop: Stop; start: string | null; end: string | null; index: number };
const dateLabel = (value: string) => formatDay(value, { month: 'short', day: 'numeric' });

// The site's #route-search (add or edit a stop) and #route-order-dialog.
export function StopSheets({ state, trip, commit, onClose, onError, onStopAdded, onStopRemoved }: {
  state: StopSheetState; trip: Trip; commit(trip: Trip): void; onClose(): void; onError(message: string): void; onStopAdded(placeId: string): void; onStopRemoved(): void;
}) {
  const [reorderAfter, setReorderAfter] = useState(false);
  return (
    <>
      <StopEditor visible={state?.kind === 'search' || state?.kind === 'dates'} editing={state?.kind === 'dates' ? state.placeId : null} trip={trip} commit={commit}
        onClose={() => { if (reorderAfter) { setReorderAfter(false); return; } onClose(); }} onError={onError} onStopAdded={onStopAdded} onStopRemoved={onStopRemoved}
        onReorder={() => setReorderAfter(true)} />
      <RouteOrder visible={state?.kind === 'order' || reorderAfter} trip={trip} commit={commit} onClose={() => { setReorderAfter(false); onClose(); }} onError={onError} />
    </>
  );
}

function StopEditor({ visible, editing, trip, commit, onClose, onError, onStopAdded, onStopRemoved, onReorder }: {
  visible: boolean; editing: string | null; trip: Trip; commit(trip: Trip): void; onClose(): void; onError(message: string): void; onStopAdded(placeId: string): void; onStopRemoved(): void; onReorder(): void;
}) {
  const [pending, setPending] = useState<Place | Stop | null>(null);
  const [dates, setDates] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<{ text: string; error: boolean }>({ text: '', error: false });
  const [calendar, setCalendar] = useState<null | 'start' | 'end'>(null);
  const session = useRef(newSession()), request = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const entries = stopSchedule(trip) as Entry[];

  // renderStopDraft(): start where the stop already is, or after the last stop.
  function draft(place: Place | Stop) {
    const entry = entries.find(item => item.stop.placeId === place.placeId);
    const initial = entry?.start || entries.at(-1)?.end || '';
    setPending(place); setResults([]); setStatus({ text: '', error: false });
    setDates({ start: initial, end: entry?.end || initial });
  }
  useEffect(() => {
    if (!visible) return;
    setQuery(''); setResults([]); setStatus({ text: '', error: false }); session.current = newSession();
    const stop = editing ? (tripStops(trip) as Stop[]).find(item => item.placeId === editing) : null;
    if (stop) draft(stop); else setPending(null);
  }, [visible, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  function search(text: string) {
    setQuery(text); clearTimeout(timer.current); setStatus({ text: '', error: false });
    const value = text.trim(), id = ++request.current;
    if (value.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const found = await autocomplete(value, { session: session.current });
        if (id !== request.current) return;
        setResults(found); if (!found.length) setStatus({ text: 'No destinations found. Try another name.', error: false });
      } catch { if (id === request.current) { setResults([]); setStatus({ text: 'Search is unavailable right now.', error: false }); } }
    }, 450);
  }

  async function choose(item: Suggestion) {
    setResults([]); setStatus({ text: 'Opening destination…', error: false });
    try {
      const place = await placeDetails(item.placeId, session.current);
      if ((tripStops(trip) as Stop[]).some(stop => stop.placeId === place.placeId)) { setStatus({ text: 'That destination is already on this trip.', error: false }); return; }
      setQuery(''); draft(place);
    } catch { setStatus({ text: 'Could not open that place. Try another result.', error: false }); }
  }

  function save(close: () => void) {
    if (!pending) return;
    try {
      let next = (editing ? trip : addStop(trip, pending)) as Trip;
      if (!editing && next !== trip) {
        const stops = tripStops(next) as Stop[], destination = stops.at(-1)!, origin = stops.at(-2);
        if (origin) next = { ...next, transport: [...(next.transport || []), { id: crypto.randomUUID(), trip_id: next.id, mode: 'Flight', service_id: '', departure_location: origin.name, arrival_location: destination.name, departure_date: '', departure_time: '', departure_time_zone: origin.timeZone || next.timeZone || 'UTC', arrival_date: '', arrival_time: '', arrival_time_zone: destination.timeZone || next.timeZone || 'UTC', notes: '', draft: true, leg: 'transfer', fromPlaceId: origin.placeId, toPlaceId: destination.placeId }] };
      }
      if (dates.start || dates.end) next = setStopDates(next, pending.placeId, dates.start, dates.end, { extendTrip: true }) as Trip;
      const stop = (tripStops(next) as Stop[]).find(item => item.placeId === pending.placeId)!;
      commit(next); close(); onStopAdded(stop.placeId);
      onError(editing ? 'Stop dates updated' : `Added ${stop.name}`);
      if (!stop.timeZone) placeZone(stop).then(timeZone => {
        if (timeZone) commit({ ...next, stops: (tripStops(next) as Stop[]).map(item => item.placeId === stop.placeId ? { ...item, timeZone } : item) });
      });
    } catch (error) { setStatus({ text: (error as Error).message || 'Could not save this stop.', error: true }); }
  }

  const extendsTrip = dates.start && dates.end && (!trip.startDate || dates.start < trip.startDate || !trip.endDate || dates.end > trip.endDate);
  return (
    <BottomSheet visible={visible} onClose={onClose}
      header={close => (
        <View style={styles.heading}>
          <Text style={styles.title}>{editing ? 'Edit stop' : 'Add stop'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close destination picker" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Icon name="close" size={18} color="#555555" /></Pressable>
        </View>
      )}>
      {close => (
        <ScrollView keyboardDismissMode="interactive" style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {!pending ? (
            <>
              <View style={styles.searchField}>
                <Icon name="search" size={20} color={colors.action} />
                <TextInput style={styles.searchInput} value={query} onChangeText={search} autoFocus placeholder="City or region" placeholderTextColor={colors.inputPlaceholder} autoCorrect={false} accessibilityLabel="Find another destination" clearButtonMode="while-editing" />
              </View>
              {results.map(item => (
                <Pressable key={item.placeId} accessibilityRole="button" onPress={() => choose(item)} style={({ pressed }) => [styles.result, pressed && styles.pressed]}>
                  <View style={styles.resultIcon}><Icon name="pin" size={20} color={colors.action} /></View>
                  <View style={styles.resultCopy}>
                    <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                    {item.detail ? <Text style={styles.resultDetail} numberOfLines={1}>{item.detail}</Text> : null}
                  </View>
                  <Icon name="arrow" size={20} color={colors.muted} />
                </Pressable>
              ))}
            </>
          ) : (
            <View style={styles.panel}>
              <View style={styles.selection}>
                <View style={styles.selectionIcon}><Icon name="map" size={28} color={colors.action} /></View>
                <View style={styles.selectionCopy}>
                  <Text style={styles.selectionName} numberOfLines={2}>{pending.name}</Text>
                  {pending.address ? <Text style={styles.selectionAddress} numberOfLines={2}>{pending.address}</Text> : null}
                </View>
                {!editing ? <Pressable accessibilityRole="button" accessibilityLabel="Change destination" onPress={() => setPending(null)} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Icon name="search" size={18} color="#555555" /></Pressable> : null}
              </View>
              <View style={styles.dateFields}>
                {(['start', 'end'] as const).map(key => (
                  <View key={key} style={styles.dateField}>
                    <Text style={styles.dateLabel}>{key === 'start' ? 'Arrival' : 'Departure'}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${key === 'start' ? 'Arrival' : 'Departure'}: ${dates[key] ? formatDay(dates[key]) : 'Set date'}`} onPress={() => setCalendar(key)} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
                      <Icon name="calendar" size={18} color={colors.action} />
                      <Text style={styles.dateValue}>{dates[key] ? formatDay(dates[key]) : 'Set date'}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              {extendsTrip ? <Text style={styles.effect}>{`Trip dates will extend to ${dateLabel(trip.startDate && trip.startDate < dates.start ? trip.startDate : dates.start)} – ${dateLabel(trip.endDate && trip.endDate > dates.end ? trip.endDate : dates.end)}.`}</Text> : null}
              {editing ? (
                <View style={styles.routeActions}>
                  {entries.length > 1 ? <Pressable accessibilityRole="button" onPress={() => { close(); afterSheetCloses(onReorder); }} style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}><Icon name="list" size={17} color="#555555" /><Text style={styles.quietText}>Reorder</Text></Pressable> : null}
                  <Pressable accessibilityRole="button" disabled={entries.length < 2} onPress={() => {
                    try { const name = pending.name; commit(removeStop(trip, pending.placeId) as Trip); close(); onStopRemoved(); onError(`Removed ${name}`); }
                    catch (error) { setStatus({ text: (error as Error).message, error: true }); }
                  }} style={({ pressed }) => [styles.quiet, entries.length < 2 && styles.disabled, pressed && styles.pressed]}>
                    <Icon name="trash" size={17} color={colors.danger} /><Text style={[styles.quietText, styles.danger]}>Remove</Text>
                  </Pressable>
                </View>
              ) : null}
              <Pressable accessibilityRole="button" onPress={() => save(close)} style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}>
                <Text style={styles.primaryText}>{editing ? 'Save changes' : 'Add stop'}</Text>
                <Icon name="arrow" size={20} color={colors.white} />
              </Pressable>
            </View>
          )}
          {status.text ? <Text style={[styles.status, status.error && styles.danger]}>{status.text}</Text> : null}
          <StopCalendar visible={Boolean(calendar)} name={pending?.name || ''} endpoint={calendar || 'start'} initial={dates} onClose={() => setCalendar(null)}
            onSave={range => {
              try { if (pending) setStopDates(editing ? trip : addStop(trip, pending), pending.placeId, range.start, range.end, { extendTrip: true }); }
              catch (error) { return (error as Error).message; }
              setDates(range); setStatus({ text: '', error: false }); return null;
            }} />
        </ScrollView>
      )}
    </BottomSheet>
  );
}

// #edit-date-picker in its "stop" context: "<Stop> dates", then "Use dates".
function StopCalendar({ visible, name, endpoint, initial, onClose, onSave }: { visible: boolean; name: string; endpoint: 'start' | 'end'; initial: { start: string; end: string }; onClose(): void; onSave(range: { start: string; end: string }): string | null }) {
  const [range, setRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [active, setActive] = useState<'start' | 'end'>('start');
  const [view, setView] = useState({ year: 2026, month: 0 });
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!visible) return;
    setRange({ start: initial.start || null, end: initial.end || null }); setActive(endpoint); setMessage('');
    const date = new Date(`${(initial[endpoint] || initial.start || new Date().toISOString().slice(0, 10))}T12:00:00Z`);
    setView({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <BottomSheet visible={visible} onClose={onClose}
      header={close => (
        <View style={styles.heading}>
          <Text style={[styles.title, styles.dateTitle]}>{`${name} dates`}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close date calendar" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Icon name="close" size={18} color="#555555" /></Pressable>
        </View>
      )}
      footer={close => (
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" disabled={!range.start || !range.end} onPress={() => { const error = onSave({ start: range.start!, end: range.end! }); if (error) setMessage(error); else close(); }}
            style={({ pressed }) => [styles.primary, (!range.start || !range.end) && styles.disabled, pressed && styles.primaryPressed]}>
            <Text style={styles.primaryText}>Use dates</Text><Icon name="arrow" size={18} color={colors.white} />
          </Pressable>
        </View>
      )}>
      <View style={styles.calendarBody}>
        <Text style={styles.hint}>Choose arrival and departure.</Text>
        <View style={styles.summary}>
          {(['start', 'end'] as const).map(key => (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active === key }} onPress={() => setActive(key)} style={[styles.endpoint, active === key && styles.endpointActive]}>
              <Text style={styles.endpointLabel}>{key === 'start' ? 'Arrival' : 'Departure'}</Text>
              <Text style={[styles.endpointValue, active === key && styles.endpointValueActive]}>{range[key] ? formatDay(range[key]!) : 'Choose a day'}</Text>
            </Pressable>
          ))}
        </View>
        <RangeCalendar range={range} view={view} onView={setView} onPick={date => {
          if (active === 'start' || !range.start) { setRange({ start: date, end: range.end && range.end >= date ? range.end : null }); setActive('end'); }
          else if (date < range.start) { setMessage('Choose an end date on or after the start.'); return; }
          else setRange({ ...range, end: date });
          setMessage('');
        }} />
        {message ? <Text style={[styles.status, styles.danger]}>{message}</Text> : null}
      </View>
    </BottomSheet>
  );
}

// #route-order-dialog: move stops earlier or later; each stay keeps its length
// and its plans (reorderStops in trip-model.js).
function RouteOrder({ visible, trip, commit, onClose, onError }: { visible: boolean; trip: Trip; commit(trip: Trip): void; onClose(): void; onError(message: string): void }) {
  const [base, setBase] = useState<Trip | null>(null);
  const [preview, setPreview] = useState<Trip | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    setBase(trip); setPreview(trip); setOrder((tripStops(trip) as Stop[]).map(stop => stop.placeId)); setError('');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!preview || !base) return null;
  const entries = stopSchedule(preview) as Entry[];
  const move = (id: string, step: number) => {
    const from = order.indexOf(id), to = from + step;
    if (to < 0 || to >= order.length) return;
    const next = [...order]; [next[from], next[to]] = [next[to], next[from]];
    try { setPreview(reorderStops(base, next) as Trip); setOrder(next); setError(''); }
    catch (failure) { setError((failure as Error).message); }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose}
      header={close => (
        <View style={styles.heading}>
          <Text style={styles.title}>Reorder stops</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel route changes" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Icon name="close" size={18} color="#555555" /></Pressable>
        </View>
      )}
      footer={close => (
        <View style={[styles.footer, styles.orderActions]}>
          <Pressable accessibilityRole="button" onPress={close} style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}><Text style={styles.quietText}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={preview === base} onPress={() => {
            if (trip !== base) { setError('The trip changed. Close and reopen to review the latest route.'); return; }
            commit(preview); close(); onError('Route updated · plans moved with your stops');
          }} style={({ pressed }) => [styles.primary, styles.orderSave, preview === base && styles.disabled, pressed && styles.primaryPressed]}>
            <Text style={styles.primaryText}>Save order</Text>
          </Pressable>
        </View>
      )}>
      <View style={styles.orderBody}>
        {(base.transport || []).some(segment => !segment.draft) ? <Text style={styles.hint}>Booked flights and trains stay on their dates.</Text> : null}
        {entries.map((entry, index) => (
          <View key={entry.stop.placeId} style={styles.orderRow}>
            <Text style={styles.orderNumber}>{index + 1}</Text>
            <View style={styles.orderCopy}>
              <Text style={styles.stopName} numberOfLines={1}>{entry.stop.name}</Text>
              <Text style={styles.stopRange}>{stopRangeLabel(entry)}</Text>
            </View>
            {[-1, 1].map(step => (
              <Pressable key={step} accessibilityRole="button" accessibilityLabel={`Move ${entry.stop.name} ${step < 0 ? 'earlier' : 'later'}`} disabled={index + step < 0 || index + step >= entries.length}
                onPress={() => move(entry.stop.placeId, step)} style={({ pressed }) => [styles.close, (index + step < 0 || index + step >= entries.length) && styles.disabled, pressed && styles.pressed]}>
                <Icon name="chevron" size={18} color="#555555" style={step < 0 ? { transform: [{ rotate: '180deg' }] } : undefined} />
              </Pressable>
            ))}
          </View>
        ))}
        {error ? <Text style={[styles.status, styles.danger]}>{error}</Text> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.pressed },
  disabled: { opacity: 0.4 },
  danger: { color: colors.danger },
  heading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 16, paddingHorizontal: 16 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 24, lineHeight: 28.8, letterSpacing: -0.96, color: '#252525' },
  dateTitle: { fontSize: 20, lineHeight: 25, letterSpacing: -0.5 },
  close: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 8 },
  searchField: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.inputLine, borderRadius: sq(18), borderCurve: 'continuous', backgroundColor: '#fafbfc' },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  result: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: sq(20), borderCurve: 'continuous' },
  resultIcon: { width: 36, height: 36, borderRadius: sq(13), borderCurve: 'continuous', backgroundColor: '#fff2eb', alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1, minWidth: 0, gap: 3 },
  resultName: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  resultDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  status: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.muted },
  panel: { paddingTop: 4, gap: 16 },
  selection: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: sq(4), borderCurve: 'continuous', backgroundColor: '#fff2eb' },
  selectionIcon: { width: 28, alignItems: 'center' },
  selectionCopy: { flex: 1, minWidth: 0 },
  selectionName: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26.4, letterSpacing: -0.88, color: colors.ink },
  selectionAddress: { marginTop: 6, fontFamily: fonts.regular, fontSize: 14, lineHeight: 18.9, color: colors.muted },
  dateFields: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1, gap: 8 },
  dateLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  dateButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderWidth: 1, borderColor: '#ececec', borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.white },
  dateValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  effect: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  routeActions: { flexDirection: 'row', gap: 8 },
  quiet: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 12, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft },
  quietText: { fontFamily: fonts.medium, fontSize: 14, color: '#555555' },
  primary: { minHeight: 48, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accentPressed },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.white },
  footer: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 },
  calendarBody: { paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: '#777777' },
  summary: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: sq(20), borderCurve: 'continuous', backgroundColor: colors.soft },
  endpoint: { flex: 1, minHeight: 52, paddingVertical: 6, paddingHorizontal: 10, gap: 2, borderRadius: sq(16), borderCurve: 'continuous' },
  endpointActive: { backgroundColor: '#fff0e7' },
  endpointLabel: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: '#777a82' },
  endpointValue: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.muted },
  endpointValueActive: { color: '#ac451c' },
  orderBody: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
  orderRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
  orderNumber: { width: 24, textAlign: 'center', fontFamily: fonts.bold, fontSize: 14, color: colors.action },
  orderCopy: { flex: 1, minWidth: 0, gap: 2 },
  stopName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  stopRange: { fontFamily: fonts.regular, fontSize: 13, color: '#777777' },
  orderActions: { flexDirection: 'row', gap: 12 },
  orderSave: { flex: 1 },
});
