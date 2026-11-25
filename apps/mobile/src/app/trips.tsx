import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { RecentTrip } from '@/components/recent-trip';
import { colors, fonts, sq } from '@/lib/theme';
import { useTrips } from '@/lib/trips';

// Every trip, opened from home's "See all trips" once there are more than home shows.
export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const { trips } = useTrips();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Icon name="back" size={24} color="#222222" />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} accessibilityRole="header">Your trips</Text>
          <Text style={styles.subtitle}>{trips.length === 1 ? '1 trip' : `${trips.length} trips`}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}>
        {trips.map((trip, index) => <RecentTrip key={trip.id} trip={trip} index={index} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  // Same masthead as the Unsorted ideas page.
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
  back: { width: 44, height: 44, marginLeft: -8, alignItems: 'center', justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous' },
  pressed: { backgroundColor: colors.pressed },
  titleWrap: { flex: 1, marginLeft: 12 },
  title: { marginTop: 2, fontFamily: fonts.bold, fontSize: 23, lineHeight: 26.45, letterSpacing: -0.7, color: colors.ink },
  subtitle: { marginTop: 3, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  body: { gap: 8, paddingHorizontal: 22, paddingTop: 12 },
});
