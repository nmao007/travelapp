import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { datesForTrip } from '@trippilot/core/itinerary-model';
import { scheduleUnassigned, destinationForDay } from '@trippilot/core/place-model';
import { createPlanNavigation } from '@trippilot/core/plan-navigation';
import { datesForStop, renameTrip, tripStops } from '@trippilot/core/trip-model';
import { AccountSheet } from '@/components/account-sheet';
import { afterSheetCloses } from '@/components/sheet';
import { WorkspaceHeader, WorkspaceNav, type MenuAction } from '@/components/workspace/chrome';
import { CalendarView, DayView, Timeline, dayEvents, scopedDays } from '@/components/workspace/plan-views';
import { PlanSheet } from '@/components/workspace/plan-sheet';
import { AddSheet } from '@/components/workspace/add-sheet';
import { FlightSheet } from '@/components/workspace/flight-sheet';
import { RemovalNotice, TripNotice } from '@/components/workspace/notices';
import { DragProvider, DragHandle } from '@/components/workspace/plan-drag';
import { TripDatesSheet } from '@/components/workspace/trip-dates-sheet';
import { IdeasView } from '@/components/workspace/ideas-view';
import { TripMap } from '@/components/workspace/trip-map';
import { PasteLinkSheet } from '@/components/workspace/paste-link-sheet';
import { IdeaSheet } from '@/components/workspace/idea-sheet';
import { StopSheets, type StopSheetState } from '@/components/workspace/stop-sheets';
import type { Flight } from '@/lib/flight-form';
import { colors, fonts, sq } from '@/lib/theme';
import { Icon } from '@/components/icons';
import { useTrips, type PlanItem, type Trip } from '@/lib/trips';
import { haptics } from '@/lib/haptics';

type Mode = 'list' | 'calendar' | 'day';
type Removal = { tripId: string; collection: string; record: PlanItem | Flight; [key: string]: unknown };

// The trip workspace on phones (showWorkspace + itinerary-ui.js in the site).
export default function TripWorkspace() {
  // tab=ideas opens on Ideas (a trip just started from a shared video).
  const { id, tab: startTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { ready, trips, saveTrip, deleteTrip, account, signOut } = useTrips();
  const stored = trips.find(trip => trip.id === id);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [tab, setTab] = useState<'plan' | 'map' | 'ideas'>(startTab === 'ideas' ? 'ideas' : 'plan');
  const [day, setDay] = useState('ideas');
  const [stopFilter, setStopFilter] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item: PlanItem | null; day: string } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [flight, setFlight] = useState<{ segment: Flight | null; day: string } | null>(null);
  const [datesOpen, setDatesOpen] = useState(false);
  const [stopSheet, setStopSheet] = useState<StopSheetState>(null);
  const [renaming, setRenaming] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState('');
  const [removal, setRemoval] = useState<Removal | null>(null);
  const navigation = useRef(createPlanNavigation()).current;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), scrollOffset = useRef(0);

  // showWorkspace(): open on the first stop, its first day, in the timeline.
  useEffect(() => {
    if (!stored || trip?.id === stored.id) return;
    const scheduled = scheduleUnassigned(stored) as Trip;
    if (scheduled !== stored) saveTrip(scheduled);
    const first = (tripStops(scheduled) as Trip['stops'])[0];
    setTrip(scheduled); setStopFilter(first.placeId); setMode('list'); navigation.reset(scheduled.id);
    setDay(datesForStop(scheduled, first.placeId)[0] || 'ideas');
  }, [stored, trip?.id, saveTrip, navigation]);
  // Keep up with saves from elsewhere (cloud refresh, conflict resolution).
  useEffect(() => { if (stored && trip && stored !== trip && stored.id === trip.id) setTrip(stored); }, [stored]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((next: Trip) => { setTrip(saveTrip(next)); }, [saveTrip]);

  // The view fades up 7pt when the mode changes (render() in itinerary-ui.js).
  const enter = useSharedValue(1);
  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: (1 - enter.value) * 7 }] }));
  const showMode = useCallback((next: Mode) => setMode(next), []);
  // Runs after the switch renders: Reanimated values can't change mid-render.
  const shownMode = useRef(mode);
  useEffect(() => {
    if (shownMode.current === mode) return;
    shownMode.current = mode;
    enter.set(0); enter.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) }));
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [mode, enter]);

  if (!trip) return <TripMissing loading={!ready || Boolean(stored)} />;
  const days = scopedDays(trip, stopFilter);
  const activeDay = days.includes(day) ? day : days[0] || 'ideas';
  const stops = tripStops(trip) as Trip['stops'];

  function chooseDay(next: string, nextMode?: Mode) {
    if (nextMode) navigation.enter(trip!.id, { mode, day: activeDay, focusDay: next, stop: stopFilter, month }, nextMode);
    setDay(next);
    if (nextMode) showMode(nextMode);
  }
  function back() {
    if (mode === 'list') { router.back(); return; }
    const previous = navigation.back(trip!.id) as { mode: Mode; day: string; stop: string | null; month: string | null } | null;
    if (previous) { setDay(previous.day); setStopFilter(previous.stop); setMonth(previous.month); }
    showMode(previous?.mode || 'list');
  }
  function selectStop(placeId: string) {
    setStopFilter(placeId); setMonth(null);
    const first = datesForStop(trip!, placeId)[0];
    if (first) setDay(first);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function openPlan(item: PlanItem | null, onDay = activeDay) {
    if (!datesForTrip(trip!).length) { setDatesOpen(true); return; }
    setEditing({ item, day: onDay });
  }
  // Adding to a day: a real place, one of the trip's ideas, or a written plan.
  function openAdd(onDay = activeDay) {
    if (!datesForTrip(trip!).length) { setDatesOpen(true); return; }
    setAdding(onDay);
  }
  // openTransport(segment, day) in itinerary-ui.js.
  function openFlight(segment: Flight | null, onDay = activeDay) {
    if (!datesForTrip(trip!).length) { setDatesOpen(true); return; }
    setFlight({ segment, day: onDay });
  }
  const dayStop = stops.find(stop => stop.placeId === stopFilter) || destinationForDay(trip, stops, activeDay);
  const dayCount = dayEvents(trip, activeDay, stopFilter).length;
  const menu: MenuAction[] = [
    { key: 'dates', label: 'Trip dates', icon: 'calendar', onPress: () => setDatesOpen(true) },
    { key: 'rename', label: 'Rename trip', icon: 'edit', onPress: () => { if (mode === 'day') showMode('list'); setRenaming(true); } },
    { key: 'account', label: account ? 'Sign out' : 'Sign in', onPress: () => { if (account) signOut(); else setAccountOpen(true); } },
    ...(stops.length > 1 ? [{ key: 'reorder', label: 'Reorder stops', icon: 'list' as const, onPress: () => setStopSheet({ kind: 'order' }) }] : []),
    { key: 'add-stop', label: 'Add destination', icon: 'plus', onPress: () => setStopSheet({ kind: 'search' }) },
    { key: 'delete', label: confirmDelete ? 'Confirm delete' : 'Delete trip', danger: true, onPress: () => {
      if (!confirmDelete) { haptics.warning(); setConfirmDelete(true); return true; }
      deleteTrip(trip.id); router.back();
    } },
  ];

  const handlers = {
    onOpen: (item: PlanItem) => openPlan(item, item.day),
    onOpenFlight: (segment: Flight) => openFlight(segment, segment.departure_date),
    renderHandle: (item: PlanItem) => <DragHandle item={item} />,
  };

  return (
    <View style={styles.screen}>
      <WorkspaceHeader
        trip={trip} mode={tab === 'map' ? 'list' : mode} day={activeDay} stopFilter={stopFilter} days={days}
        dayContext={`${dayStop?.name || trip.name} · ${dayCount} ${dayCount === 1 ? 'plan' : 'plans'}`}
        onBack={tab === 'map' ? () => router.back() : back} onAdd={tab === 'ideas' ? () => setIdeaOpen(true) : undefined} addLabel={tab === 'ideas' ? 'Add an idea' : undefined}
        addMenu={tab === 'plan' ? [{ key: 'place', label: 'Add a place or idea', icon: 'pin', onPress: () => openAdd() }, { key: 'flight', label: 'Add flight', icon: 'plane', onPress: () => openFlight(null) }] : undefined} showToggle={tab !== 'map'} onToggleMode={() => chooseDay(activeDay === 'ideas' ? days[0] || 'ideas' : activeDay, 'calendar')}
        onStop={selectStop} onDay={next => chooseDay(next)} onRename={() => setRenaming(true)} menu={menu} onMenuOpen={() => setConfirmDelete(false)}
        renaming={renaming} onRenameDone={value => {
          if (!renaming) return;
          if (value !== null) { try { commit(renameTrip(trip, value) as Trip); } catch (error) { setNotice((error as Error).message); return; } }
          setRenaming(false);
        }}
      />
      {tab === 'map' ? (
        <TripMap trip={trip} stopFilter={stopFilter} commit={commit} onNotice={setNotice} onNeedDates={() => setDatesOpen(true)} onOpenPlan={placeId => {
          const items = (trip.items || []).filter(item => item.placeId === placeId || item.id === placeId);
          const item = items.find(item => item.day === activeDay) || items[0];
          if (item) openPlan(item, item.day);
        }} />
      ) : <DragProvider trip={trip} commit={commit} onDrop={next => setDay(next)} scrollRef={scroll} scrollOffset={scrollOffset}>
        <ScrollView ref={scroll} style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" scrollEventThrottle={16} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}>
          <Animated.View style={enterStyle}>
            {tab === 'ideas' ? (
              <IdeasView trip={trip} commit={commit} onNotice={setNotice} onNeedDates={() => setDatesOpen(true)} onAddIdea={() => setIdeaOpen(true)} />
            ) : mode === 'list' ? (
              <Timeline trip={trip} stopFilter={stopFilter} {...handlers} onChooseDay={next => chooseDay(next, 'day')} onChooseDates={() => setDatesOpen(true)}
                onSetStopDates={() => stopFilter && setStopSheet({ kind: 'dates', placeId: stopFilter })} />
            ) : mode === 'calendar' ? (
              <CalendarView trip={trip} day={activeDay} stopFilter={stopFilter} month={month} {...handlers}
                onMonth={(key, next) => { setMonth(key); setDay(next); }} onSelectDay={next => chooseDay(next)} onOpenDay={next => chooseDay(next, 'day')}
                onAddPlan={next => openAdd(next)} onEditDates={() => setDatesOpen(true)} onEditStop={placeId => setStopSheet({ kind: 'dates', placeId })} />
            ) : (
              <DayView trip={trip} day={activeDay} stopFilter={stopFilter} {...handlers} onFindPlaces={() => openAdd(activeDay)} />
            )}
          </Animated.View>
        </ScrollView>
      </DragProvider>}
      <TripNotice message={notice} onHide={() => setNotice('')} />
      <RemovalNotice removal={removal} onUndo={restored => { commit(restored.trip); chooseDay(restored.day, mode === 'list' ? undefined : 'day'); setRemoval(null); }} onHide={() => setRemoval(null)} trip={trip} />
      <WorkspaceNav active={tab} onSelect={key => { if (key === 'plan' || key === 'map' || key === 'ideas') { setTab(key); scroll.current?.scrollTo({ y: 0, animated: false }); } }} />
      <PlanSheet trip={trip} editing={editing} onClose={() => setEditing(null)} commit={commit}
        onSaved={item => { setDay(item.day); }} onDuplicated={copy => { chooseDay(copy.day, 'day'); }}
        onRemoved={result => { commit(result.trip); setRemoval(result.removal as Removal); }} onNeedDates={() => setDatesOpen(true)} />
      <AddSheet trip={trip} day={adding} onClose={() => setAdding(null)} commit={commit}
        onAdded={(item, message) => { setDay(item.day); setNotice(message); }} onCustom={next => openPlan(null, next)} />
      {flight ? <FlightSheet trip={trip} editing={flight} onClose={() => setFlight(null)} commit={commit}
        onSaved={segment => { setDay(segment.departure_date); }}
        onRemoved={result => { commit(result.trip); setRemoval(result.removal as Removal); }} /> : null}
      <TripDatesSheet visible={datesOpen} trip={trip} onClose={() => setDatesOpen(false)} commit={commit} onError={setNotice}
        onReorder={stops.length > 1 ? () => { setDatesOpen(false); afterSheetCloses(() => setStopSheet({ kind: 'order' })); } : undefined}
        onSaved={() => { const first = datesForStop(trip, stopFilter || stops[0].placeId)[0]; if (first && !days.includes(day)) setDay(first); }} />
      <StopSheets state={stopSheet} trip={trip} commit={commit} onClose={() => setStopSheet(null)} onError={setNotice}
        onStopAdded={placeId => selectStop(placeId)} onStopRemoved={() => { const first = (tripStops(trip) as Trip['stops'])[0]; selectStop(first.placeId); }} />
      <IdeaSheet visible={ideaOpen} trip={trip} near={dayStop || stops[0]} onClose={() => setIdeaOpen(false)} commit={commit}
        onPaste={() => setPasteOpen(true)} onSaved={setNotice} />
      <PasteLinkSheet visible={pasteOpen} trip={trip} onClose={() => setPasteOpen(false)} onSaved={() => setNotice('Added to Ideas')} />
      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </View>
  );
}

// While trips load from the phone, a spinner; if the trip isn't there (removed
// on another device, or an old link), say so and offer the way home.
function TripMissing({ loading }: { loading: boolean }) {
  const insets = useSafeAreaInsets();
  const home = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={home} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Icon name="back" size={24} color="#222222" />
      </Pressable>
      <View style={styles.missing}>
        {loading ? <ActivityIndicator color={colors.muted} accessibilityLabel="Loading trip" /> : (
          <>
            <Text style={styles.missingTitle} accessibilityRole="header">{"This trip isn't here"}</Text>
            <Text style={styles.missingText}>It may have been deleted on another device.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}>
              <Text style={styles.homeText}>Go to your trips</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  back: { width: 44, height: 44, marginLeft: 8, alignItems: 'center', justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous' },
  pressed: { backgroundColor: colors.pressed },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80, gap: 8 },
  missingTitle: { fontFamily: fonts.bold, fontSize: 21, letterSpacing: -0.5, color: colors.ink, textAlign: 'center' },
  missingText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  homeButton: { marginTop: 12, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous', borderWidth: 1, borderColor: colors.line },
  homeText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.action },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20 },
});
