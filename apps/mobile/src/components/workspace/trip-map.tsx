import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Text, TIGHT_SCALE } from '@/components/text';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isContentIdea } from '@trippilot/core/board-model';
import { datesForTrip } from '@trippilot/core/itinerary-model';
import { mapViewURL, placeMapsURL } from '@trippilot/core/maps-links';
import { googleRatingLabel, mapEntries } from '@trippilot/core/place-model';
import { datesForStop } from '@trippilot/core/trip-model';
import { tabBarSpace } from './chrome';
import { Icon } from '../icons';
import { Dropdown } from '../popover';
import { Button, Display, IconButton } from '../ui';
import { Cover, DayChips, ideaKind, ideaOnDay, ideaScheduled, providerLabel, type Idea } from './ideas-view';
import { PlaceMarker, planKind } from './plan-row';
import { PROVIDERS } from '../shared-preview';
import { formatClock, formatDay } from '@/lib/format';
import { gutter, palette, radii, strokes, typefaces } from '@/lib/design';
import type { PlanItem, Trip } from '@/lib/trips';

// Google Maps on iOS needs GOOGLE_MAPS_IOS_KEY at build time (app.config.js).
// Without it the same pins and cards draw on Apple Maps.
const provider = Constants.expoConfig?.extra?.googleMapsIOS ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

type Entry = PlanItem & { planned: boolean; number?: number; latitude: number; longitude: number; placeId?: string; name: string; category?: string; rating?: number; ratingCount?: number };
type MapIdea = Idea & { latitude: number; longitude: number };
type Point = { latitude: number; longitude: number };
type Size = { width: number; height: number };
type Chosen = { kind: 'plan' | 'idea'; key: string };
type View_ = 'day' | 'all' | 'ideas';

const planKey = (entry: { placeId?: string; id: string }) => entry.placeId || entry.id;

// Google's zoom levels as a region for this map's size, so the camera matches
// the site's moveCamera({ zoom }) on both Google and Apple Maps.
function regionAt(point: Point, zoom: number, size: Size): Region {
  const longitudeDelta = (360 * size.width) / (256 * 2 ** zoom);
  return { ...point, longitudeDelta, latitudeDelta: longitudeDelta * (size.height / size.width) * Math.cos((point.latitude * Math.PI) / 180) };
}
const zoomOf = (region: Region, size: Size) => Math.log2((360 * size.width) / (256 * region.longitudeDelta));

// The Map tab: the map fills the screen. A switch on top shows one day's
// plans, every plan, or the saved ideas; plans are numbered teardrop pins in
// their kind's color, ideas round pins with their cover. The cream panel at
// the bottom lists what's shown, or the tapped pin with what you can do.
export function TripMap({ trip, stopFilter, day, days, onDay, commit, onNotice, onNeedDates, onOpenPlan, focusIdea, onFocused }: {
  trip: Trip; stopFilter: string | null; day: string; days: string[]; onDay(day: string): void; commit(trip: Trip): void; onNotice(message: string): void;
  onNeedDates(): void; onOpenPlan(placeId: string): void; focusIdea: string | null; onFocused(): void;
}) {
  const map = useRef<MapView>(null);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<Size>({ width: window.width, height: window.height - 200 });
  const [panel, setPanel] = useState(0);
  const [ready, setReady] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [view, setView] = useState<View_>('all');
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [error, setError] = useState('');
  const stops = trip.stops || [];
  const stop = stops.find(item => item.placeId === stopFilter) || stops[0];
  const dated = days.length > 0 && days.includes(day);

  const allEntries = useMemo(() => {
    const scoped = stopFilter ? datesForStop(trip, stopFilter) as string[] : null;
    const items = scoped ? (trip.items || []).filter(item => scoped.includes(item.day)) : trip.items || [];
    return mapEntries(items, [], { timeZone: trip.timeZone || 'UTC' }) as Entry[];
  }, [trip, stopFilter]);
  const dayEntries = useMemo(() => mapEntries((trip.items || []).filter(item => item.day === day), [], { timeZone: trip.timeZone || 'UTC' }) as Entry[], [trip, day]);
  // Saved ideas with a place, except where that place is already a plan pin.
  const allIdeas = useMemo(() => {
    const planned = new Set(allEntries.map(planKey));
    return ((trip.boardItems as Idea[] | undefined) || []).filter((idea): idea is MapIdea =>
      isContentIdea(idea) && Number.isFinite(idea.latitude) && Number.isFinite(idea.longitude) && !(idea.placeId && planned.has(idea.placeId)));
  }, [trip.boardItems, allEntries]);
  const entries = useMemo(() => view === 'day' ? dayEntries : view === 'all' ? allEntries : [], [view, dayEntries, allEntries]);
  const ideas = useMemo(() => view === 'day' ? [] : allIdeas, [view, allIdeas]);

  const activePlan = chosen?.kind === 'plan' ? entries.find(entry => planKey(entry) === chosen.key) || null : null;
  const activeIdea = chosen?.kind === 'idea' ? ideas.find(idea => idea.id === chosen.key) || null : null;

  // Choosing another stop flies there and closes the card.
  const shown = useRef(stop?.placeId);
  useEffect(() => {
    if (!stop || shown.current === stop.placeId) return;
    shown.current = stop.placeId; setChosen(null);
    map.current?.animateToRegion(regionAt(stop, 12, size), 850);
  }, [stop, size]);

  // Frame whatever is shown, when the map is up and whenever the view changes.
  const framedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = `${view}:${view === 'day' ? day : ''}`;
    if (!ready || framedFor.current === key || focusIdea) return;
    framedFor.current = key;
    const points = [...entries, ...ideas].map(({ latitude, longitude }) => ({ latitude, longitude }));
    if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 120, right: 60, bottom: 60, left: 60 }, animated: framedFor.current !== null });
    else if (points.length === 1) map.current?.animateToRegion(regionAt(points[0], 14, size), 400);
  }, [ready, view, day, entries, ideas, size, focusIdea]);

  function open(next: Chosen, point: Point) {
    setChosen(next); setError('');
    map.current?.animateToRegion(regionAt(point, 15, size), 600);
  }
  // "Show on map" from the Ideas tab: once the map is up, open that idea.
  const focus = () => {
    const idea = focusIdea ? allIdeas.find(item => item.id === focusIdea) : null;
    // Mark the view as framed, so framing everything doesn't fly away from it.
    if (idea) { framedFor.current = 'all:'; setView('all'); open({ kind: 'idea', key: idea.id }, idea); }
    if (focusIdea) onFocused();
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width && height && (width !== size.width || height !== size.height)) setSize({ width, height });
  };
  const link = mapViewURL(region ? { latitude: region.latitude, longitude: region.longitude } : stop, region ? zoomOf(region, size) : 12);
  const number = (entry: Entry) => entries.indexOf(entry) + 1;
  const switchView = (next: View_) => { setView(next); setChosen(null); };

  if (!stop) return <View style={styles.frame} />;
  return (
    <View style={styles.frame} onLayout={onLayout}>
      <MapView ref={map} provider={provider} style={StyleSheet.absoluteFill} initialRegion={regionAt(stop, 12, size)}
        onMapReady={() => { setReady(true); focus(); }} mapPadding={{ top: 60, right: 0, left: 0, bottom: panel }} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false} showsCompass={false}
        onRegionChangeComplete={setRegion} onPress={event => { if (event.nativeEvent.action !== 'marker-press') setChosen(null); }}>
        {ideas.map(idea => <IdeaPin key={idea.id} idea={idea} selected={activeIdea?.id === idea.id} onPress={() => open({ kind: 'idea', key: idea.id }, idea)} />)}
        {entries.map(entry => <PlanPin key={planKey(entry)} entry={entry} number={number(entry)} selected={activePlan ? planKey(activePlan) === planKey(entry) : false} onPress={() => open({ kind: 'plan', key: planKey(entry) }, entry)} />)}
      </MapView>

      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.switch} accessibilityRole="tablist" accessibilityLabel="Show on map">
          {([['day', dated ? formatDay(day, { weekday: 'short', day: 'numeric' }) : 'Day'], ['all', 'All days'], ['ideas', 'Ideas']] as const).map(([key, label]) => {
            const selected = view === key, disabled = key === 'day' && !dated;
            return (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => switchView(key)} style={[styles.switchTab, selected && styles.switchTabOn]}>
                <Text maxFontSizeMultiplier={TIGHT_SCALE} style={[styles.switchText, selected && styles.switchTextOn, disabled && styles.switchTextOff]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {link ? <IconButton icon="external" label="Open this map in Google Maps" onPress={() => Linking.openURL(link)} style={styles.mapLink} /> : null}
      </View>

      <View style={[styles.panel, { paddingBottom: tabBarSpace(insets) }]} onLayout={event => setPanel(Math.round(event.nativeEvent.layout.height))}>
        <View style={styles.handle} />
        {activePlan ? (
          <PlanDetail entry={activePlan} onClose={() => setChosen(null)} onOpen={() => { setChosen(null); onOpenPlan(planKey(activePlan)); }} />
        ) : activeIdea ? (
          <IdeaDetail trip={trip} idea={activeIdea} error={error} onClose={() => setChosen(null)} onNeedDates={onNeedDates}
            onPick={pick => {
              try { commit(ideaOnDay(trip, activeIdea, pick)); onNotice(`Added to ${formatDay(pick)}`); setError(''); }
              catch (failure) { setError((failure as Error).message); }
            }} />
        ) : (
          <>
            <View style={styles.panelHeading}>
              {view === 'day' ? (
                <Dropdown value={day} label="Choose day" options={days.map(value => ({ value, label: formatDay(value, { weekday: 'long', month: 'short', day: 'numeric' }) }))}
                  onChange={onDay} gap={6} triggerStyle={styles.dayTrigger} valueStyle={styles.panelTitle} />
              ) : <Display size="section" accessibilityRole="header">{view === 'all' ? 'All days' : 'Ideas'}</Display>}
              <Text style={styles.panelCount}>{[entries.length ? `${entries.length} ${entries.length === 1 ? 'plan' : 'plans'}` : '', ideas.length ? `${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}` : ''].filter(Boolean).join(' · ') || 'Nothing with a place yet'}</Text>
            </View>
            <ScrollView style={{ maxHeight: Math.max(120, size.height * 0.3) }} contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false}>
              {entries.map(entry => (
                <Pressable key={planKey(entry)} accessibilityRole="button" accessibilityLabel={`${number(entry)}. ${entry.name}`} onPress={() => open({ kind: 'plan', key: planKey(entry) }, entry)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <View style={[styles.rowNumber, { backgroundColor: planKind(entry).color }]}><Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.rowNumberText}>{number(entry)}</Text></View>
                  <View style={styles.flex}>
                    <Text style={styles.rowName} numberOfLines={1}>{entry.name}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>{[planKind(entry).label, view === 'all' ? formatDay(entry.day, { weekday: 'short', day: 'numeric' }) : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {entry.time ? <Text style={styles.rowTime}>{formatClock(entry.time)}</Text> : null}
                </Pressable>
              ))}
              {ideas.map(idea => (
                <Pressable key={idea.id} accessibilityRole="button" accessibilityLabel={idea.title || 'Saved idea'} onPress={() => open({ kind: 'idea', key: idea.id }, idea)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <Cover image={idea.image} style={styles.rowCover} />
                  <View style={styles.flex}>
                    <Text style={styles.rowName} numberOfLines={1}>{idea.title || 'Saved idea'}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>{[ideaKind(idea).label, ideaScheduled(trip, idea) ? 'on a day' : providerLabel(idea)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Icon name="chevron" size={14} color={palette.muted} style={styles.chevron} />
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>
      {!ready ? <View style={styles.loading}><ActivityIndicator color={palette.muted} /><Text style={styles.loadingText}>Loading map</Text></View> : null}
    </View>
  );
}

// Pins are snapshots on Google Maps: redraw only until the content has drawn.
function useTracking(look: string, ready = true) {
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => { if (!ready) return; const timer = setTimeout(() => setDrawn(look), 400); return () => clearTimeout(timer); }, [look, ready]);
  return drawn !== look;
}

// A plan: a teardrop in its kind's color with its number, tip on the place.
const PlanPin = memo(function PlanPin({ entry, number, selected, onPress }: { entry: Entry; number: number; selected: boolean; onPress(): void }) {
  const tracking = useTracking(`${selected}:${number}:${entry.kind}`);
  return (
    <Marker coordinate={{ latitude: entry.latitude, longitude: entry.longitude }} anchor={{ x: 0.5, y: 0.94 }} tracksViewChanges={tracking}
      zIndex={selected ? 2000 : 1000} onPress={onPress} accessibilityLabel={`${number}. ${entry.name}`}>
      <View style={styles.pinBox} collapsable={false}>
        <View style={[styles.drop, { backgroundColor: planKind(entry).color }, selected && styles.dropOn]}>
          <Text maxFontSizeMultiplier={1} style={styles.dropNumber}>{number}</Text>
        </View>
      </View>
    </Marker>
  );
});

// A saved video or link: a round pin with its cover.
const IdeaPin = memo(function IdeaPin({ idea, selected, onPress }: { idea: MapIdea; selected: boolean; onPress(): void }) {
  const [loaded, setLoaded] = useState(!idea.image);
  const [failed, setFailed] = useState(false);
  const tracking = useTracking(`${selected}:${loaded}:${failed}`, loaded || failed);
  return (
    <Marker coordinate={{ latitude: idea.latitude, longitude: idea.longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracking}
      zIndex={selected ? 2000 : 500} onPress={onPress} accessibilityLabel={idea.title || 'Saved idea'}>
      <View style={styles.ideaBox} collapsable={false}>
        <View style={[styles.ideaPin, selected && styles.ideaPinOn]}>
          {idea.image && !failed ? <Image source={{ uri: idea.image }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
            : <View style={[styles.ideaFill, { backgroundColor: ideaKind(idea).color }]} />}
        </View>
      </View>
    </Marker>
  );
});

// A tapped plan: its kind and day, rating, and open it or get directions.
function PlanDetail({ entry, onClose, onOpen }: { entry: Entry; onClose(): void; onOpen(): void }) {
  const rating = googleRatingLabel(entry);
  const maps = placeMapsURL(entry);
  return (
    <View style={styles.detail}>
      <View style={styles.detailTop}>
        <PlaceMarker item={entry} size={56} />
        <View style={styles.flex}>
          <Display size="sheet" numberOfLines={2}>{entry.name}</Display>
          <Text style={styles.detailMeta}>{[planKind(entry).label, formatDay(entry.day, { weekday: 'short', month: 'short', day: 'numeric' }), entry.time ? formatClock(entry.time) : ''].filter(Boolean).join(' · ')}</Text>
          {rating ? <View style={styles.ratingRow}><Icon name="star" size={13} color={palette.ink} strokeWidth={2.2} /><Text style={styles.detailMuted}>{`Google ${rating}`}</Text></View> : null}
        </View>
        <IconButton icon="close" label="Close" variant="soft" onPress={onClose} iconSize={16} size={40} />
      </View>
      <View style={styles.detailActions}>
        <Button label="Open plan" size="sm" onPress={onOpen} />
        {maps ? <Button label="Directions" size="sm" variant="outline" icon="directions" onPress={() => Linking.openURL(maps)} /> : null}
      </View>
    </View>
  );
}

// A tapped idea: cover, place and source, watch it or get directions, and
// "Add to which day?".
function IdeaDetail({ trip, idea, error, onClose, onPick, onNeedDates }: { trip: Trip; idea: MapIdea; error: string; onClose(): void; onPick(day: string): void; onNeedDates(): void }) {
  const source = providerLabel(idea);
  const maps = placeMapsURL(idea as never);
  const dated = (datesForTrip(trip) as string[]).length > 0;
  return (
    <View style={styles.detail}>
      <View style={styles.detailTop}>
        <Cover image={idea.image} badge={PROVIDERS[idea.provider || '']} style={styles.detailCover} />
        <View style={styles.flex}>
          <Display size="sheet" numberOfLines={3}>{idea.title || 'Saved idea'}</Display>
          <View style={styles.ratingRow}>
            <View style={[styles.kindDot, { backgroundColor: ideaKind(idea).color }]} />
            <Text style={styles.detailMeta} numberOfLines={1}>{[ideaKind(idea).label, idea.location].filter(Boolean).join(' · ')}</Text>
          </View>
          {source ? <Text style={styles.detailMuted} numberOfLines={1}>{`Saved from ${source}`}</Text> : null}
          <View style={styles.detailActions}>
            {idea.url ? <Button label="Watch" size="sm" variant="outline" onPress={() => Linking.openURL(idea.url!)} /> : null}
            {maps ? <Button label="Directions" size="sm" variant="outline" onPress={() => Linking.openURL(maps)} /> : null}
          </View>
        </View>
        <IconButton icon="close" label="Close" variant="soft" onPress={onClose} iconSize={16} size={40} />
      </View>
      <Display size="card">Add to which day?</Display>
      {dated ? <DayChips trip={trip} idea={idea} onPick={onPick} inset={0} /> : <Button label="Choose your dates first" variant="outline" size="sm" onPress={onNeedDates} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  frame: { flex: 1, overflow: 'hidden', backgroundColor: '#F5F3EE' },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F3EE' },
  loadingText: { fontFamily: typefaces.semibold, fontSize: 13, color: palette.muted },
  top: { position: 'absolute', top: 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  switch: {
    flex: 1, flexDirection: 'row', gap: 2, padding: 4, borderRadius: radii.pill, backgroundColor: palette.paper,
    shadowColor: palette.ink, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  switchTab: { flex: 1, minHeight: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  switchTabOn: { backgroundColor: palette.ink },
  switchText: { fontFamily: typefaces.semibold, fontSize: 13, color: palette.ink },
  switchTextOn: { fontFamily: typefaces.bold, color: palette.paper },
  switchTextOff: { color: palette.faint },
  mapLink: { shadowColor: palette.ink, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingHorizontal: gutter, gap: 10,
    borderTopLeftRadius: 30, borderTopRightRadius: 30, borderCurve: 'continuous', backgroundColor: palette.cream,
    shadowColor: palette.ink, shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 4, backgroundColor: palette.grabber },
  panelHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dayTrigger: { flexShrink: 1 },
  panelTitle: { flexShrink: 1, fontFamily: typefaces.display, fontSize: 22, color: palette.ink },
  panelCount: { fontFamily: typefaces.semibold, fontSize: 13, color: palette.muted },
  rows: { gap: 8, paddingBottom: 4 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radii.md, borderCurve: 'continuous', borderWidth: strokes.thin, borderColor: palette.line, backgroundColor: palette.paper },
  pressed: { backgroundColor: palette.sand },
  rowNumber: { width: 30, height: 30, borderRadius: 15, borderWidth: strokes.mid, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  rowNumberText: { fontFamily: typefaces.display, fontSize: 14, color: palette.ink },
  rowCover: { width: 30, height: 40, borderRadius: 8 },
  rowName: { fontFamily: typefaces.bold, fontSize: 15, color: palette.ink },
  rowMeta: { fontFamily: typefaces.medium, fontSize: 12, color: palette.muted },
  rowTime: { fontFamily: typefaces.heavy, fontSize: 14, color: palette.ink },
  chevron: { transform: [{ rotate: '-90deg' }] },
  pinBox: { width: 48, height: 52, alignItems: 'center', justifyContent: 'center' },
  // A rounded square with one sharp corner, turned so the corner points down.
  drop: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: strokes.heavy, borderColor: palette.ink,
    borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 4, transform: [{ rotate: '-45deg' }],
  },
  dropOn: { borderColor: palette.ink, transform: [{ rotate: '-45deg' }, { scale: 1.15 }] },
  dropNumber: { fontFamily: typefaces.display, fontSize: 15, color: palette.ink, transform: [{ rotate: '45deg' }] },
  ideaBox: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  ideaPin: { width: 40, height: 40, overflow: 'hidden', borderRadius: 20, borderWidth: strokes.heavy, borderColor: palette.ink, backgroundColor: palette.paper },
  ideaPinOn: { width: 46, height: 46, borderRadius: 23, borderColor: palette.yellow, borderWidth: 3.5 },
  ideaFill: { flex: 1 },
  detail: { gap: 12, paddingBottom: 4 },
  detailTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  detailCover: { width: 86, height: 120 },
  detailMeta: { flexShrink: 1, fontFamily: typefaces.semibold, fontSize: 13, color: palette.ink },
  detailMuted: { fontFamily: typefaces.semibold, fontSize: 13, color: palette.muted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  kindDot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: palette.ink },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  error: { fontFamily: typefaces.semibold, fontSize: 13, color: palette.danger },
});
