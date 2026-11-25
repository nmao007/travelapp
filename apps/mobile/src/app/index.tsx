import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AccountSheet } from '@/components/account-sheet';
import { DestinationSearch } from '@/components/destination-search';
import { HomeArt } from '@/components/home-art';
import { RecentTrip } from '@/components/recent-trip';
import { SavedVideos } from '@/components/saved-videos';
import { TopBar } from '@/components/top-bar';
import { colors, fonts } from '@/lib/theme';
import { useTrips } from '@/lib/trips';

// The site's #home-view at phone width (402pt). Place search and opening a
// trip arrive in phase 1, with the trip workspace.
export default function Home() {
  const { trips, homeStatus } = useTrips();
  const [accountOpen, setAccountOpen] = useState(false);

  // #home-view h1 on phones: one line, font-size clamp(44px, 13vw, 52px), line-height 1.08.
  const { width } = useWindowDimensions();
  const titleSize = Math.min(52, Math.max(44, width * 0.13));

  // welcome-copy: fade up 10pt over .32s ease-out.
  const reduced = useReducedMotion();
  const welcome = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { if (!reduced) welcome.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.ease) }); }, [reduced, welcome]);
  const titleStyle = useAnimatedStyle(() => ({ opacity: welcome.value, transform: [{ translateY: (1 - welcome.value) * 10 }] }));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <TopBar onSignIn={() => setAccountOpen(true)} />
      <ScrollView contentContainerStyle={styles.home} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Animated.Text style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.08 }, titleStyle]} numberOfLines={1} accessibilityRole="header">
            Where to<Text style={styles.punctuation}>?</Text>
          </Animated.Text>
          <HomeArt />
        </View>
        <DestinationSearch />
        {homeStatus ? <Text style={styles.status} accessibilityLiveRegion="polite">{homeStatus}</Text> : null}
        <SavedVideos />
        {trips.length ? (
          <View style={styles.recent}>
            <Text style={styles.sectionLabel}>Your trips</Text>
            <View style={styles.recentItems}>
              {trips.slice(0, 6).map((trip, index) => <RecentTrip key={trip.id} trip={trip} index={index} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })} />)}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  home: { paddingTop: 24, paddingHorizontal: 22, paddingBottom: 32 },
  intro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 122, marginBottom: 18 },
  title: { flexShrink: 0, fontFamily: fonts.bold, letterSpacing: -2.7, color: colors.title },
  punctuation: { color: colors.punctuation },
  status: { marginTop: 13, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.danger },
  recent: { marginTop: 28 },
  sectionLabel: { marginBottom: 12, fontFamily: fonts.semibold, fontSize: 15, letterSpacing: -0.2, color: colors.sectionLabel },
  recentItems: { gap: 8 },
});
