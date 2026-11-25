import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Constants from 'expo-constants';
import { mapViewURL, placeMapsURL } from '@trippilot/core/maps-links';
import { googleRatingLabel, mapEntries } from '@trippilot/core/place-model';
import { placeIcon } from '@trippilot/core/place-search';
import { datesForStop } from '@trippilot/core/trip-model';
import { Icon } from '../icons';
import type { SymbolName } from '../icon-symbols';
import { colors, fonts, sq } from '@/lib/theme';
import type { PlanItem, Trip } from '@/lib/trips';

// Google Maps on iOS needs GOOGLE_MAPS_IOS_KEY at build time (app.config.js).
// Without it the same pins and card draw on Apple Maps.
const provider = Constants.expoConfig?.extra?.googleMapsIOS ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

type Entry = PlanItem & { planned: boolean; number?: number; latitude: number; longitude: number; placeId?: string; name: string; category?: string; rating?: number; ratingCount?: number };
type Point = { latitude: number; longitude: number };
type Size = { width: number; height: number };

// Google's zoom levels as a region for this map's size, so the camera matches
// the site's moveCamera({ zoom }) on both Google and Apple Maps.
function regionAt(point: Point, zoom: number, size: Size): Region {
  const longitudeDelta = (360 * size.width) / (256 * 2 ** zoom);
  return { ...point, longitudeDelta, latitudeDelta: longitudeDelta * (size.height / size.width) * Math.cos((point.latitude * Math.PI) / 180) };
}
const zoomOf = (region: Region, size: Size) => Math.log2((360 * size.width) / (256 * region.longitudeDelta));

// #map-column on phones: the Explore tab's map with a pin for every plan in
// the chosen stop (drawMarkers in app.js) and the card a tapped pin opens
// (showMapEntry). Nearby suggestions and "Search places" come with Explore.
export function ExploreMap({ trip, stopFilter, onOpenPlan }: { trip: Trip; stopFilter: string | null; onOpenPlan(placeId: string): void }) {
  const map = useRef<MapView>(null);
  const window = useWindowDimensions();
  const [size, setSize] = useState<Size>({ width: window.width, height: window.height - 260 });
  const [ready, setReady] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [chosen, setActive] = useState<Entry | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const stops = trip.stops || [];
  const stop = stops.find(item => item.placeId === stopFilter) || stops[0];

  const entries = useMemo(() => {
    const days = stopFilter ? datesForStop(trip, stopFilter) as string[] : null;
    const items = days ? (trip.items || []).filter(item => days.includes(item.day)) : trip.items || [];
    return mapEntries(items, [], { timeZone: trip.timeZone || 'UTC' }) as Entry[];
  }, [trip, stopFilter]);
  // The open card, while its plan is still on the map.
  const active = (chosen && entries.find(entry => (entry.placeId || entry.id) === (chosen.placeId || chosen.id))) || null;

  // Choosing another stop flies there (showMap(stop, true)) and closes the card.
  const shown = useRef(stop?.placeId);
  useEffect(() => {
    if (!stop || shown.current === stop.placeId) return;
    shown.current = stop.placeId; setActive(null);
    map.current?.animateToRegion(regionAt(stop, 12, size), 850);
  }, [stop, size]);

  // The card follows its pin while the map moves, like Google's InfoWindow.
  const place = useCallback((entry: Entry | null) => {
    if (!entry || !map.current) { setAnchor(null); return; }
    map.current.pointForCoordinate(entry).then(setAnchor, () => setAnchor(null));
  }, []);
  useEffect(() => { place(active); }, [active, size, place]);

  function open(entry: Entry) {
    setActive(null);
    map.current?.animateToRegion(regionAt(entry, 15, size), 850);
    setTimeout(() => setActive(entry), 860);
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
        {entries.map(entry => <PlacePin key={entry.placeId || entry.id} entry={entry} selected={(active?.placeId || active?.id) === (entry.placeId || entry.id)} onPress={() => open(entry)} />)}
      </MapView>
      {active && anchor ? <MapCard key={active.placeId || active.id} entry={active} anchor={anchor} mapWidth={size.width} onClose={() => setActive(null)}
        onEdit={() => { setActive(null); onOpenPlan(active.placeId || active.id); }} /> : null}
      {link ? (
        <Pressable accessibilityRole="link" accessibilityLabel="Open this map in Google Maps" onPress={() => Linking.openURL(link)} style={({ pressed }) => [styles.openLink, pressed && styles.openLinkPressed]}>
          <Icon name="external" size={20} color={colors.action} />
        </Pressable>
      ) : null}
      {!ready ? <View style={styles.loading}><ActivityIndicator color={colors.muted} /><Text style={styles.loadingText}>Loading map</Text></View> : null}
    </View>
  );
}

// .map-place-pin: a 44pt squircle with the place's icon; planned places get the
// orange frame and their number in the itinerary.
const PlacePin = memo(function PlacePin({ entry, selected, onPress }: { entry: Entry; selected: boolean; onPress(): void }) {
  // Pins are snapshots on Google Maps: redraw only until the icon has rendered.
  const look = `${selected}:${entry.number}:${entry.planned}`;
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => { const timer = setTimeout(() => setDrawn(look), 600); return () => clearTimeout(timer); }, [look]);
  const tracking = drawn !== look;
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

// The InfoWindow from showMapEntry(): name, category and rating, then the
// plan and Google Maps buttons. It springs up from the pin (playMotion, 360ms).
function MapCard({ entry, anchor, mapWidth, onClose, onEdit }: { entry: Entry; anchor: { x: number; y: number }; mapWidth: number; onClose(): void; onEdit(): void }) {
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
  const rating = googleRatingLabel(entry);
  const maps = placeMapsURL(entry);
  return (
    <Animated.View style={[styles.cardWrap, { left, width, top: height ? anchor.y - 26 - height : -9999 }, motion]} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle} numberOfLines={3}>{entry.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={({ pressed }) => [styles.cardClose, pressed && styles.cardClosePressed]}>
            <Icon name="close" size={18} color="#000000" strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.cardBody}>
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
        </View>
      </View>
      <View style={[styles.tail, { marginLeft: anchor.x - left - 12.5 }]} />
    </Animated.View>
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
  actions: { flexDirection: 'row', gap: 6 },
  iconAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: sq(16), borderCurve: 'continuous', backgroundColor: colors.soft },
  iconActionPressed: { backgroundColor: '#ebecef' },
  // Google's InfoWindow tail: 25×12, pointing at the pin.
  tail: { width: 0, height: 0, borderLeftWidth: 12.5, borderRightWidth: 12.5, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.white },
});
