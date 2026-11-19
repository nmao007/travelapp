import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { calendarMonth } from '@trippilot/core/date-range';
import { changeTripDates, dateOffset, offsetDate, shiftTripDays } from '@trippilot/core/trip-dates';
import { calendarStopOnDay, calendarStops } from '@trippilot/core/calendar-stops';
import { scheduleUnassigned } from '@trippilot/core/place-model';
import { setStopDates, stopSchedule } from '@trippilot/core/trip-model';
import { Icon } from '../icons';
import { BottomSheet } from '../sheet';
import { stopRangeLabel } from './chrome';
import { formatDay } from '@/lib/format';
import { colors, fonts, sq } from '@/lib/theme';
import type { Trip } from '@/lib/trips';

type Range = { start: string | null; end: string | null };
type Entry = { stop: Trip['stops'][number]; start: string | null; end: string | null; index: number; color: string };
const monthOf = (value: string | null) => { const date = value ? new Date(`${value}T12:00:00Z`) : new Date(); return { year: date.getUTCFullYear(), month: date.getUTCMonth() }; };

// The calendar grid of #edit-date-picker: Monday first, with the chosen
// endpoints filled and the days between tinted.
export function RangeCalendar({ range, view, onView, onPick }: { range: Range; view: { year: number; month: number }; onView(view: { year: number; month: number }): void; onPick(date: string): void }) {
  const label = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(view.year, view.month, 1)));
  const step = (delta: number) => { const date = new Date(Date.UTC(view.year, view.month + delta, 1)); onView({ year: date.getUTCFullYear(), month: date.getUTCMonth() }); };
  return (
    <View>
      <View style={styles.calendarHead}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => step(-1)} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}><Icon name="back" width={16} height={20} color="#555b66" /></Pressable>
        <Text style={styles.monthLabel}>{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => step(1)} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}><Icon name="arrow" width={16} height={20} color="#555b66" /></Pressable>
      </View>
      <View style={styles.grid}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={index} style={styles.weekday}>{day}</Text>)}
        {(calendarMonth(view.year, view.month) as (string | null)[]).map((date, index) => {
          if (!date) return <View key={`blank-${index}`} style={styles.day} />;
          const selected = date === range.start || date === range.end;
          const between = Boolean(range.start && range.end && date > range.start && date < range.end);
          return (
            <Pressable key={date} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}
              onPress={() => onPick(date)} style={({ pressed }) => [styles.day, selected && styles.selected, between && styles.between, pressed && !selected && !between && styles.pressed]}>
              <Text style={[styles.dayNumber, selected && styles.selectedText, between && styles.betweenText]}>{Number(date.slice(-2))}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Trip dates: "Move trip" shifts every plan and stop together; "Change range"
// keeps plans on their dates. Stops can be edited inline (stop-inline).
export function TripDatesSheet({ visible, trip, onClose, commit, onError, onReorder, onSaved }: { visible: boolean; trip: Trip; onClose(): void; commit(trip: Trip): void; onError(message: string): void; onReorder?(): void; onSaved?(): void }) {
  const [range, setRange] = useState<Range>({ start: null, end: null });
  const [endpoint, setEndpoint] = useState<'start' | 'end'>('start');
  const [moving, setMoving] = useState(false);
  const [view, setView] = useState(monthOf(null));
  const [message, setMessage] = useState('');
  const [inline, setInline] = useState<{ stop: Entry['stop']; back: { range: Range; endpoint: 'start' | 'end'; view: { year: number; month: number } } } | null>(null);

  useEffect(() => {
    if (!visible) return;
    const start = trip.startDate || null, end = trip.endDate || null;
    setRange({ start, end }); setEndpoint('start'); setMoving(Boolean(start)); setView(monthOf(start)); setMessage(''); setInline(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const context = inline ? 'stop' : 'trip';
  const shift = context === 'trip' && moving && trip.startDate && range.start ? dateOffset(trip.startDate, range.start) : 0;
  const previewTrip = context === 'trip' ? { ...shiftTripDays(trip, shift), startDate: range.start, endDate: range.end } : trip;
  const entries = calendarStops(previewTrip) as Entry[];
  const hint = moving && context === 'trip'
    ? (shift ? `All plans move ${Math.abs(shift)} ${Math.abs(shift) === 1 ? 'day' : 'days'} ${shift > 0 ? 'later' : 'earlier'}.` : 'Choose a new start. Plans move together.')
    : context === 'trip' ? 'Choose a start and end. Plans keep their dates.' : 'Choose arrival and departure.';

  function pick(date: string) {
    if (endpoint === 'start' || !range.start) {
      const shiftedEnd = context === 'trip' && moving && range.start && range.end ? offsetDate(range.end, dateOffset(range.start, date)) : null;
      setRange({ start: date, end: shiftedEnd || (range.end && range.end >= date ? range.end : null) });
      setEndpoint(context === 'trip' && moving ? 'start' : 'end');
    } else if (date < range.start) { setMessage('Choose an end date on or after the start.'); return; }
    else setRange({ ...range, end: date });
    setMessage('');
  }

  function save(close: () => void) {
    const { start, end } = range;
    if (!start || !end) return;
    if (inline) {
      let updated: Trip;
      try { updated = setStopDates(trip, inline.stop.placeId, start, end, { extendTrip: true }) as Trip; commit(updated); }
      catch (error) { setMessage((error as Error).message); return; }
      // backFromStopCalendar(true): show the trip's dates as they are now.
      setRange({ start: updated.startDate || null, end: updated.endDate || null }); setEndpoint(inline.back.endpoint); setView(inline.back.view); setInline(null);
      return;
    }
    let next: Trip;
    try { next = changeTripDates(trip, start, end, { movePlans: moving }) as Trip; }
    catch (error) { setMessage((error as Error).message); return; }
    commit(scheduleUnassigned(next) as Trip); close(); onSaved?.(); onError('Trip dates updated');
  }

  const title = inline ? `${inline.stop.name} dates` : 'Trip dates';
  const saveLabel = moving && context === 'trip' ? 'Move trip' : context === 'trip' ? 'Save dates' : 'Save stop dates';
  return (
    <BottomSheet visible={visible} onClose={onClose}
      header={close => (
        <View style={styles.heading}>
          {inline ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back to trip dates" onPress={() => { setRange(inline.back.range); setEndpoint(inline.back.endpoint); setView(inline.back.view); setInline(null); setMessage(''); }} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Icon name="back" size={18} color="#555555" />
            </Pressable>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close date calendar" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Icon name="close" size={18} color="#555555" /></Pressable>
        </View>
      )}
      footer={close => (
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" disabled={!range.start || !range.end} onPress={() => save(close)} style={({ pressed }) => [styles.save, (!range.start || !range.end) && styles.disabled, pressed && styles.savePressed]}>
            <Text style={styles.saveText}>{saveLabel}</Text>
            <Icon name="arrow" size={18} color={colors.white} />
          </Pressable>
        </View>
      )}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {context === 'trip' && trip.startDate ? (
          <View style={styles.modes}>
            {[['move', 'Move trip'], ['range', 'Change range']].map(([key, label]) => {
              const active = (key === 'move') === moving;
              return (
                <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => {
                  const nextMoving = key === 'move'; setMoving(nextMoving); setEndpoint('start'); setMessage('');
                  if (nextMoving && range.start && trip.startDate && trip.endDate) setRange({ start: range.start, end: offsetDate(trip.endDate, dateOffset(trip.startDate, range.start)) });
                }} style={[styles.mode, active && styles.modeActive]}>
                  <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Text style={styles.hint}>{hint}</Text>
        <View style={styles.summary}>
          {(['start', 'end'] as const).map(key => {
            const active = endpoint === key, value = range[key];
            return (
              <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} disabled={key === 'end' && moving && context === 'trip'}
                onPress={() => { setEndpoint(key); if (value) setView(monthOf(value)); }} style={[styles.endpoint, active && styles.endpointActive]}>
                <Text style={styles.endpointLabel}>{context === 'trip' ? (key === 'start' ? 'Start' : 'End') : (key === 'start' ? 'Arrival' : 'Departure')}</Text>
                <Text style={[styles.endpointValue, active && styles.endpointValueActive]}>{value ? formatDay(value) : 'Choose a day'}</Text>
              </Pressable>
            );
          })}
        </View>
        <RangeCalendar range={range} view={view} onView={setView} onPick={pick} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {context === 'trip' && entries.length > 1 ? (
          <View style={styles.stops}>
            <View style={styles.stopsHeading}>
              <Text style={styles.stopsLabel}>Stops</Text>
              {onReorder ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Reorder stops" onPress={onReorder} style={({ pressed }) => [styles.reorder, pressed && styles.pressed]}>
                  <Icon name="list" size={17} color={colors.action} /><Text style={styles.reorderText}>Reorder</Text>
                </Pressable>
              ) : null}
            </View>
            {entries.map(entry => (
              <Pressable key={entry.stop.placeId} accessibilityRole="button" disabled={Boolean(shift)} accessibilityLabel={`Edit ${entry.stop.name} stop dates, ${stopRangeLabel(entry)}`}
                onPress={() => {
                  const saved = (stopSchedule(trip) as Entry[]).find(item => item.stop.placeId === entry.stop.placeId);
                  setInline({ stop: entry.stop, back: { range, endpoint, view } }); setEndpoint('start'); setMessage('');
                  setRange({ start: saved?.start || null, end: saved?.end || null }); if (saved?.start) setView(monthOf(saved.start));
                }} style={({ pressed }) => [styles.stopRow, pressed && styles.pressed, shift ? styles.disabled : null]}>
                <Text style={styles.stopName} numberOfLines={1}>{entry.stop.name}</Text>
                <Text style={styles.stopRange}>{stopRangeLabel(entry)}</Text>
                <Icon name="edit" size={17} color="#888888" />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

// Exact sevenths so a short last week keeps its column widths.
const cell = { width: '14.2857%', height: 44 } as const;
const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.pressed },
  disabled: { opacity: 0.4 },
  heading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16, paddingHorizontal: 20, marginBottom: 10 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.5, color: '#252525' },
  close: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyContent: { paddingLeft: 20, paddingRight: 26, gap: 10, paddingBottom: 12 },
  modes: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: sq(16), borderCurve: 'continuous', backgroundColor: colors.soft },
  mode: { flex: 1, height: 42, borderRadius: sq(13), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  modeActive: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  modeText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  modeTextActive: { color: '#b94d22' },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: '#777777' },
  summary: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: sq(20), borderCurve: 'continuous', backgroundColor: colors.soft },
  endpoint: { flex: 1, minHeight: 52, paddingVertical: 6, paddingHorizontal: 10, gap: 2, borderRadius: sq(16), borderCurve: 'continuous' },
  endpointActive: { backgroundColor: '#fff0e7' },
  endpointLabel: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: '#777a82' },
  endpointValue: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.muted },
  endpointValueActive: { color: '#ac451c' },
  calendarHead: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  grid: { marginTop: 2, flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', paddingVertical: 5, textAlign: 'center', fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, color: '#888888' },
  day: { ...cell, borderRadius: sq(14), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: '#ed703d' },
  between: { backgroundColor: '#fff2e9' },
  dayNumber: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  selectedText: { color: colors.white },
  betweenText: { color: '#a94b26' },
  message: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
  stops: { marginTop: 4, borderTopWidth: 1, borderTopColor: '#eeeeee', paddingTop: 6 },
  stopsHeading: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stopsLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  reorder: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, borderRadius: sq(22), borderCurve: 'continuous' },
  reorderText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.action },
  stopRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
  stopName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  stopRange: { fontFamily: fonts.regular, fontSize: 13, color: '#777777' },
  footer: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 12 },
  save: { minHeight: 48, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.accent },
  savePressed: { backgroundColor: colors.accentPressed },
  saveText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
});
