import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { datesForTrip, duplicatePlan, fixedItem, makePlan, removeItineraryEvent } from '@trippilot/core/itinerary-model';
import { flightDayBlock } from '@trippilot/core/flight-window';
import { destinationForDay } from '@trippilot/core/place-model';
import { tripStops } from '@trippilot/core/trip-model';
import { Icon } from '../icons';
import type { SymbolName } from '../icon-symbols';
import { Dropdown } from '../popover';
import { BottomSheet } from '../sheet';
import { autocomplete, newSession, placeDetails, type Suggestion } from '@/lib/places';
import { clockParts, clockTime, formatClock, formatDay } from '@/lib/format';
import { colors, fonts, sq } from '@/lib/theme';
import { zoneOptions } from '@/lib/time-zones';
import type { PlanItem, Trip } from '@/lib/trips';

type Draft = PlanItem & { kind: string; time: string; timeZone: string; notes: string; reference: string };
type Removal = { trip: Trip; removal: unknown };

function Chip({ icon, label, onPress, active, outline, wide, trailing }: { icon?: SymbolName; label: string; onPress(): void; active?: boolean; outline?: boolean; wide?: boolean; trailing?: SymbolName }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress}
      style={({ pressed }) => [styles.chip, wide && styles.chipWide, outline && styles.chipOutline, active && styles.chipActive, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={17} color={active ? colors.action : '#555555'} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive, wide && styles.chipTextWide]}>{label}</Text>
      {trailing ? <Icon name={trailing} size={16} color="#555555" /> : null}
    </Pressable>
  );
}

// The site's #plan-dialog on phones (openPlan / savePlanPatch in itinerary-ui.js).
// Editing an existing plan saves each change at once; a new plan is only added
// when "Add plan" is pressed.
export function PlanSheet({ trip, editing, onClose, commit, onSaved, onDuplicated, onRemoved, onNeedDates }: {
  trip: Trip; editing: { item: PlanItem | null; day: string } | null; onClose(): void; commit(trip: Trip): void;
  onSaved(item: PlanItem): void; onDuplicated(copy: PlanItem): void; onRemoved(result: Removal): void; onNeedDates(): void;
}) {
  const days = datesForTrip(trip) as string[];
  const [saved, setSaved] = useState<PlanItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [more, setMore] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState<{ hour: string; minute: string; period: string }>({ hour: '', minute: '', period: 'AM' });
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);

  const defaultZone = (day: string) => (destinationForDay(trip, tripStops(trip), day) as { timeZone?: string } | null)?.timeZone || trip.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  useEffect(() => {
    if (!editing) return;
    const item = editing.item, day = days.includes(editing.day) ? editing.day : days[0];
    const next = { name: '', day, kind: 'Activity', time: '', timeZone: defaultZone(day), notes: '', reference: '', ...item } as Draft;
    setSaved(item); setDraft(next); setNameEditing(!item); setMore(false); setTimeOpen(false); setNoteOpen(Boolean(next.notes));
    setTypeOpen(false); setPlaceOpen(false); setZoneOpen(false); setDuplicating(false); setError('');
    const [hour, minute, period] = clockParts(next.time); setClock({ hour, minute, period });
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) return null;
  const canDuplicate = Boolean(saved) && !fixedItem(draft) && days.length > 1;

  // savePlanPatch(patch, close) in itinerary-ui.js.
  function save(patch: Partial<Draft> = {}, close?: () => void) {
    const next = { ...draft!, ...patch } as Draft;
    setDraft(next);
    if (!saved && !close) return;
    try {
      const item = makePlan(trip, next, saved as never) as PlanItem;
      const items = trip.items || [];
      commit({ ...trip, items: items.some(entry => entry.id === item.id) ? items.map(entry => entry.id === item.id ? item : entry) : [...items, item] });
      setSaved(item); setDraft({ ...next, ...item } as Draft); setError(''); onSaved(item);
      close?.();
    } catch (failure) { setError((failure as Error).message); }
  }

  function setTime(next: { hour: string; minute: string; period: string }) {
    setClock(next);
    const value = clockTime(next.hour, next.minute || '00', next.period);
    if (value && value !== draft!.time) save({ time: value });
  }

  function chooseDay(day: string) {
    if (!duplicating) { save({ day }); return; }
    try {
      const result = duplicatePlan(trip, saved!.id, day) as { trip: Trip; copy: PlanItem };
      commit(result.trip); setDuplicating(false); onClose(); onDuplicated(result.copy);
    } catch (failure) { setError((failure as Error).message); }
  }

  const kindIcon: SymbolName = draft.kind === 'Food' ? 'food' : draft.kind === 'Stay' ? 'stay' : 'day';
  const dayOptions = days.map(day => {
    const blocked = Boolean(flightDayBlock(trip, day, draft.timeZone || defaultZone(day)));
    return { value: day, label: formatDay(day) + (blocked ? ' · In flight' : ''), disabled: blocked || (duplicating && day === draft.day) };
  });

  return (
    <BottomSheet visible={Boolean(editing)} onClose={() => { setDraft(null); onClose(); }}
      header={close => (
        <View style={styles.heading}>
          {nameEditing ? (
            <TextInput ref={nameRef} style={styles.nameInput} value={draft.name} onChangeText={name => setDraft({ ...draft, name })} placeholder="Plan name" placeholderTextColor={colors.inputPlaceholder}
              autoFocus={!saved} multiline blurOnSubmit returnKeyType="done" accessibilityLabel="Plan name"
              onSubmitEditing={() => { if (!draft.name.trim()) return; setNameEditing(false); save(); }} onEndEditing={() => { if (saved && draft.name.trim()) save(); }} />
          ) : <Text style={styles.name} accessibilityRole="header">{draft.name || 'New plan'}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={nameEditing ? 'Finish editing name' : 'Edit name'} onPress={() => {
            if (nameEditing) { if (!draft.name.trim()) { nameRef.current?.focus(); return; } setNameEditing(false); save(); }
            else { setNameEditing(true); setTimeout(() => nameRef.current?.focus(), 50); }
          }} style={({ pressed }) => [styles.headingButton, pressed && styles.pressed]}>
            <Icon name={nameEditing ? 'check' : 'edit'} size={20} color="#858a94" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={({ pressed }) => [styles.headingButton, styles.closeButton, pressed && styles.pressed]}>
            <Icon name="close" size={18} color="#555555" />
          </Pressable>
        </View>
      )}
      footer={close => (
        <View style={styles.actions}>
          {saved ? (
            <Pressable accessibilityRole="button" onPress={() => {
              try { const result = removeItineraryEvent(trip, 'items', saved.id) as Removal; close(); onRemoved(result); }
              catch (failure) { setError((failure as Error).message); }
            }} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => save({}, close)} style={({ pressed }) => [styles.done, pressed && styles.donePressed]}>
            <Text style={styles.doneText}>{saved ? 'Done' : 'Add plan'}</Text>
          </Pressable>
        </View>
      )}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <View style={styles.dayRow}>
          <Text style={styles.dayLabel}>{duplicating ? 'Duplicate to' : 'Day'}</Text>
          <Dropdown value={draft.day} options={dayOptions} onChange={chooseDay} label={duplicating ? 'Duplicate plan to day' : 'Move plan to day'} fullWidth
            gap={12} triggerStyle={styles.dayTrigger} valueStyle={styles.dayValue} chevronColor="#333333" />
        </View>
        <View style={styles.tools}>
          <Chip icon="clock" label={formatClock(draft.time) || 'Any time'} onPress={() => setTimeOpen(!timeOpen)} />
          <Chip icon="edit" label="Note" onPress={() => setNoteOpen(!noteOpen)} />
          <Chip label="More options" outline wide trailing={more ? 'minus' : 'plus'} onPress={() => setMore(!more)} />
          {more ? (
            <>
              <Chip icon="lock" label={draft.booked ? 'Confirmed' : 'Reservation'} active={Boolean(draft.booked)} onPress={() => save({ booked: !draft.booked })} />
              <Chip icon="pin" label="Place" onPress={() => setPlaceOpen(!placeOpen)} />
              <Chip icon={kindIcon} label={draft.kind} onPress={() => setTypeOpen(!typeOpen)} />
              {canDuplicate ? <Chip icon="copy" label="Duplicate" active={duplicating} onPress={() => { setDuplicating(!duplicating); setError(''); }} /> : null}
            </>
          ) : null}
        </View>
        {more && typeOpen ? (
          <View style={styles.choices}>
            {['Activity', 'Food', 'Stay', 'Transport'].map(kind => <Chip key={kind} label={kind} active={draft.kind === kind} onPress={() => { save({ kind }); setTypeOpen(false); }} />)}
          </View>
        ) : null}
        {more && draft.booked ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Confirmation</Text>
            <TextInput style={styles.input} value={draft.reference} onChangeText={reference => setDraft({ ...draft, reference })} onEndEditing={() => save({ reference: draft.reference })} placeholder="Booking reference" placeholderTextColor={colors.inputPlaceholder} />
          </View>
        ) : null}
        {more && placeOpen ? <PlaceSearch onPick={place => { save({ ...place, name: draft.name.trim() ? draft.name : place.name }); setPlaceOpen(false); }} onError={setError} /> : null}
        {timeOpen ? (
          <View style={styles.timePanel}>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>Local time</Text>
                <View style={styles.timePicker}>
                  <TextInput style={styles.timeNumber} value={clock.hour} onChangeText={hour => setClock({ ...clock, hour: hour.replace(/\D/g, '').slice(0, 2) })} onEndEditing={() => setTime(clock)} placeholder="hh" placeholderTextColor={colors.inputPlaceholder} keyboardType="number-pad" maxLength={2} accessibilityLabel="Hour" />
                  <Text style={styles.colon}>:</Text>
                  <TextInput style={styles.timeNumber} value={clock.minute} onChangeText={minute => setClock({ ...clock, minute: minute.replace(/\D/g, '').slice(0, 2) })} onEndEditing={() => setTime(clock)} placeholder="mm" placeholderTextColor={colors.inputPlaceholder} keyboardType="number-pad" maxLength={2} accessibilityLabel="Minute" />
                  <Dropdown value={clock.period} options={[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]} onChange={period => setTime({ ...clock, period })} label="AM or PM" fullWidth gap={4} triggerStyle={styles.periodTrigger} valueStyle={styles.periodValue} chevronColor="#333333" />
                  <Icon name="clock" size={16} color={colors.muted} />
                </View>
              </View>
              <Pressable accessibilityRole="button" onPress={() => { setClock({ hour: '', minute: '', period: 'AM' }); save({ time: '' }); setTimeOpen(false); }} style={({ pressed }) => [styles.flexible, pressed && styles.pressed]}>
                <Text style={styles.flexibleText}>Flexible</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: zoneOpen }} onPress={() => setZoneOpen(!zoneOpen)} style={styles.zoneSummary}>
              <Text style={styles.zoneLabel}>Time zone</Text>
              <Icon name="chevron" size={16} color={colors.muted} style={zoneOpen ? styles.flipped : undefined} />
            </Pressable>
            {zoneOpen ? <Dropdown value={draft.timeZone} options={zoneOptions(draft.timeZone)} onChange={timeZone => save({ timeZone })} label="Time zone" fullWidth gap={12} triggerStyle={styles.dayTrigger} valueStyle={styles.dayValue} chevronColor="#333333" /> : null}
          </View>
        ) : null}
        {noteOpen ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Note</Text>
            <TextInput style={[styles.input, styles.note]} value={draft.notes} onChangeText={notes => setDraft({ ...draft, notes })} onEndEditing={() => save({ notes: draft.notes })} multiline textAlignVertical="top" accessibilityLabel="Note" />
          </View>
        ) : null}
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      </ScrollView>
    </BottomSheet>
  );
}

// #plan-location-search: any kind of place, through the server's Places search.
function PlaceSearch({ onPick, onError }: { onPick(place: { placeId: string; name: string; address: string; latitude: number; longitude: number }): void; onError(message: string): void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestion[]>([]);
  const session = useRef(newSession()), request = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return (
    <View style={styles.field}>
      <TextInput style={styles.input} value={query} autoFocus placeholder="Find a restaurant, hotel, or place" placeholderTextColor={colors.inputPlaceholder} autoCorrect={false}
        onChangeText={text => {
          setQuery(text); clearTimeout(timer.current); const id = ++request.current, value = text.trim();
          if (value.length < 2) { setResults([]); return; }
          timer.current = setTimeout(async () => {
            try { const found = await autocomplete(value, { scope: 'all', session: session.current }); if (id === request.current) setResults(found); }
            catch { if (id === request.current) { setResults([]); onError('Search is unavailable right now.'); } }
          }, 450);
        }} />
      {results.map(item => (
        <Pressable key={item.placeId} accessibilityRole="button" onPress={async () => {
          try { const place = await placeDetails(item.placeId, session.current); onPick({ placeId: place.placeId, name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude }); }
          catch { onError('Could not open that place. Try another result.'); }
        }} style={({ pressed }) => [styles.result, pressed && styles.pressed]}>
          <View style={styles.resultIcon}><Icon name="pin" size={20} color={colors.action} /></View>
          <View style={styles.resultCopy}>
            <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
            {item.detail ? <Text style={styles.resultDetail} numberOfLines={1}>{item.detail}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.pressed },
  flipped: { transform: [{ rotate: '180deg' }] },
  heading: { minHeight: 77, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 16, borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
  name: { flex: 1, paddingVertical: 6, fontFamily: fonts.bold, fontSize: 25, lineHeight: 31, letterSpacing: -0.7, color: '#30343b' },
  nameInput: { flex: 1, minHeight: 44, paddingVertical: 6, fontFamily: fonts.bold, fontSize: 25, lineHeight: 31, letterSpacing: -0.7, color: '#30343b' },
  headingButton: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  closeButton: { backgroundColor: colors.white },
  body: { flexGrow: 0 },
  bodyContent: { paddingTop: 28, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  dayTrigger: { minHeight: 48, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: '#dddddd', backgroundColor: colors.white, justifyContent: 'space-between' },
  dayValue: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 15, color: '#333333' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexBasis: '45%', flexGrow: 1, minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, gap: 4, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: '#f7f7f7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  chipWide: { flexBasis: '100%', justifyContent: 'space-between' },
  chipOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#eeeeee' },
  // .detail-chip[aria-pressed=true]: tint with a 1px inner line in --sun.
  chipActive: { backgroundColor: '#fff2eb', borderWidth: 1, borderColor: '#ffd9be' },
  chipText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18.2, color: '#555555' },
  chipTextActive: { color: colors.action },
  chipTextWide: { flex: 1 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  input: { minHeight: 48, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.inputLine, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.white, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: '#333333' },
  note: { height: 92 },
  timePanel: { gap: 10, padding: 12, borderWidth: 1, borderColor: '#ececec', backgroundColor: colors.soft },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  timeField: { flex: 1, gap: 8 },
  timePicker: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.inputLine, borderRadius: sq(16), borderCurve: 'continuous', backgroundColor: '#fafbfc' },
  timeNumber: { width: 36, height: 44, textAlign: 'center', fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  colon: { width: 8, textAlign: 'center', fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  periodTrigger: { minHeight: 44, paddingVertical: 7, paddingHorizontal: 5, backgroundColor: colors.white, justifyContent: 'space-between' },
  periodValue: { fontFamily: fonts.regular, fontSize: 16, color: '#333333' },
  flexible: { height: 48, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ececec', borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.white, justifyContent: 'center' },
  flexibleText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  zoneSummary: { minHeight: 45, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ececec', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  zoneLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.danger },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#eeeeee', backgroundColor: colors.white },
  remove: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 12, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, justifyContent: 'center' },
  removeText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18.2, color: colors.danger },
  done: { flex: 1, minHeight: 48, paddingVertical: 12, paddingHorizontal: 19, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  donePressed: { backgroundColor: colors.accentPressed },
  doneText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.white },
  result: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: sq(20), borderCurve: 'continuous' },
  resultIcon: { width: 36, height: 36, borderRadius: sq(13), borderCurve: 'continuous', backgroundColor: '#fff2eb', alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1, minWidth: 0, gap: 3 },
  resultName: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  resultDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
