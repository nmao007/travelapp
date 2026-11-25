import { Pressable, StyleSheet, Text, View } from 'react-native';
import { calendarDisplayCells, datesForTrip, eventsForDay, monthsForTrip } from '@trippilot/core/itinerary-model';
import { calendarStopOnDay, calendarStops } from '@trippilot/core/calendar-stops';
import { flightDayBlock } from '@trippilot/core/flight-window';
import { datesForStop, stopForPlan } from '@trippilot/core/trip-model';
import { Art, Icon } from '../icons';
import { DayCard, TimelineRow } from './plan-row';
import { FlightCard, FlightRow } from './flight-row';
import { DropZone } from './plan-drag';
import type { Flight, Leg } from '@/lib/flight-form';
import { formatDay, rangeLabel } from '@/lib/format';
import { colors, fonts, sq } from '@/lib/theme';
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

function OpenDay({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.openDay, pressed && styles.pressed]}>
      <Text style={styles.openDayText}>{label}</Text>
    </Pressable>
  );
}

// List mode: the day-by-day timeline with its rail and day markers.
export function Timeline({ trip, stopFilter, onChooseDay, onChooseDates, onSetStopDates, ...handlers }: Handlers & { trip: Trip; stopFilter: string | null; onChooseDay(day: string): void; onChooseDates(): void; onSetStopDates(): void }) {
  const allDays = datesForTrip(trip), days = scopedDays(trip, stopFilter);
  if (!allDays.length) return <View><OpenDay label="Choose your dates" onPress={onChooseDates} />{trip.items.map(item => <TimelineRow key={item.id} item={item} onOpen={handlers.onOpen} dragHandle={handlers.renderHandle?.(item)} />)}</View>;
  if (!days.length) return <OpenDay label="Set stop dates" onPress={onSetStopDates} />;
  return (
    <View style={styles.timeline}>
      <View style={styles.rail} />
      {days.map(day => {
        const events = dayEvents(trip, day, stopFilter);
        return (
          <DropZone key={day} kind="day" id={day} day={day}><View style={styles.daySection}>
            <View style={[styles.dayHeading, !events.length && styles.dayHeadingEmpty]}>
              <View style={[styles.dayMarker, { backgroundColor: events.length ? colors.accent : '#d4d7dd' }]} />
              <Pressable accessibilityRole="button" onPress={() => onChooseDay(day)} style={({ pressed }) => [styles.dayButton, pressed && styles.pressed]}>
                <Text style={events.length ? styles.dayTitle : styles.dayTitleEmpty}>{formatDay(day)}</Text>
                <Icon name="chevron" size={12} color="#9b9fa6" style={styles.chevronRight} />
              </Pressable>
            </View>
            {events.map(event => <DropZone key={event.key} kind="row" id={event.key} day={day}><View style={styles.timelineItem}><EventRow event={event} {...handlers} /></View></DropZone>)}
          </View></DropZone>
        );
      })}
    </View>
  );
}

// A plan or flight as a timeline row (planRow / transportJourney / arrivalJourney).
function EventRow({ event, onOpen, onOpenFlight, renderHandle }: Handlers & { event: DayEvent }) {
  if (event.kind === 'transport') return <FlightRow segment={event.transport} leg={event.leg} onOpen={onOpenFlight} />;
  return <TimelineRow item={event.item} onOpen={onOpen} dragHandle={renderHandle?.(event.item)} />;
}

// Day mode: one day's plans as cards, a departing flight as its ticket card.
export function DayView({ trip, day, stopFilter, onFindPlaces, ...handlers }: Handlers & { trip: Trip; day: string; stopFilter: string | null; onFindPlaces(): void }) {
  const events = dayEvents(trip, day, stopFilter);
  const inFlight = flightDayBlock(trip, day);
  return (
    <View style={styles.dayCards}>
      {inFlight ? <View style={styles.inFlight}><Icon name="plane" size={18} color={colors.muted} /><Text style={styles.inFlightText}>{`In flight · ${inFlight.flights.map((flight: { service_id?: string }) => flight.service_id).filter(Boolean).join(' / ')}`}</Text></View> : null}
      <DropZone kind="day" id={day} day={day}><View style={styles.dayCardList}>
        {events.map(event => (
          <DropZone key={event.key} kind="row" id={event.key} day={day}>
            {event.kind === 'activity' ? <DayCard item={event.item} onOpen={handlers.onOpen} dragHandle={handlers.renderHandle?.(event.item)} />
              : event.leg === 'arrival' ? <FlightRow segment={event.transport} leg="arrival" onOpen={handlers.onOpenFlight} />
                : <FlightCard segment={event.transport} onOpen={handlers.onOpenFlight} />}
          </DropZone>
        ))}
      </View></DropZone>
      {!events.length && !inFlight ? (
        <Pressable accessibilityRole="button" onPress={onFindPlaces} style={({ pressed }) => [styles.findPlaces, pressed && styles.pressed]}>
          <Art name="guide" size={42} />
          <Text style={styles.findPlacesText}>Find something good</Text>
        </Pressable>
      ) : null}
    </View>
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
              <Icon name={direction < 0 ? 'back' : 'arrow'} size={19} color={colors.muted} />
            </Pressable>
          )) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Edit trip dates" onPress={onEditDates} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
            <Icon name="edit" size={19} color={colors.muted} />
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
            <Icon name="arrow" size={16} color="#777777" />
          </Pressable>
        </View>
        <DropZone kind="day" id={day} day={day}>
          {events.map(event => <DropZone key={event.key} kind="row" id={event.key} day={day}><EventRow event={event} {...handlers} /></DropZone>)}
        </DropZone>
        {!events.length ? <OpenDay label="Add a plan" onPress={() => onAddPlan(day)} /> : null}
      </View>
    </View>
  );
}

const cellSize = { flexBasis: '12.6%', flexGrow: 1, height: 48 } as const;
const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.pressed },
  disabled: { opacity: 0.25 },
  // .open-day: a dashed prompt box, text at the left.
  openDay: { minHeight: 48, marginTop: 6, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e5cfc5', borderRadius: sq(22), borderCurve: 'continuous', justifyContent: 'center' },
  openDayText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.action },
  timeline: { paddingBottom: 20 },
  // .trip-timeline::before: a 1px rail from the first marker to the last.
  rail: { position: 'absolute', left: 5, top: 23, bottom: 24 + 20, width: 1, backgroundColor: '#e4e6ea' },
  daySection: { marginBottom: 8 },
  dayHeading: { height: 46, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white },
  dayHeadingEmpty: { height: 44 },
  // 5pt dot inside a 2pt white ring, centered on the rail.
  dayMarker: { position: 'absolute', left: 1, width: 9, height: 9, borderWidth: 2, borderColor: colors.white, boxSizing: 'border-box' },
  dayButton: { marginLeft: 24, height: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: sq(22), borderCurve: 'continuous' },
  dayTitle: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 20.4, letterSpacing: -0.35, color: '#292929' },
  dayTitleEmpty: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 18, letterSpacing: -0.35, color: '#85888e' },
  chevronRight: { transform: [{ rotate: '-90deg' }] },
  timelineItem: { marginLeft: 23 },
  dayCards: { paddingTop: 14, gap: 12, paddingBottom: 20 },
  dayCardList: { gap: 12 },
  inFlight: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft },
  inFlightText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  findPlaces: { minHeight: 120, gap: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ececec', borderRadius: sq(30), borderCurve: 'continuous' },
  findPlacesText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  monthToolbar: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthHeading: { flexShrink: 1 },
  monthLabel: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 25.2, letterSpacing: -0.6, color: '#262626' },
  monthRange: { marginTop: 5, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#777777' },
  monthControls: { flexDirection: 'row', alignItems: 'center' },
  monthButton: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  stopKey: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  stopKeyRow: { flexBasis: '45%', flexGrow: 1, minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: sq(22), borderCurve: 'continuous' },
  stopDot: { width: 6, height: 6, borderRadius: sq(1), borderCurve: 'continuous' },
  stopKeyName: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16.25, color: colors.ink },
  grid: { marginTop: 8, paddingTop: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  weekday: { flexBasis: '12.6%', flexGrow: 1, height: 20, textAlign: 'center', fontFamily: fonts.medium, fontSize: 11, lineHeight: 18, color: '#888888' },
  cell: { ...cellSize, borderRadius: sq(22), borderCurve: 'continuous', borderWidth: 1, borderColor: 'transparent', alignItems: 'center' },
  outside: { paddingTop: 5 },
  outsideDate: { padding: 5, paddingTop: 5, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: '#aaaaaa' },
  tripCell: { paddingTop: 3, backgroundColor: colors.soft },
  activeCell: { backgroundColor: '#fff2eb', borderColor: '#f5b293' },
  cellStop: { position: 'absolute', top: 6, right: 5, width: 4, height: 4, borderRadius: sq(1), borderCurve: 'continuous' },
  cellDate: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: '#292929' },
  cellCount: { marginTop: 1, paddingHorizontal: 2, fontFamily: fonts.medium, fontSize: 12, lineHeight: 14, color: colors.muted },
  agenda: { marginTop: 14, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#eeeeee' },
  agendaHeading: { height: 44, flexDirection: 'row', alignItems: 'center' },
  agendaOpen: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: sq(22), borderCurve: 'continuous' },
  agendaTitle: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.3, color: '#292929' },
});
