import { useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tripTitle } from '@trippilot/core/trip-model';
import { Icon } from '@/components/icons';
import { SharedLinkPreview } from '@/components/shared-preview';
import { tripDateLabel } from '@/components/recent-trip';
import { fetchSharedPreview, useSharedInbox, type SharedPlace, type SharedPreview } from '@/lib/share-inbox';
import { colors, fonts, sq } from '@/lib/theme';
import { useTrips } from '@/lib/trips';

// Android's "Save to Elsewhere" screen, the same steps as the iOS share
// extension (targets/share/ShareViewController.swift): preview, place, trip.
export default function ShareScreen() {
  const { url = '', text = '' } = useLocalSearchParams<{ url?: string; text?: string }>();
  const insets = useSafeAreaInsets();
  const { trips } = useTrips();
  const { saveShared } = useSharedInbox();
  const [preview, setPreview] = useState<SharedPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [place, setPlace] = useState<SharedPlace | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [saved, setSaved] = useState('');

  useEffect(() => { setTripId(current => current ?? trips[0]?.id ?? null); }, [trips]);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetchSharedPreview(url, controller.signal).then(next => { setPreview(next); setPlace(next.places[0] ?? null); }).catch(() => setFailed(true));
    return () => controller.abort();
  }, [url]);

  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  // 'new' is "New trip": the app asks for the destination afterwards.
  const trip = trips.find(entry => entry.id === tripId) || null;
  const newTrip = tripId === 'new';

  const save = async () => {
    await saveShared({
      id: `${Date.now()}`, url: preview?.url || url, savedAt: new Date().toISOString(), tripId: trip?.id, newTrip: newTrip || undefined,
      ...(preview ? { provider: preview.provider, title: preview.title, author: preview.author, handle: preview.handle, image: preview.image, places: preview.places } : { title: text && text !== url ? text : undefined }),
      place,
    });
    setSaved(trip ? `Saved to ${tripTitle(trip)}` : newTrip ? 'Saved. Pick the trip\'s destination next.' : 'Saved to Elsewhere');
    // Back to the app the video came from, like the iOS share sheet. A new
    // trip stays in Elsewhere: home opens the New trip sheet for it.
    setTimeout(() => { router.replace('/'); if (Platform.OS === 'android' && !newTrip) BackHandler.exitApp(); }, 900);
  };

  if (!url) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Elsewhere couldn't find a link to save.</Text>
        <Pressable accessibilityRole="button" onPress={close} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>Close</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.heading}>
        <Text style={styles.title}>Save to Elsewhere</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.closePressed]}><Icon name="close" size={18} color="#555555" /></Pressable>
      </View>
      {saved ? (
        <View style={[styles.center, styles.saved]}>
          <Icon name="check" size={40} color="#19765e" strokeWidth={2.4} />
          <Text style={styles.savedText}>{saved}</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.body}>
            <SharedLinkPreview url={url} preview={preview} failed={failed} place={place} onPlace={setPlace} />
            <View style={styles.group}>
              <Text style={styles.label}>Trip</Text>
              {[...trips.map(entry => ({ id: entry.id, name: tripTitle(entry) as string, detail: entry.startDate ? tripDateLabel(entry) : 'Ideas tab' })), { id: 'new', name: 'New trip', detail: 'Pick the destination next' }, { id: null, name: 'Decide later', detail: 'Add it to a trip in the app' }].map(option => {
                const selected = option.id === tripId;
                return (
                  <Pressable key={option.id ?? 'later'} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setTripId(option.id)} style={[styles.trip, selected && styles.tripSelected]}>
                    <View style={styles.tripCopy}>
                      <Text style={styles.tripName} numberOfLines={1}>{option.name}</Text>
                      <Text style={styles.tripDetail} numberOfLines={1}>{option.detail}</Text>
                    </View>
                    {selected ? <Icon name="check" size={18} color={colors.action} strokeWidth={2.2} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
            <Pressable accessibilityRole="button" onPress={save} style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}>
              <Text style={styles.primaryText}>Save idea</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  heading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 16, paddingHorizontal: 16 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.5, color: '#252525' },
  close: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  closePressed: { backgroundColor: '#ebecef' },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 18 },
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  group: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.sectionLabel },
  trip: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: sq(22), borderCurve: 'continuous' },
  tripSelected: { borderColor: '#ffd9be', backgroundColor: '#fffaf6' },
  tripCopy: { flex: 1, minWidth: 0, gap: 2 },
  tripName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  tripDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  footer: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.line },
  primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accentPressed },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.white },
  secondary: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft },
  secondaryText: { fontFamily: fonts.medium, fontSize: 15, color: '#555555' },
  pressed: { backgroundColor: colors.pressed },
  saved: { flex: 1, paddingBottom: 80 },
  savedText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
});
