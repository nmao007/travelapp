import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { tripStops } from '@trippilot/core/trip-model';
import { AccountSheet } from '@/components/account-sheet';
import { DestinationSearch } from '@/components/destination-search';
import { RecentTrip, tripCounts, tripDateLabel, tripTile } from '@/components/recent-trip';
import { UnsortedIdeasLink } from '@/components/saved-videos';
import { TopBar } from '@/components/top-bar';
import { Accent, Button, Display, Raised, Sticker } from '@/components/ui';
import { gutter, palette, radii, strokes, typefaces } from '@/lib/design';
import { useTrips, type Trip } from '@/lib/trips';

// Other trips listed on home; the rest are on the Your trips page.
const HOME_TRIPS = 4;

const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const daysUntil = (date: string) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) / 86_400_000);

// The trip to lead with: one under way, else the next to start, else the
// most recently changed.
function upNext(trips: Trip[]) {
  const now = today();
  const dated = trips.filter(trip => trip.startDate && trip.endDate && trip.endDate >= now).sort((a, b) => a.startDate!.localeCompare(b.startDate!));
  return dated[0] || trips[0] || null;
}
function countdown(trip: Trip) {
  if (!trip.startDate || !trip.endDate) return 'PLANNING ✦';
  const start = daysUntil(trip.startDate);
  if (start <= 0 && daysUntil(trip.endDate) >= 0) return 'ON NOW ✦';
  if (start < 0) return 'BEEN THERE';
  return start === 0 ? 'TODAY ✦' : start === 1 ? 'TOMORROW ✦' : `IN ${start} DAYS ✦`;
}

// Home: "Where to next?", the destination search, the trip coming up, new
// videos from the share inbox, and the other trips.
export default function Home() {
  const { trips, homeStatus } = useTrips();
  const [accountOpen, setAccountOpen] = useState(false);

  const reduced = useReducedMotion();
  const welcome = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { if (!reduced) welcome.set(withTiming(1, { duration: 320, easing: Easing.out(Easing.ease) })); }, [reduced, welcome]);
  const titleStyle = useAnimatedStyle(() => ({ opacity: welcome.value, transform: [{ translateY: (1 - welcome.value) * 10 }] }));

  const next = upNext(trips);
  const others = trips.filter(trip => trip !== next);
  const open = (trip: Trip) => router.push({ pathname: '/trip/[id]', params: { id: trip.id } });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <TopBar onSignIn={() => setAccountOpen(true)} />
      <ScrollView contentContainerStyle={styles.home} keyboardShouldPersistTaps="handled">
        <Animated.View style={titleStyle}>
          <Display size="hero" accessibilityRole="header">Where to</Display>
          <Display size="hero" style={styles.next}><Accent color={palette.pink} size={58}>next?</Accent></Display>
        </Animated.View>
        <DestinationSearch />
        {homeStatus ? <Text style={styles.status} accessibilityLiveRegion="polite">{homeStatus}</Text> : null}

        {next ? <UpNext trip={next} index={trips.indexOf(next)} count={trips.filter(trip => trip.endDate && trip.endDate >= today()).length} onPress={() => open(next)} /> : null}

        <UnsortedIdeasLink />

        {others.length ? (
          <View style={styles.section}>
            <Display size="section" accessibilityRole="header">Also brewing</Display>
            <View style={styles.list}>
              {others.slice(0, HOME_TRIPS).map(trip => <RecentTrip key={trip.id} trip={trip} index={trips.indexOf(trip)} onPress={() => open(trip)} />)}
            </View>
          </View>
        ) : null}
        {trips.length > 1 ? <Button label={`All trips · ${trips.length}`} variant="outline" onPress={() => router.push('/trips')} style={styles.allTrips} /> : null}
      </ScrollView>
      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </SafeAreaView>
  );
}

// The trip coming up: its color, a countdown sticker, the first stop in big
// type with the rest in serif, the dates and what's saved.
function UpNext({ trip, index, count, onPress }: { trip: Trip; index: number; count: number; onPress(): void }) {
  const stops = tripStops(trip) as Trip['stops'];
  const title = trip.title?.trim() || stops[0]?.name || trip.name;
  const later = !trip.title?.trim() && stops.length > 1 ? stops.slice(1).map(stop => stop.name).join(', ') : '';
  const counts = tripCounts(trip);
  const tile = tripTile(index);
  const dark = tile.fill === palette.blue;
  const ink = dark ? palette.paper : palette.ink;
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Display size="section" accessibilityRole="header">Up next</Display>
        {count > 1 ? <Text style={styles.headingMeta}>{`${count} upcoming`}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${tripDateLabel(trip)}. Open trip`} onPress={onPress}>
        {({ pressed }) => (
          <Raised offset={6} radius={34} pressed={pressed}>
            <View style={[styles.upNext, { backgroundColor: tile.fill }]}>
              <Sticker style={styles.sticker}>{countdown(trip)}</Sticker>
              <Display size="hero" color={ink} numberOfLines={2} style={styles.upNextTitle}>{title}</Display>
              <View style={styles.upNextRow}>
                <Text style={[styles.upNextDates, { color: ink }]}>
                  {tripDateLabel(trip)}
                  {later ? <Accent color={ink} size={17}>{` · then ${later}`}</Accent> : null}
                </Text>
                {counts ? <Text style={styles.counts}>{counts}</Text> : null}
              </View>
            </View>
          </Raised>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  home: { paddingTop: 16, paddingHorizontal: gutter, paddingBottom: 40, gap: 18 },
  next: { marginTop: -6, marginLeft: 4 },
  status: { fontFamily: typefaces.semibold, fontSize: 13, lineHeight: 19, color: palette.muted },
  section: { gap: 12, marginTop: 6 },
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  headingMeta: { fontFamily: typefaces.semibold, fontSize: 13, color: palette.muted },
  upNext: { gap: 6, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 18, borderRadius: 34, borderCurve: 'continuous', borderWidth: strokes.heavy, borderColor: palette.ink, overflow: 'hidden' },
  sticker: { marginBottom: 6 },
  upNextTitle: { fontSize: 52, lineHeight: 52 },
  upNextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  upNextDates: { flexShrink: 1, fontFamily: typefaces.semibold, fontSize: 15 },
  counts: { overflow: 'hidden', paddingVertical: 5, paddingHorizontal: 11, borderRadius: radii.pill, backgroundColor: palette.paper, fontFamily: typefaces.bold, fontSize: 13, color: palette.ink },
  list: { gap: 12 },
  allTrips: { marginTop: 4 },
});
