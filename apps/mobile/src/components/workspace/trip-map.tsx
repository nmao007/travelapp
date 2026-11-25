import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/text';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Constants from 'expo-constants';
import { isContentIdea } from '@trippilot/core/board-model';
import { datesForTrip } from '@trippilot/core/itinerary-model';
import { mapViewURL, placeMapsURL } from '@trippilot/core/maps-links';
import { googleRatingLabel, mapEntries } from '@trippilot/core/place-model';
import { placeIcon } from '@trippilot/core/place-search';
import { datesForStop } from '@trippilot/core/trip-model';
import { Art, Icon } from '../icons';
import type { SymbolName } from '../icon-symbols';
import { DayPicker, ideaOnDay, ideaScheduled, providerLabel, type Idea } from './ideas-view';
import { formatDay } from '@/lib/format';
import { colors, fonts, sq } from '@/lib/theme';
import type { PlanItem, Trip } from '@/lib/trips';

// Google Maps on iOS needs GOOGLE_MAPS_IOS_KEY at build time (app.config.js).
// Without it the same pins and cards draw on Apple Maps.
const provider = Constants.expoConfig?.extra?.googleMapsIOS ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

type Entry = PlanItem & { planned: boolean; number?: number; latitude: number; longitude: number; placeId?: string; name: string; category?: string; rating?: number; ratingCount?: number };
type MapIdea = Idea & { latitude: number; longitude: number };
type Point = { latitude: number; longitude: number };
type Size = { width: number; height: number };
type Chosen = { kind: 'plan' | 'idea'; key: string };

const planKey = (entry: { placeId?: string; id: string }) => entry.placeId || entry.id;

// Google's zoom levels as a region for this map's size, so the camera matches
// the site's moveCamera({ zoom }) on both Google and Apple Maps.
function regionAt(point: Point, zoom: number, size: Size): Region {
  const longitudeDelta = (360 * size.width) / (256 * 2 ** zoom);
  return { ...point, longitudeDelta, latitudeDelta: longitudeDelta * (size.height / size.width) * Math.cos((point.latitude * Math.PI) / 180) };
}
const zoomOf = (region: Region, size: Size) => Math.log2((360 * size.width) / (256 * region.longitudeDelta));

// The Map tab: a numbered pin for every plan in the chosen stop (drawMarkers
// in the site's app.js) and the card a tapped pin opens (showMapEntry), plus
// a pin with its cover for every saved video or link that has a place.
export function TripMap({ trip, stopFilter, commit, onNotice, onNeedDates, onOpenPlan }: {
  trip: Trip; stopFilter: string | null; commit(trip: Trip): void; onNotice(message: string): void; onNeedDates(): void; onOpenPlan(placeId: string): void;
}) {
  const map = useRef<MapView>(null);
  const window = useWindowDimensions();
  const [size, setSize] = useState<Size>({ width: window.width, height: window.height - 260 });
  const [ready, setReady] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [scheduling, setScheduling] = useState<Idea | null>(null);
  const stops = trip.stops || [];
  const stop = stops.find(item => item.placeId === stopFilter) || stops[0];

  const entries = useMemo(() => {
    const days = stopFilter ? datesForStop(trip, stopFilter) as string[] : null;
    const items = days ? (trip.items || []).filter(item => days.includes(item.day)) : trip.items || [];
    return mapEntries(items, [], { timeZone: trip.timeZone || 'UTC' }) as Entry[];
  }, [trip, stopFilter]);
  // Saved ideas with a place, except where that place is already a plan pin.
  const ideas = useMemo(() => {
    const planned = new Set(entries.map(planKey));
    return ((trip.boardItems as Idea[] | undefined) || []).filter((idea): idea is MapIdea =>
      isContentIdea(idea) && Number.isFinite(idea.latitude) && Number.isFinite(idea.longitude) && !(idea.placeId && planned.has(idea.placeId)));
  }, [trip.boardItems, entries]);

  // The open card, while its pin is still on the map.
  const activePlan = chosen?.kind === 'plan' ? entries.find(entry => planKey(entry) === chosen.key) || null : null;
  const activeIdea = chosen?.kind === 'idea' ? ideas.find(idea => idea.id === chosen.key) || null : null;
  const active: Point | null = activePlan || activeIdea;

  // Choosing another stop flies there (showMap(stop, true)) and closes the card.
  const shown = useRef(stop?.placeId);
  useEffect(() => {
    if (!stop || shown.current === stop.placeId) return;
    shown.current = stop.placeId; setChosen(null);
    map.current?.animateToRegion(regionAt(stop, 12, size), 850);
  }, [stop, size]);

  // Once the map is up, frame every pin (plans and saved places) so none sit off
  // screen; with one pin or none, the destination view above stays.
  const framed = useRef(false);
  useEffect(() => {
    if (!ready || framed.current) return;
    framed.current = true;
    const points = [...entries, ...ideas].map(({ latitude, longitude }) => ({ latitude, longitude }));
    if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 80, right: 60, bottom: 120, left: 60 }, animated: false });
    else if (points.length === 1) map.current?.animateToRegion(regionAt(points[0], 14, size), 0);
  }, [ready, entries, ideas, size]);

  // The card follows its pin while the map moves, like Google's InfoWindow.
  const place = useCallback((point: Point | null) => {
    if (!point || !map.current) { setAnchor(null); return; }
    map.current.pointForCoordinate(point).then(setAnchor, () => setAnchor(null));
  }, []);
  useEffect(() => { place(active); }, [active, size, place]);

  // A tapped pin zooms in first, then its card opens (animateMap(entry, 15)).
  function open(next: Chosen, point: Point) {
    setChosen(null);
    map.current?.animateToRegion(regionAt(point, 15, size), 850);
    setTimeout(() => setChosen(next), 860);
  }
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width && height && (width !== size.width || height !== size.height)) setSize({ width, height });
  };
  const link = mapViewURL(region ? { latitude: region.latitude, longitude: region.longitude } : stop, region ? zoomOf(region, size) : 12);

  if (!stop) return <View style={styles.frame} />;
  return (
    <View style={styles.frame} onLayout={onLayout}>
      <MapView ref={map} provider={provider} style={StyleSheet.absoluteFill} initialRegion={regionAt(stop, 12, size)}
        onMapReady={() => setReady(true)} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false} showsCompass={false}
        onRegionChange={() => place(active)} onRegionChangeComplete={next => { setRegion(next); place(active); }}>
        {ideas.map(idea => <IdeaPin key={idea.id} idea={idea} selected={activeIdea?.id === idea.id} onPress={() => open({ kind: 'idea', key: idea.id }, idea)} />)}
        {entries.map(entry => <PlacePin key={planKey(entry)} entry={entry} selected={activePlan ? planKey(activePlan) === planKey(entry) : false} onPress={() => open({ kind: 'plan', key: planKey(entry) }, entry)} />)}
      </MapView>
      {activePlan && anchor ? (
        <MapCard key={`plan:${planKey(activePlan)}`} title={activePlan.name} anchor={anchor} mapWidth={size.width} onClose={() => setChosen(null)}>
          <PlanCardBody entry={activePlan} onEdit={() => { setChosen(null); onOpenPlan(planKey(activePlan)); }} />
        </MapCard>
      ) : null}
      {activeIdea && anchor ? (
        <MapCard key={`idea:${activeIdea.id}`} title={activeIdea.title || 'Saved idea'} anchor={anchor} mapWidth={size.width} onClose={() => setChosen(null)}>
          <IdeaCardBody idea={activeIdea} scheduled={ideaScheduled(trip, activeIdea)}
            onSchedule={() => { if (!datesForTrip(trip).length) { onNeedDates(); return; } setScheduling(activeIdea); }} />
        </MapCard>
      ) : null}
      {link ? (
        <Pressable accessibilityRole="link" accessibilityLabel="Open this map in Google Maps" onPress={() => Linking.openURL(link)} style={({ pressed }) => [styles.openLink, pressed && styles.openLinkPressed]}>
          <Icon name="external" size={20} color={colors.action} />
        </Pressable>
      ) : null}
      {!ready ? <View style={styles.loading}><ActivityIndicator color={colors.muted} /><Text style={styles.loadingText}>Loading map</Text></View> : null}
      <DayPicker trip={trip} idea={scheduling} onClose={() => setScheduling(null)} onPick={day => {
        try { commit(ideaOnDay(trip, scheduling!, day)); onNotice(`Added to ${formatDay(day)}`); return null; }
        catch (error) { return (error as Error).message; }
      }} />
    </View>
  );
}

// Pins are snapshots on Google Maps: redraw only until the content has drawn.
function useTracking(look: string, ready = true) {
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => { if (!ready) return; const timer = setTimeout(() => setDrawn(look), 400); return () => clearTimeout(timer); }, [look, ready]);
  return drawn !== look;
}

// .map-place-pin: a 44pt squircle with the place's icon; planned places get the
// orange frame and their number in the itinerary.
const PlacePin = memo(function PlacePin({ entry, selected, onPress }: { entry: Entry; selected: boolean; onPress(): void }) {
  const tracking = useTracking(`${selected}:${entry.number}:${entry.planned}`);
  const planned = entry.planned;
  return (
    <Marker coordinate={{ latitude: entry.latitude, longitude: entry.longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracking}
      zIndex={planned ? 1000 : 1} onPress={onPress} accessibilityLabel={entry.name}>
      <View style={styles.pinBox} collapsable={false}>
        <View style={[styles.pin, { backgroundColor: planned || selected ? '#ef7547' : '#dce0e6' }]}>
          <View style={styles.pinFill}>
            <View style={[styles.pinSymbol, planned ? styles.plannedSymbol : styles.suggestedSymbol]}>
              <Icon name={placeIcon(entry) as SymbolName} size={17} color={planned ? '#bf5027' : '#697386'} />
            </View>
          </View>
        </View>
        {planned && entry.number ? <View style={styles.order}><Text style={styles.orderText}>{entry.number}</Text></View> : null}
      </View>
    </Marker>
  );
});

// A saved video or link: the same 44pt squircle, filled with its cover, so
// ideas read as "things you saved" next to the numbered plans.
const IdeaPin = memo(function IdeaPin({ idea, selected, onPress }: { idea: MapIdea; selected: boolean; onPress(): void }) {
  const [loaded, setLoaded] = useState(!idea.image);
  const [failed, setFailed] = useState(false);
  const tracking = useTracking(`${selected}:${loaded}:${failed}`, loaded || failed);
  return (
    <Marker coordinate={{ latitude: idea.latitude, longitude: idea.longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracking}
      zIndex={500} onPress={onPress} accessibilityLabel={idea.title || 'Saved idea'}>
      <View style={styles.pinBox} collapsable={false}>
        <View style={[styles.pin, { backgroundColor: selected ? '#242424' : '#ffffff' }, styles.ideaPinShadow]}>
          <View style={styles.ideaCover}>
            {idea.image && !failed ? <Image source={{ uri: idea.image }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
              : <Art name="ideas" size={24} />}
          </View>
        </View>
      </View>
    </Marker>
  );
});

// The card a tapped pin opens, styled after Google's InfoWindow on the site
// (showMapEntry). It springs up from the pin (playMotion, 360ms).
function MapCard({ title, anchor, mapWidth, onClose, children }: { title: string; anchor: { x: number; y: number }; mapWidth: number; onClose(): void; children: ReactNode }) {
  const [height, setHeight] = useState(0);
  const enter = useSharedValue(0);
  // The tail's tip sits 26pt above the pin's center (pixelOffset -48 in app.js).
  useEffect(() => { if (height) enter.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.ease) }); }, [enter, height > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const motion = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.72, 1], [0.2, 1, 1]),
    transform: [{ translateY: interpolate(enter.value, [0, 0.72, 1], [12, -2, 0]) }, { scale: interpolate(enter.value, [0, 0.72, 1], [0.94, 1.015, 1]) }],
  }));
  const width = Math.max(160, Math.min(244, mapWidth - 64)) + 5;
  const left = Math.max(8, Math.min(mapWidth - width - 8, anchor.x - width / 2));
  return (
    <Animated.View style={[styles.cardWrap, { left, width, top: height ? anchor.y - 26 - height : -9999 }, motion]} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle} numberOfLines={3}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={({ pressed }) => [styles.cardClose, pressed && styles.cardClosePressed]}>
            <Icon name="close" size={18} color="#000000" strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.cardBody}>{children}</View>
      </View>
      <View style={[styles.tail, { marginLeft: anchor.x - left - 12.5 }]} />
    </Animated.View>
  );
}

// A plan: category and rating, then open the saved plan and Google Maps.
function PlanCardBody({ entry, onEdit }: { entry: Entry; onEdit(): void }) {
  const rating = googleRatingLabel(entry);
  const maps = placeMapsURL(entry);
  return (
    <>
      <View style={styles.meta}>
        {entry.category ? <Text style={styles.category}>{entry.category}</Text> : null}
        <View style={styles.rating} accessibilityRole="text">
          {rating ? <><Icon name="star" size={14} color="#b87513" /><Text style={styles.ratingText}>{rating}</Text></> : <Text style={[styles.ratingText, styles.ratingMuted]}>Rating unavailable</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open saved plan" onPress={onEdit} style={({ pressed }) => [styles.iconAction, pressed && styles.iconActionPressed]}>
          <Icon name="edit" size={17} color={colors.muted} />
        </Pressable>
        {maps ? (
          <Pressable accessibilityRole="link" accessibilityLabel="Google Maps" onPress={() => Linking.openURL(maps)} style={({ pressed }) => [styles.iconAction, pressed && styles.iconActionPressed]}>
            <Icon name="external" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

function Cover({ image }: { image?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.ideaThumb}>
      {image && !failed ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
        : <Art name="ideas" size={24} />}
    </View>
  );
}

// A saved idea: its cover, place and source, then add it to a day or open
// the video.
function IdeaCardBody({ idea, scheduled, onSchedule }: { idea: MapIdea; scheduled: boolean; onSchedule(): void }) {
  const source = providerLabel(idea);
  return (
    <>
      <View style={styles.ideaRow}>
        <Cover image={idea.image} />
        <View style={styles.ideaCopy}>
          {idea.location ? <View style={styles.ideaPlace}><Icon name="pin" size={14} color={colors.action} /><Text style={styles.ideaLocation} numberOfLines={2}>{idea.location}</Text></View> : null}
          {source ? <Text style={styles.category} numberOfLines={1}>{source}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onSchedule} style={({ pressed }) => [styles.primary, scheduled && styles.primaryDone, pressed && (scheduled ? styles.primaryDonePressed : styles.primaryPressed)]}>
          <Icon name={scheduled ? 'check' : 'calendar'} size={16} color={scheduled ? colors.action : colors.white} />
          <Text style={[styles.primaryText, scheduled && styles.primaryDoneText]}>{scheduled ? 'In plan' : 'Add to day'}</Text>
        </Pressable>
        {idea.url ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Open ${source || 'link'}`} onPress={() => Linking.openURL(idea.url!)} style={({ pressed }) => [styles.iconAction, pressed && styles.iconActionPressed]}>
            <Icon name="external" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden', backgroundColor: colors.soft },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.soft },
  loadingText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  // .map-open-link: 44pt, 14pt from the top and 12pt from the right.
  openLink: {
    position: 'absolute', top: 14, right: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.line, borderRadius: sq(18), borderCurve: 'continuous', backgroundColor: colors.white,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 13, shadowOffset: { width: 0, height: 8 },
  },
  openLinkPressed: { backgroundColor: '#fff2eb' },
  // The badge sits 3pt outside the pin, so the snapshot gets a 3pt margin.
  pinBox: { width: 50, height: 50, padding: 3 },
  pin: { width: 44, height: 44, padding: 1, borderRadius: sq(22), borderCurve: 'continuous' },
  pinFill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: sq(21), borderCurve: 'continuous', backgroundColor: colors.white },
  pinSymbol: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: sq(17), borderCurve: 'continuous' },
  plannedSymbol: { backgroundColor: '#fff2ea' },
  suggestedSymbol: { backgroundColor: '#f2f4f8' },
  order: { position: 'absolute', top: 0, right: 0, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: sq(9), borderCurve: 'continuous', backgroundColor: '#ed703d' },
  orderText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.white },
  ideaPinShadow: { padding: 2, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  ideaCover: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: sq(20), borderCurve: 'continuous', backgroundColor: '#fff2eb' },
  cardWrap: { position: 'absolute', transformOrigin: '50% 100%' },
  card: {
    padding: 12, borderRadius: sq(26), borderCurve: 'continuous', backgroundColor: colors.white,
    shadowColor: '#202838', shadowOpacity: 0.11, shadowRadius: 9, shadowOffset: { width: 0, height: 4 },
  },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  cardTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.ink },
  cardClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous' },
  cardClosePressed: { backgroundColor: colors.pressed },
  cardBody: { gap: 8 },
  meta: { gap: 2 },
  category: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19.6, color: colors.muted },
  rating: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.ink },
  ratingMuted: { color: colors.muted },
  ideaRow: { flexDirection: 'row', gap: 10 },
  // The Ideas tab's 84×112 cover, smaller.
  ideaThumb: { width: 48, height: 64, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: sq(12), borderCurve: 'continuous', backgroundColor: '#fff2eb' },
  ideaCopy: { flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' },
  ideaPlace: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  ideaLocation: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.action },
  actions: { flexDirection: 'row', gap: 6 },
  primary: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: sq(18), borderCurve: 'continuous', backgroundColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accentPressed },
  primaryDone: { backgroundColor: '#fff2eb' },
  primaryDonePressed: { backgroundColor: '#ffe6d6' },
  primaryText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.white },
  primaryDoneText: { color: colors.action },
  iconAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: sq(16), borderCurve: 'continuous', backgroundColor: colors.soft },
  iconActionPressed: { backgroundColor: '#ebecef' },
  // Google's InfoWindow tail: 25×12, pointing at the pin.
  tail: { width: 0, height: 0, borderLeftWidth: 12.5, borderRightWidth: 12.5, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.white },
});
