import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { isContentIdea } from '@trippilot/core/board-model';
import { datesForTrip, makePlan } from '@trippilot/core/itinerary-model';
import { flightDayBlock } from '@trippilot/core/flight-window';
import { destinationForDay } from '@trippilot/core/place-model';
import { tripStops } from '@trippilot/core/trip-model';
import { Art, Icon } from '../icons';
import { Dropdown } from '../popover';
import { BottomSheet, afterSheetCloses } from '../sheet';
import { ideaOnDay, ideaScheduled, providerLabel, type Idea } from './ideas-view';
import { formatDay } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { autocomplete, newSession, placeDetails, type Place, type Suggestion } from '@/lib/places';
import { colors, fonts, sq } from '@/lib/theme';
import { palette, typefaces } from '@/lib/design';
import type { PlanItem, Stop, Trip } from '@/lib/trips';

// Food and Stay from Google's place types; everything else is an Activity.
export function kindFor(place: Place) {
  const types = [place.primaryType || '', ...(place.types || [])];
  if (types.some(type => type === 'lodging' || type.endsWith('hotel') || type === 'hostel' || type === 'bed_and_breakfast')) return 'Stay';
  if (types.some(type => /restaurant|cafe|coffee|bakery|bar$|^bar_|food|meal_|dessert|ice_cream|tea_house|pub|winery|brewery/.test(type))) return 'Food';
  return 'Activity';
}

// "Add to a day": the two ways something gets into the plan. Search for a real
// place (ranked around that day's destination), or put in one of the trip's
// saved ideas. Writing a plan without a place is the quiet third option.
export function AddSheet({ trip, day, onClose, commit, onAdded, onCustom }: {
  trip: Trip; day: string | null; onClose(): void; commit(trip: Trip): void;
  onAdded(item: PlanItem, message: string): void; onCustom(day: string): void;
}) {
  return day ? <AddSheetBody key={day} trip={trip} startDay={day} onClose={onClose} commit={commit} onAdded={onAdded} onCustom={onCustom} /> : null;
}

function AddSheetBody({ trip, startDay, onClose, commit, onAdded, onCustom }: {
  trip: Trip; startDay: string; onClose(): void; commit(trip: Trip): void;
  onAdded(item: PlanItem, message: string): void; onCustom(day: string): void;
}) {
  const days = datesForTrip(trip) as string[];
  const [day, setDay] = useState(days.includes(startDay) ? startDay : days[0]);
  const [error, setError] = useState('');

  const stop = destinationForDay(trip, tripStops(trip), day) as Stop | null;
  const near = stop ? { latitude: stop.latitude, longitude: stop.longitude } : { latitude: trip.latitude, longitude: trip.longitude };
  const zone = stop?.timeZone || trip.timeZone || 'UTC';
  const ideas = ((trip.boardItems as Idea[] | undefined) || []).filter(item => isContentIdea(item) && !ideaScheduled(trip, item)).slice().reverse();
  const dayOptions = days.map(value => {
    const blocked = Boolean(flightDayBlock(trip, value, zone));
    return { value, label: formatDay(value) + (blocked ? ' · In flight' : ''), disabled: blocked };
  });

  function add(next: Trip, item: PlanItem, close: () => void) {
    commit(next); haptics.success(); close();
    onAdded(item, `Added ${item.name} to ${formatDay(item.day)}`);
  }

  function choosePlace(place: Place, close: () => void) {
    const item = makePlan(trip, { name: place.name, day, kind: kindFor(place), placeId: place.placeId, address: place.address, latitude: place.latitude, longitude: place.longitude, timeZone: zone } as never) as PlanItem;
    add({ ...trip, items: [...(trip.items || []), item] }, item, close);
  }

  function chooseIdea(idea: Idea, close: () => void) {
    try {
      const next = ideaOnDay(trip, idea, day);
      const item = (next.items || [])[(next.items || []).length - 1];
      add(next, item, close);
    } catch (failure) { setError((failure as Error).message); }
  }

  return (
    <BottomSheet visible onClose={onClose}
      header={close => (
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={styles.title} accessibilityRole="header">Add to</Text>
            <Dropdown value={day} label="Day to add to" options={dayOptions} onChange={setDay} gap={6}
              triggerStyle={styles.dayTrigger} valueStyle={styles.dayValue} chevronColor={colors.action} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Icon name="close" size={18} color={palette.ink} />
          </Pressable>
        </View>
      )}>
      {close => (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <PlaceSearch near={near} placeholder={`Search places in ${stop?.name || trip.name}`} autoFocus={!ideas.length}
            onPick={place => choosePlace(place, close)} onError={setError}>
          {ideas.length ? (
            <View style={styles.list}>
              <Text style={styles.sectionLabel}>From your ideas</Text>
              {ideas.map(idea => (
                <Pressable key={idea.id} accessibilityRole="button" accessibilityLabel={`Add ${idea.title || 'saved idea'}`} onPress={() => chooseIdea(idea, close)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <IdeaThumb idea={idea} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowName} numberOfLines={2}>{idea.title || 'Saved idea'}</Text>
                    <Text style={styles.rowDetail} numberOfLines={1}>{[idea.location, providerLabel(idea)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Icon name="plus" size={20} color={colors.action} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Art name="guide" size={40} />
              <Text style={styles.hint}>Search for a restaurant, sight or hotel. Videos you save to this trip show up here too.</Text>
            </View>
          )}
          </PlaceSearch>
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

          <Pressable accessibilityRole="button" onPress={() => { close(); afterSheetCloses(() => onCustom(day)); }} style={({ pressed }) => [styles.custom, pressed && styles.pressed]}>
            <Icon name="edit" size={17} color={palette.ink} />
            <Text style={styles.customText}>Write your own plan</Text>
          </Pressable>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

// A place search box with its results, ranked around `near`. While nothing is
// typed it shows its children instead (ideas, hints). The pick is a full place.
export function PlaceSearch({ near, placeholder, autoFocus, onPick, onError, children, extra }: {
  near: { latitude: number; longitude: number }; placeholder: string; autoFocus?: boolean;
  onPick(place: Place): void; onError(message: string): void; children?: ReactNode;
  // Shown under the results while typing (e.g. "Save as a note").
  extra?(query: string): ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const session = useRef(newSession()), request = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function search(text: string) {
    setQuery(text); setFailed(false); onError(''); clearTimeout(timer.current);
    const id = ++request.current, value = text.trim();
    if (value.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try { const found = await autocomplete(value, { scope: 'all', session: session.current, near }); if (id === request.current) setResults(found); }
      catch { if (id === request.current) { setResults([]); setFailed(true); onError('Search is unavailable right now.'); } }
      finally { if (id === request.current) setSearching(false); }
    }, 350);
  }

  async function choose(suggestion: Suggestion) {
    setOpening(suggestion.placeId); onError('');
    try { onPick(await placeDetails(suggestion.placeId, session.current)); }
    catch (failure) { onError((failure as Error).message || 'Could not open that place. Try another result.'); session.current = newSession(); }
    finally { setOpening(null); }
  }

  const typing = query.trim().length >= 2;
  return (
    <>
      <View style={styles.searchBox}>
        <Icon name="search" size={20} color={colors.searchIcon} />
        <TextInput style={styles.searchInput} value={query} onChangeText={search} autoFocus={autoFocus} autoCorrect={false} returnKeyType="search"
          placeholder={placeholder} placeholderTextColor={colors.inputPlaceholder} accessibilityLabel="Search for a place" />
        {searching ? <ActivityIndicator color={colors.muted} /> : query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => search('')} hitSlop={8}><Icon name="close" size={16} color={colors.muted} /></Pressable>
        ) : null}
      </View>
      {typing ? (
        <View style={styles.list}>
          {results.map(item => (
            <Pressable key={item.placeId} accessibilityRole="button" accessibilityLabel={`Add ${item.name}${item.detail ? `, ${item.detail}` : ''}`} disabled={Boolean(opening)}
              onPress={() => choose(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.pin}><Icon name="pin" size={20} color={colors.action} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                {item.detail ? <Text style={styles.rowDetail} numberOfLines={1}>{item.detail}</Text> : null}
              </View>
              {opening === item.placeId ? <ActivityIndicator color={colors.action} /> : <Icon name="plus" size={20} color={colors.action} />}
            </Pressable>
          ))}
          {!searching && !results.length && !failed && !extra ? <Text style={styles.hint}>No places found. Try another name.</Text> : null}
          {extra?.(query.trim())}
        </View>
      ) : children}
    </>
  );
}

function IdeaThumb({ idea }: { idea: Idea }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.thumb}>
      {idea.image && !failed ? <Image source={{ uri: idea.image }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
        : <Art name="ideas" size={24} />}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.pressed },
  heading: { minHeight: 56, flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8, paddingBottom: 12, paddingLeft: 20, paddingRight: 16 },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { paddingTop: 4, fontFamily: typefaces.display, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: palette.ink },
  dayTrigger: { alignSelf: 'flex-start', minHeight: 36, marginLeft: -6, paddingHorizontal: 6 },
  dayValue: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 17, color: colors.action },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.sand, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyContent: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderWidth: 1.5, borderColor: colors.searchFocusLine, borderRadius: sq(26), borderCurve: 'continuous', backgroundColor: colors.searchFocusFill },
  searchInput: { flex: 1, minHeight: 50, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 17, color: colors.ink },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.danger },
  list: { gap: 2 },
  sectionLabel: { marginBottom: 6, fontFamily: fonts.semibold, fontSize: 14, letterSpacing: -0.2, color: colors.sectionLabel },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: sq(20), borderCurve: 'continuous' },
  pin: { width: 40, height: 40, borderRadius: sq(14), borderCurve: 'continuous', backgroundColor: palette.yellow, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 40, height: 54, borderRadius: sq(12), borderCurve: 'continuous', overflow: 'hidden', backgroundColor: palette.yellow, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: colors.ink },
  rowDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12 },
  custom: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: palette.line, borderRadius: sq(22), borderCurve: 'continuous' },
  customText: { fontFamily: fonts.medium, fontSize: 15, color: palette.ink },
});
