import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, TIGHT_SCALE } from '@/components/text';
import { calendarDisplayCells, datesForTrip, eventsForDay, monthsForTrip } from '@trippilot/core/itinerary-model';
import { calendarStopOnDay, calendarStops } from '@trippilot/core/calendar-stops';
import { flightDayBlock } from '@trippilot/core/flight-window';
import { datesForStop, stopForPlan, tripStops } from '@trippilot/core/trip-model';
import { destinationForDay } from '@trippilot/core/place-model';
import { Icon } from '../icons';
import { Accent, DashedButton, Display } from '../ui';
import { DayCard, TimelineRow } from './plan-row';
import { FlightCard, FlightRow } from './flight-row';
import { DropZone } from './plan-drag';
import type { Flight, Leg } from '@/lib/flight-form';
import { formatDay, rangeLabel } from '@/lib/format';
import { palette, radii, strokes, typefaces } from '@/lib/design';
import { haptics } from '@/lib/haptics';
import type { PlanItem, Trip } from '@/lib/trips';

type Handlers = { onOpen(item: PlanItem): void; onOpenFlight(segment: Flight): void; renderHandle?(item: PlanItem): React.ReactNode };

export type DayEvent = { kind: 'activity'; key: string; item: PlanItem } | { kind: 'transport'; key: string; leg: Leg; transport: Flight };
type CoreEvent = { kind: 'activity'; id: string; item: PlanItem } | { kind: 'transport'; id: string; leg: Leg; transport: Flight };

// stopEvents() in itinerary-ui.js: the day's plans within the chosen stop, and
// every booked flight leaving or landing that day, in itinerary order. The key
// is the event's key in trip.dayOrder (itineraryEventKey), used for drops.
export function dayEvents(trip: Trip, day: string, stopFilter: string | null): DayEvent[] {
  return (eventsForDay(trip, day) as CoreEvent[]).flatMap((event): DayEvent[] => {
    if (event.kind === 'transport') return event.transport.draft ? [] : [{ kind: 'transport', key: `transport:${event.id}:${event.leg}`, leg: event.leg, transport: event.transport }];
    return !stopFilter || stopForPlan(trip, event.item)?.placeId === stopFilter ? [{ kind: 'activity', key: event.item.id, item: event.item }] : [];
  });
}
export const scopedDays = (trip: Trip, stopFilter: string | null): string[] => stopFilter ? datesForStop(trip, stopFilter) : datesForTrip(trip);

// Each day of the whole trip: its heading ("Sat, Nov 14 *arrival*" and
// "Open day ›"), then its plans and flights on one white card, or a dashed
// "Free day so far · + Add" row. A divider marks moving on to the next stop.
export function Timeline({ trip, stopFilter, onChooseDay, onChooseDates, onSetStopDates, onAddPlan, ...handlers }: Handlers & {
  trip: Trip; stopFilter: string | null; onChooseDay(day: string): void; onChooseDates(): void; onSetStopDates(): void; onAddPlan(day: string): void;
}) {
  const allDays = datesForTrip(trip) as string[], days = scopedDays(trip, stopFilter);
  const stops = tripStops(trip) as Trip['stops'];
  if (!allDays.length) {
    return (
      <View style={styles.timeline}>
        <DashedButton label="Choose your dates" onPress={onChooseDates} />
        {trip.items.length ? (
          <View style={styles.dayCard}>
            {trip.items.map((item, index) => <TimelineRow key={item.id} item={item} onOpen={handlers.onOpen} dragHandle={handlers.renderHandle?.(item)} last={index === trip.items.length - 1} />)}
          </View>
        ) : null}
      </View>
    );
  }
  if (!days.length) return <DashedButton label="Set this stop's dates" onPress={onSetStopDates} />;
  return (
    <View style={styles.timeline}>
      {days.map((day, index) => {
        const events = dayEvents(trip, day, stopFilter);
        const tag = day === allDays[0] ? 'arrival' : day === allDays[allDays.length - 1] ? 'last day' : '';
        const stop = stops.length > 1 && !stopFilter ? destinationForDay(trip, stops, day) as Trip['stops'][number] | null : null;
        const previous = index && stop ? destinationForDay(trip, stops, days[index - 1]) as Trip['stops'][number] | null : null;
        return (
          <View key={day}>
            {stop && previous && stop.placeId !== previous.placeId ? (
              <View style={styles.travelDivider} accessibilityRole="text">
                <View style={styles.travelLine} />
                <Text style={styles.travelPill}>{`${formatDay(day, { weekday: 'short', day: 'numeric' })} · on to ${stop.name}`}</Text>
                <View style={styles.travelLine} />
              </View>
            ) : null}
            <DropZone kind="day" id={day} day={day}><View style={styles.daySection}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}. Open day`} onPress={() => onChooseDay(day)} style={styles.dayHeading}>
                <Display size="section" style={styles.flex}>
                  {formatDay(day)}
                  {tag ? <Accent color={palette.muted}>{` ${tag}`}</Accent> : null}
                </Display>
                <Text style={styles.openDay}>Open day ›</Text>
              </Pressable>
              {events.length ? (
                <View style={styles.dayCard}>
                  {events.map((event, position) => (
                    <DropZone key={event.key} kind="row" id={event.key} day={day}>
                      <EventRow event={event} last={position === events.length - 1} {...handlers} />
                    </DropZone>
                  ))}
                </View>
              ) : <DashedButton label="Free day so far" trailing="+ Add" onPress={() => onAddPlan(day)} />}
            </View></DropZone>
          </View>
        );
      })}
    </View>
  );
}

// A plan or flight as a row in the whole-trip list.
function EventRow({ event, onOpen, onOpenFlight, renderHandle, last }: Handlers & { event: DayEvent; last?: boolean }) {
  if (event.kind === 'transport') return <FlightRow segment={event.transport} leg={event.leg} onOpen={onOpenFlight} last={last} />;
  return <TimelineRow item={event.item} onOpen={onOpen} dragHandle={renderHandle?.(event.item)} last={last} />;
}

// One day: a row of day chips (with the month calendar at the end), the
// day's heading, its plans as cards with flights as tickets, and "+ Add".
export function DayView({ trip, day, days, stopFilter, onDay, onMonth, onFindPlaces, ...handlers }: Handlers & {
  trip: Trip; day: string; days: string[]; stopFilter: string | null; onDay(day: string): void; onMonth(): void; onFindPlaces(): void;
}) {
  const events = dayEvents(trip, day, stopFilter);
  const inFlight = flightDayBlock(trip, day);
  const allDays = datesForTrip(trip) as string[];
  const tag = day === allDays[0] ? 'arrival day' : day === allDays[allDays.length - 1] ? 'last day' : formatDay(day, { month: 'short', day: 'numeric' });
  const stops = tripStops(trip) as Trip['stops'];
  const stop = destinationForDay(trip, stops, day) as Trip['stops'][number] | null;
  return (
    <View style={styles.dayView}>
      <DayStrip trip={trip} day={day} days={days} stopFilter={stopFilter} onDay={onDay} onMonth={onMonth} />
      <View>
        <Display size="sheet" accessibilityRole="header">{formatDay(day, { weekday: 'long' })} <Accent>{tag}</Accent></Display>
        <Text style={styles.dayContext}>{`${stop?.name || trip.name} · ${events.length} ${events.length === 1 ? 'plan' : 'plans'}`}</Text>
      </View>
      {inFlight ? (
        <View style={styles.inFlight}>
          <Icon name="plane" size={18} color={palette.ink} strokeWidth={2.2} />
          <Text style={styles.inFlightText}>{`In the air · ${inFlight.flights.map((flight: { service_id?: string }) => flight.service_id).filter(Boolean).join(' / ')}`}</Text>
        </View>
      ) : null}
      <DropZone kind="day" id={day} day={day}><View style={styles.dayCardList}>
        {events.map(event => (
          <DropZone key={event.key} kind="row" id={event.key} day={day}>
            {event.kind === 'activity' ? <DayCard item={event.item} onOpen={handlers.onOpen} dragHandle={handlers.renderHandle?.(event.item)} />
              : <FlightCard segment={event.transport} leg={event.leg} onOpen={handlers.onOpenFlight} />}
          </DropZone>
        ))}
      </View></DropZone>
      {!inFlight ? <DashedButton label={`+ Add to ${formatDay(day, { weekday: 'long' })}`} onPress={onFindPlaces} /> : null}
    </View>
  );
}

// The day chips: weekday, date and a dot when the day has plans. The chosen
// day is pink. Scrolls itself to keep the chosen day in view.
const CHIP = 54, CHIP_GAP = 8;
function DayStrip({ trip, day, days, stopFilter, onDay, onMonth }: { trip: Trip; day: string; days: string[]; stopFilter: string | null; onDay(day: string): void; onMonth(): void }) {
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const { width } = useWindowDimensions();
  const index = days.indexOf(day);
  useEffect(() => {
    if (index < 0) return;
    strip.current?.scrollTo({ x: Math.max(0, index * (CHIP + CHIP_GAP) - (width - CHIP) / 2 + 20), animated: true });
  }, [index, width]);
  return (
    <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
      {days.map(value => {
        const selected = value === day;
        const busy = dayEvents(trip, value, stopFilter).length > 0;
        return (
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${formatDay(value, { weekday: 'long', month: 'long', day: 'numeric' })}${busy ? ', has plans' : ''}`}
            onPress={() => { if (!selected) { haptics.select(); onDay(value); } }} style={[styles.chip, selected && styles.chipOn]}>
            <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.chipDay}>{formatDay(value, { weekday: 'short' }).toUpperCase()}</Text>
            <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.chipDate}>{Number(value.slice(-2))}</Text>
            <View style={[styles.chipDot, { backgroundColor: busy ? palette.ink : 'transparent' }]} />
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Month view" onPress={onMonth} style={({ pressed }) => [styles.chip, styles.monthChip, pressed && styles.pressed]}>
        <Icon name="calendar" size={22} color={palette.ink} strokeWidth={2.2} />
      </Pressable>
    </ScrollView>
  );
}

type Month = { key: string; label: string; cells: (string | null)[] };

// Calendar mode on phones: the month grid, stop key and the selected day's agenda.
export function CalendarView({ trip, day, stopFilter, month, onMonth, onSelectDay, onOpenDay, onAddPlan, onEditDates, onEditStop, ...handlers }: Handlers & {
  trip: Trip; day: string; stopFilter: string | null; month: string | null; onMonth(key: string, day: string): void; onSelectDay(day: string): void; onOpenDay(day: string): void; onAddPlan(day: string): void; onEditDates(): void; onEditStop(placeId: string): void;
}) {
  const months = monthsForTrip(trip) as Month[], days = scopedDays(trip, stopFilter);
  let index = months.findIndex(entry => entry.key === month);
  if (index < 0) index = Math.max(0, months.findIndex(entry => entry.cells.includes(day)));
  const current = months[index];
  if (!current) return null;
  const stops = calendarStops(trip) as { stop: { placeId: string; name: string }; color: string; start: string | null; end: string | null; index: number }[];
  const cells = calendarDisplayCells(current, { fullMonth: true }) as ({ date: string; inTrip: boolean } | null)[];
  const events = dayEvents(trip, day, stopFilter);
  const step = (direction: number) => {
    const next = months[index + direction];
    if (!next) return;
    onMonth(next.key, next.cells.includes(day) ? day : next.cells.find(date => date && days.includes(date)) || next.cells.find(Boolean) || day);
  };
  return (
    <View>
      <View style={styles.monthToolbar}>
        <View style={styles.monthHeading}>
          <Text style={styles.monthLabel}>{current.label}</Text>
          {trip.startDate && trip.endDate ? <Text style={styles.monthRange}>{rangeLabel(trip.startDate, trip.endDate)}</Text> : null}
        </View>
        <View style={styles.monthControls}>
          {months.length > 1 ? [-1, 1].map(direction => (
            <Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction < 0 ? 'Previous month' : 'Next month'} disabled={!months[index + direction]} onPress={() => step(direction)}
              style={({ pressed }) => [styles.monthButton, !months[index + direction] && styles.disabled, pressed && styles.pressed]}>
              <Icon name={direction < 0 ? 'back' : 'arrow'} size={19} color={palette.ink} strokeWidth={2.2} />
            </Pressable>
          )) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Edit trip dates" onPress={onEditDates} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
            <Icon name="edit" size={19} color={palette.ink} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
      {stops.length > 1 ? (
        <View style={styles.stopKey} accessibilityLabel="Edit stop dates">
          {stops.map(entry => (
            <Pressable key={entry.stop.placeId} accessibilityRole="button" onPress={() => onEditStop(entry.stop.placeId)} style={({ pressed }) => [styles.stopKeyRow, pressed && styles.pressed]}>
              <View style={[styles.stopDot, { backgroundColor: entry.color }]} />
              <Text style={styles.stopKeyName} numberOfLines={1}>{entry.stop.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.grid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(name => <Text key={name} style={styles.weekday}>{name}</Text>)}
        {cells.map((cell, position) => {
          if (!cell) return <View key={`blank-${position}`} style={styles.cell} />;
          const inTrip = cell.inTrip && days.includes(cell.date);
          if (!inTrip) return <View key={cell.date} style={[styles.cell, styles.outside]}><Text style={styles.outsideDate}>{Number(cell.date.slice(-2))}</Text></View>;
          const count = dayEvents(trip, cell.date, stopFilter).length;
          const stop = stops.length > 1 ? calendarStopOnDay(trip, cell.date, stops) as { color: string } | null : null;
          const active = cell.date === day;
          return (
            <Pressable key={cell.date} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Show plans for ${formatDay(cell.date)}, ${count} ${count === 1 ? 'plan' : 'plans'}`}
              onPress={() => onSelectDay(cell.date)} style={[styles.cell, styles.tripCell, active && styles.activeCell]}>
              {stop ? <View style={[styles.cellStop, { backgroundColor: stop.color }]} /> : null}
              <Text style={styles.cellDate}>{Number(cell.date.slice(-2))}</Text>
              {count ? <Text style={styles.cellCount}>{count}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.agenda}>
        <View style={styles.agendaHeading}>
          <Pressable accessibilityRole="button" onPress={() => onOpenDay(day)} style={({ pressed }) => [styles.agendaOpen, pressed && styles.pressed]}>
            <Text style={styles.agendaTitle}>{formatDay(day)}</Text>
            <Icon name="arrow" size={16} color={palette.violet} strokeWidth={2.4} />
          </Pressable>
        </View>
        <DropZone kind="day" id={day} day={day}>
          {events.length ? <View style={styles.dayCard}>
            {events.map((event, position) => <DropZone key={event.key} kind="row" id={event.key} day={day}><EventRow event={event} last={position === events.length - 1} {...handlers} /></DropZone>)}
          </View> : null}
        </DropZone>
        {!events.length ? <DashedButton label="Free day so far" trailing="+ Add" onPress={() => onAddPlan(day)} /> : null}
      </View>
    </View>
  );
}

const cellSize = { flexBasis: '12.6%', flexGrow: 1, height: 48 } as const;
const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { backgroundColor: palette.sand },
  disabled: { opacity: 0.25 },
  timeline: { gap: 6 },
  daySection: { gap: 8, paddingBottom: 8 },
  dayHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  openDay: { fontFamily: typefaces.bold, fontSize: 13, color: palette.violet },
  dayCard: { paddingVertical: 2, borderRadius: 20, borderCurve: 'continuous', borderWidth: strokes.thin, borderColor: palette.line, backgroundColor: palette.paper, overflow: 'hidden' },
  // "Wed 18 · on to Porto": an ink pill on an ink rule.
  travelDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  travelLine: { flex: 1, height: 2, backgroundColor: palette.ink },
  travelPill: { overflow: 'hidden', paddingVertical: 6, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: palette.ink, fontFamily: typefaces.bold, fontSize: 13, color: palette.paper },
  dayView: { gap: 14 },
  dayContext: { marginTop: 4, fontFamily: typefaces.semibold, fontSize: 13, color: palette.muted },
  dayCardList: { gap: 10 },
  inFlight: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radii.md, borderCurve: 'continuous', backgroundColor: palette.sand },
  inFlightText: { fontFamily: typefaces.semibold, fontSize: 13, color: palette.ink },
  strip: { marginHorizontal: -20 },
  stripContent: { paddingHorizontal: 20, paddingVertical: 2, gap: CHIP_GAP },
  chip: { width: CHIP, height: 70, gap: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, borderCurve: 'continuous', borderWidth: strokes.thin, borderColor: palette.line, backgroundColor: palette.paper },
  chipOn: { borderWidth: strokes.mid, borderColor: palette.ink, backgroundColor: palette.pink },
  chipDay: { fontFamily: typefaces.bold, fontSize: 11, color: palette.ink },
  chipDate: { fontFamily: typefaces.display, fontSize: 22, lineHeight: 26, color: palette.ink },
  chipDot: { width: 5, height: 5, borderRadius: 3 },
  monthChip: { borderStyle: 'dashed', borderColor: palette.ink, backgroundColor: 'transparent' },
  monthToolbar: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthHeading: { flexShrink: 1 },
  monthLabel: { fontFamily: typefaces.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.6, color: palette.ink },
  monthRange: { marginTop: 4, fontFamily: typefaces.semibold, fontSize: 13, lineHeight: 18, color: palette.muted },
  monthControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthButton: { width: 44, height: 44, borderRadius: 22, borderWidth: strokes.thin, borderColor: palette.ink, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center' },
  stopKey: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  stopKeyRow: { flexBasis: '45%', flexGrow: 1, minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radii.pill },
  stopDot: { width: 9, height: 9, borderRadius: 3 },
  stopKeyName: { flexShrink: 1, fontFamily: typefaces.bold, fontSize: 13, lineHeight: 16, color: palette.ink },
  grid: { marginTop: 8, paddingTop: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  weekday: { flexBasis: '12.6%', flexGrow: 1, height: 20, textAlign: 'center', fontFamily: typefaces.bold, fontSize: 11, lineHeight: 18, color: palette.muted },
  cell: { ...cellSize, borderRadius: 14, borderCurve: 'continuous', borderWidth: strokes.thin, borderColor: 'transparent', alignItems: 'center' },
  outside: { paddingTop: 5 },
  outsideDate: { padding: 5, fontFamily: typefaces.medium, fontSize: 15, lineHeight: 22, color: palette.faint },
  tripCell: { paddingTop: 3, backgroundColor: palette.paper, borderColor: palette.line },
  activeCell: { backgroundColor: palette.pink, borderColor: palette.ink, borderWidth: strokes.mid },
  cellStop: { position: 'absolute', top: 6, right: 5, width: 5, height: 5, borderRadius: 2 },
  cellDate: { fontFamily: typefaces.display, fontSize: 16, lineHeight: 22, color: palette.ink },
  cellCount: { marginTop: 1, paddingHorizontal: 2, fontFamily: typefaces.bold, fontSize: 11, lineHeight: 14, color: palette.ink },
  agenda: { marginTop: 14, paddingTop: 10, paddingBottom: 12, gap: 8, borderTopWidth: strokes.thin, borderTopColor: palette.line },
  agendaHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  agendaOpen: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radii.pill },
  agendaTitle: { fontFamily: typefaces.display, fontSize: 20, color: palette.ink },
});
