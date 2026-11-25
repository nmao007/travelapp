import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput, TIGHT_SCALE } from '@/components/text';
import { router } from 'expo-router';
import { Art, Icon } from './icons';
import { RecentTrip } from './recent-trip';
import { BottomSheet } from './sheet';
import { PROVIDERS } from './shared-preview';
import { autocomplete, newSession, placeDetails, placeZone, type Suggestion } from '@/lib/places';
import { destinationGuess, useSharedInbox, type SharedLink } from '@/lib/share-inbox';
import { colors, fonts, sq } from '@/lib/theme';
import { useTrips, type Trip } from '@/lib/trips';
import { haptics } from '@/lib/haptics';

const caption = (link: SharedLink) => (link.title || '').split('\n').map(line => line.replace(/#[\p{L}\p{N}_]+/gu, '').trim()).find(Boolean)
  || link.place?.name || PROVIDERS[link.provider || ''] || 'Saved link';

// "New trip" shares already asked about, across home and the Unsorted page.
const asked = new Set<string>();

// A share saved with "New trip" opens the New trip sheet as soon as it arrives.
function useNewTripPrompt(busy: boolean, setStarting: (link: SharedLink) => void) {
  const { unassigned } = useSharedInbox();
  useEffect(() => {
    const next = unassigned.find(link => link.newTrip && !asked.has(link.id));
    if (!next || busy) return;
    asked.add(next.id);
    setStarting(next);
  }, [unassigned, busy, setStarting]);
}

// Home: one row that opens the Unsorted ideas page, shown while there are any.
export function UnsortedIdeasLink() {
  const { unassigned, postpone } = useSharedInbox();
  const [starting, setStarting] = useState<SharedLink | null>(null);
  useNewTripPrompt(Boolean(starting), setStarting);
  const count = unassigned.length;
  return (
    <>
      {count ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/unsorted')} style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
          <View style={styles.linkCovers}>
            {unassigned.slice(0, 3).map((link, index) => (
              <View key={link.id} style={[styles.linkCover, { marginLeft: index ? -18 : 0, zIndex: 3 - index }]}><Cover image={link.image} small /></View>
            ))}
          </View>
          <View style={styles.copy}>
            <Text style={styles.linkTitle}>Unsorted ideas</Text>
            <Text style={styles.linkDetail}>{count === 1 ? '1 saved video to add to a trip' : `${count} saved videos to add to trips`}</Text>
          </View>
          <View style={styles.badge}><Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.badgeText}>{count}</Text></View>
          <Icon name="arrow" size={17} color={colors.tripArrow} />
        </Pressable>
      ) : null}
      <NewTripSheet key={starting?.id || 'none'} link={starting} onClose={link => { setStarting(null); if (link?.newTrip) postpone(link); }} />
    </>
  );
}

// The Unsorted ideas page: videos and links shared with "Decide later" or
// "New trip". Add each to a trip, start a trip from it, or dismiss it.
export function UnsortedIdeas() {
  const { unassigned, dismiss, postpone } = useSharedInbox();
  const [choosing, setChoosing] = useState<SharedLink | null>(null);
  const [starting, setStarting] = useState<SharedLink | null>(null);
  useNewTripPrompt(Boolean(starting || choosing), setStarting);

  return (
    <View>
      {unassigned.length ? (
        <>
          <View style={styles.list}>
            {unassigned.map(link => (
              <View key={link.id} style={styles.row}>
                <Cover image={link.image} />
                <View style={styles.copy}>
                  <Text style={styles.title} numberOfLines={2}>{caption(link)}</Text>
                  {link.place ? <View style={styles.placeRow}><Icon name="pin" size={13} color={colors.action} /><Text style={styles.place} numberOfLines={1}>{link.place.name}</Text></View> : null}
                  <View style={styles.actions}>
                    <Pressable accessibilityRole="button" onPress={() => setChoosing(link)} style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
                      <Icon name="plus" size={15} color={colors.action} />
                      <Text style={styles.addText}>Add to trip</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => dismiss(link)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                      <Icon name="close" size={17} color="#555555" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Art name="ideas" size={44} />
          <Text style={styles.emptyTitle}>All sorted</Text>
          <Text style={styles.emptyText}>{'Videos you share with "Decide later" or "New trip" wait here until they\'re in a trip.'}</Text>
        </View>
      )}
      <TripChooser link={choosing} onClose={() => setChoosing(null)} onNewTrip={link => { setChoosing(null); setStarting(link); }} />
      <NewTripSheet key={starting?.id || 'none'} link={starting} onClose={link => { setStarting(null); if (link?.newTrip) postpone(link); }} />
    </View>
  );
}

function Cover({ image, small }: { image?: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.cover, small && styles.coverSmall]}>
      {image && !failed ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
        : <Art name="ideas" size={small ? 20 : 26} />}
    </View>
  );
}

// "Add to trip": the trips, then "New trip".
function TripChooser({ link, onClose, onNewTrip }: { link: SharedLink | null; onClose(): void; onNewTrip(link: SharedLink): void }) {
  const { trips } = useTrips();
  const { addToTrip } = useSharedInbox();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  return (
    <BottomSheet visible={Boolean(link)} onClose={() => { setError(''); setBusy(null); onClose(); }}
      header={close => <SheetHeading title="Add to trip" subtitle={link ? caption(link) : ''} onClose={close} />}>
      {close => (
        <ScrollView keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" style={styles.sheetBody} contentContainerStyle={styles.sheetContent}>
          <Pressable accessibilityRole="button" onPress={() => link && onNewTrip(link)} style={({ pressed }) => [styles.newTrip, pressed && styles.pressed]}>
            <View style={styles.newTripIcon}><Icon name="plus" size={20} color={colors.action} /></View>
            <View style={styles.copy}>
              <Text style={styles.newTripTitle}>New trip</Text>
              <Text style={styles.newTripDetail} numberOfLines={1}>{link?.place ? `Start one from ${link.place.name}` : 'Start a trip with this video'}</Text>
            </View>
          </Pressable>
          {trips.map((trip, index) => (
            <View key={trip.id} style={busy && busy !== trip.id ? styles.dimmed : undefined}>
              <RecentTrip trip={trip} index={index} onPress={async () => {
                if (!link || busy) return;
                setBusy(trip.id); setError('');
                try { await addToTrip(link, trip); haptics.success(); close(); }
                catch (failure) { setError((failure as Error).message || 'Could not add this video.'); setBusy(null); }
              }} />
            </View>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

// "New trip": choose the destination (suggested from the video's place, like
// the home search), then the trip opens with the video in its Ideas.
function NewTripSheet({ link, onClose }: { link: SharedLink | null; onClose(link: SharedLink | null): void }) {
  const { createOrOpenTrip, saveTrip } = useTrips();
  const { addToTrip } = useSharedInbox();
  const [query, setQuery] = useState(() => destinationGuess(link?.place));
  const [results, setResults] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useRef(newSession()), request = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const done = useRef(false);

  function search(text: string) {
    setQuery(text); setError('');
    if (text.trim().length < 2) { clearTimeout(timer.current); request.current++; setResults([]); return; }
    lookup(text);
  }
  function lookup(text: string) {
    clearTimeout(timer.current);
    const id = ++request.current, value = text.trim();
    timer.current = setTimeout(async () => {
      try { const found = await autocomplete(value, { session: session.current }); if (id === request.current) setResults(found); }
      catch { if (id === request.current) { setResults([]); setError('Search is unavailable right now.'); } }
    }, 300);
  }
  // Start from the guessed city. The sheet is keyed by the video, so each
  // video starts fresh.
  useEffect(() => {
    if (query.trim().length >= 2) lookup(query);
    return () => clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(suggestion: Suggestion, close: () => void) {
    if (!link || busy) return;
    setBusy(true); setError('');
    try {
      const place = await placeDetails(suggestion.placeId, session.current);
      const trip = createOrOpenTrip(place);
      await addToTrip(link, trip);
      haptics.success();
      done.current = true;
      close();
      router.push({ pathname: '/trip/[id]', params: { id: trip.id, tab: 'ideas' } });
      if (!trip.timeZone) {
        const timeZone = await placeZone(trip);
        if (timeZone) saveTrip({ ...trip, timeZone, stops: trip.stops.map(stop => stop.placeId === trip.placeId ? { ...stop, timeZone } : stop) } as Trip);
      }
    } catch (failure) {
      setError((failure as Error).message || 'Could not start this trip.');
    } finally { setBusy(false); }
  }

  return (
    <BottomSheet visible={Boolean(link)} onClose={() => { setResults([]); setError(''); onClose(done.current ? null : link); }}
      header={close => <SheetHeading title="New trip" subtitle={link ? caption(link) : ''} onClose={close} />}>
      {close => (
        <ScrollView keyboardDismissMode="interactive" style={styles.sheetBody} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Where to?</Text>
          <TextInput style={styles.input} value={query} onChangeText={search} placeholder="City, region, or place" placeholderTextColor={colors.placeholder}
            autoCorrect={false} returnKeyType="search" accessibilityLabel="Trip destination" />
          {busy ? <ActivityIndicator color={colors.action} style={styles.spinner} /> : results.map(result => (
            <Pressable key={result.placeId} accessibilityRole="button" onPress={() => choose(result, close)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <View style={styles.suggestionIcon}><Icon name="pin" size={18} color={colors.action} /></View>
              <View style={styles.copy}>
                <Text style={styles.suggestionName} numberOfLines={1}>{result.name}</Text>
                {result.detail ? <Text style={styles.suggestionDetail} numberOfLines={1}>{result.detail}</Text> : null}
              </View>
            </Pressable>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function SheetHeading({ title, subtitle, onClose }: { title: string; subtitle: string; onClose(): void }) {
  return (
    <View style={styles.heading}>
      <View style={styles.copy}>
        <Text style={styles.sheetTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sheetSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
        <Icon name="close" size={18} color="#555555" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { marginTop: 20, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: '#ffd9be', borderRadius: sq(26), borderCurve: 'continuous', backgroundColor: '#fffaf6' },
  linkPressed: { backgroundColor: '#fff2eb' },
  linkCovers: { flexDirection: 'row' },
  linkCover: { borderWidth: 2, borderColor: '#fffaf6', borderRadius: sq(12), borderCurve: 'continuous' },
  linkTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, color: colors.tripTitle },
  linkDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  badge: { minWidth: 24, height: 24, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', borderRadius: sq(12), borderCurve: 'continuous', backgroundColor: colors.accent },
  badgeText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
  coverSmall: { width: 36, height: 48, borderRadius: sq(10) },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e5cfc5', borderRadius: sq(22), borderCurve: 'continuous' },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.tripTitle },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  list: { gap: 8 },
  row: { flexDirection: 'row', gap: 12, padding: 10, borderWidth: 1, borderColor: '#ffd9be', borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: '#fffaf6' },
  cover: { width: 60, height: 80, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: sq(14), borderCurve: 'continuous', backgroundColor: '#fff2eb' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 19.5, color: colors.tripTitle },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  place: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.action },
  actions: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  add: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: sq(18), borderCurve: 'continuous', backgroundColor: '#fff2eb' },
  addPressed: { backgroundColor: '#ffe6d6' },
  addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.action },
  iconButton: { width: 36, height: 36, borderRadius: sq(18), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.pressed },
  dimmed: { opacity: 0.5 },
  heading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 16, paddingHorizontal: 16 },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.5, color: '#252525' },
  sheetSubtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  close: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  closePressed: { backgroundColor: '#ebecef' },
  sheetBody: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 8 },
  newTrip: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e5cfc5', borderRadius: sq(26), borderCurve: 'continuous' },
  newTripIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: sq(19), borderCurve: 'continuous', backgroundColor: '#fff2eb' },
  newTripTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  newTripDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  input: { minHeight: 48, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.inputLine, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.white, fontFamily: fonts.regular, fontSize: 16, color: '#333333' },
  spinner: { marginVertical: 16 },
  suggestion: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6, borderRadius: sq(18), borderCurve: 'continuous' },
  suggestionIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: sq(18), borderCurve: 'continuous', backgroundColor: '#fff2eb' },
  suggestionName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  suggestionDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
});
