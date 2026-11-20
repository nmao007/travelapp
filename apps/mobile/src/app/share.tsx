import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tripTitle } from '@trippilot/core/trip-model';
import { Art, Icon } from '@/components/icons';
import { tripDateLabel } from '@/components/recent-trip';
import { fetchSharedPreview, useSharedInbox, type SharedPlace, type SharedPreview } from '@/lib/share-inbox';
import { colors, fonts, sq } from '@/lib/theme';
import { useTrips } from '@/lib/trips';

const PROVIDERS: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };

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
  const provider = preview?.provider || '';
  const source = PROVIDERS[provider] || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Link'; } })();
  const caption = (preview?.title || '').split('\n').map(line => line.replace(/#[\p{L}\p{N}_]+/gu, '').trim()).find(Boolean)
    || (preview || failed ? `${source} link` : 'Loading preview…');
  const trip = trips.find(entry => entry.id === tripId) || null;

  const save = async () => {
    await saveShared({
      id: `${Date.now()}`, url: preview?.url || url, savedAt: new Date().toISOString(), tripId: trip?.id,
      ...(preview ? { provider: preview.provider, title: preview.title, author: preview.author, handle: preview.handle, image: preview.image, places: preview.places } : { title: text && text !== url ? text : undefined }),
      place,
    });
    setSaved(trip ? `Saved to ${tripTitle(trip)}` : 'Saved to Elsewhere');
    // Back to the app the video came from, like the iOS share sheet.
    setTimeout(() => { router.replace('/'); if (Platform.OS === 'android') BackHandler.exitApp(); }, 900);
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
            <View style={styles.preview}>
              <View style={styles.thumb}>
                {preview?.image ? <Image source={{ uri: preview.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : !preview && !failed ? <ActivityIndicator color={colors.action} /> : <Art name="ideas" size={34} />}
                <View style={styles.badge}><Text style={styles.badgeText}>{source}</Text></View>
              </View>
              <View style={styles.previewCopy}>
                <Text style={styles.caption} numberOfLines={3}>{caption}</Text>
                {preview && (preview.author || preview.handle) ? <Text style={styles.meta} numberOfLines={1}>{[preview.author, preview.handle].filter(Boolean).join(' · ')}</Text> : null}
                {failed ? <Text style={styles.muted}>No preview right now. The link is saved as it is.</Text> : null}
              </View>
            </View>
            {preview?.places.length ? (
              <View style={styles.group}>
                <Text style={styles.label}>Place</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {preview.places.map(option => {
                    const selected = place?.placeId === option.placeId;
                    return (
                      <Pressable key={option.placeId} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setPlace(selected ? null : option)} style={[styles.chip, selected && styles.chipSelected]}>
                        <Icon name="pin" size={15} color={selected ? colors.action : colors.ink} />
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{option.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
            <View style={styles.group}>
              <Text style={styles.label}>Trip</Text>
              {[...trips.map(entry => ({ id: entry.id, name: tripTitle(entry) as string, detail: entry.startDate ? tripDateLabel(entry) : 'Ideas tab' })), { id: null, name: 'Decide later', detail: 'Add it to a trip in the app' }].map(option => {
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
  preview: { flexDirection: 'row', gap: 12 },
  thumb: { width: 84, height: 112, borderRadius: sq(16), borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#fff2eb', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: sq(8), borderCurve: 'continuous', backgroundColor: 'rgba(32, 32, 31, 0.72)' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.white },
  previewCopy: { flex: 1, minWidth: 0, gap: 4 },
  caption: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: colors.tripTitle },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.tripMeta },
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  group: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.sectionLabel },
  chips: { gap: 8 },
  chip: { minHeight: 40, maxWidth: 240, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: sq(20), borderCurve: 'continuous', backgroundColor: colors.white },
  chipSelected: { borderColor: '#ffd9be', backgroundColor: '#fff2eb' },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, flexShrink: 1 },
  chipTextSelected: { color: colors.action },
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
