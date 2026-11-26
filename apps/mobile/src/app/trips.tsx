import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecentTrip } from '@/components/recent-trip';
import { Display, PageHeader } from '@/components/ui';
import { gutter, palette } from '@/lib/design';
import { useTrips, type Trip } from '@/lib/trips';

const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };

// Every trip, opened from home's "All trips": upcoming ones (and ones without
// dates yet), then the ones already over.
export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const { trips } = useTrips();
  const now = today();
  const past = trips.filter(trip => trip.endDate && trip.endDate < now);
  const upcoming = trips.filter(trip => !past.includes(trip));
  const open = (trip: Trip) => router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
  const section = (title: string, list: Trip[]) => list.length ? (
    <View style={styles.section}>
      <Display size="section" accessibilityRole="header">{`${title} · ${list.length}`}</Display>
      {list.map(trip => <RecentTrip key={trip.id} trip={trip} index={trips.indexOf(trip)} onPress={() => open(trip)} />)}
    </View>
  ) : null;
  return (
    <View style={styles.screen}>
      <PageHeader title="Your trips" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}>
        {section('Upcoming', upcoming)}
        {section('Been there', past)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  body: { gap: 24, paddingHorizontal: gutter, paddingTop: 8 },
  section: { gap: 12 },
});
