import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { tripStops } from '@trippilot/core/trip-model';
import { Icon } from './icons';
import { autocomplete, newSession, placeDetails, placeZone, type Suggestion } from '@/lib/places';
import { palette, radii, typefaces } from '@/lib/design';
import { useTrips, type Trip } from '@/lib/trips';

// The site's home search (setupAutocomplete('destination', ...) in app.js):
// regions only, 2+ characters, 450ms pause, then a dropdown over the page.
export function DestinationSearch() {
  const { trips, saveTrip, createOrOpenTrip, showHomeStatus } = useTrips();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const session = useRef<string | null>(null), request = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Focused, the pill's shadow turns yellow (.2s).
  const focus = useSharedValue(0);
  useEffect(() => { focus.value = withTiming(focused ? 1 : 0, { duration: 200 }); }, [focused, focus]);
  const focusStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  // @keyframes reveal: fade in while the bottom 14% unclips, .2s.
  const reveal = useSharedValue(1);
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value, transform: [{ translateY: (1 - reveal.value) * -6 }] }));

  const hide = () => setSuggestions([]);
  function onChange(text: string) {
    setQuery(text);
    clearTimeout(timer.current);
    const value = text.trim(), id = ++request.current;
    if (value.length < 2) { hide(); return; }
    timer.current = setTimeout(async () => {
      try {
        session.current ||= newSession();
        const results = await autocomplete(value, { session: session.current });
        if (id !== request.current) return;
        showHomeStatus('');
        if (!suggestions.length && results.length) { reveal.value = 0; reveal.value = withTiming(1, { duration: 200, easing: Easing.ease }); }
        setSuggestions(results);
      } catch (error) {
        if (id !== request.current) return;
        hide(); showHomeStatus((error as { status?: number }).status === 429 ? 'Search is temporarily unavailable. Try again shortly.' : 'Search is unavailable right now.');
      }
    }, 450);
  }

  async function choose(suggestion: Suggestion) {
    hide();
    try {
      const known = trips.flatMap(trip => tripStops(trip) as Trip['stops']).find(stop => stop.placeId === suggestion.placeId);
      const place = known ? { placeId: known.placeId, name: known.name, address: known.address || '', latitude: known.latitude, longitude: known.longitude } : await placeDetails(suggestion.placeId, session.current || newSession());
      setQuery(''); session.current = null;
      const trip = createOrOpenTrip(place);
      router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
      // ensureTripZone: fill in the destination's time zone once known.
      if (!trip.timeZone) {
        const timeZone = await placeZone(trip);
        if (timeZone) saveTrip({ ...trip, timeZone, stops: trip.stops.map(stop => stop.placeId === trip.placeId ? { ...stop, timeZone } : stop) });
      }
    } catch {
      showHomeStatus('Could not open that place. Try another result.');
    }
  }

  return (
    <View style={styles.block}>
      <View style={styles.shadow}>
        <Animated.View style={[styles.shadowFill, styles.shadowFocus, focusStyle]} pointerEvents="none" />
      </View>
      <View style={styles.field}>
        <Icon name="search" size={22} color={palette.yellow} strokeWidth={2.4} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search a city, island, anywhere"
          placeholderTextColor="#CFC7E6"
          keyboardAppearance="dark"
          selectionColor={palette.yellow}
          accessibilityLabel="Search for a destination"
          autoComplete="off"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      {suggestions.length ? (
        <Animated.View style={[styles.list, revealStyle]} accessibilityRole="list">
          {suggestions.map(item => (
            <Pressable key={item.placeId} accessibilityRole="button" onPress={() => choose(item)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <View style={styles.suggestionIcon}><Icon name="pin" size={20} color={palette.ink} strokeWidth={2.2} /></View>
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.detail ? <Text style={styles.detail} numberOfLines={1}>{item.detail}</Text> : null}
              </View>
              <Icon name="arrow" size={20} color={palette.ink} strokeWidth={2.2} />
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { zIndex: 60, marginRight: 4, marginBottom: 4 },
  // The pill sits on a hard orange shadow, 4pt down and right.
  shadow: { position: 'absolute', top: 4, left: 4, right: -4, height: 58, borderRadius: radii.pill, backgroundColor: palette.orange, overflow: 'hidden' },
  shadowFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  shadowFocus: { backgroundColor: palette.yellow },
  field: { height: 58, paddingHorizontal: 20, gap: 12, flexDirection: 'row', alignItems: 'center', borderRadius: radii.pill, backgroundColor: palette.ink },
  input: { flex: 1, height: '100%', fontFamily: typefaces.medium, fontSize: 16, color: palette.paper },
  list: {
    position: 'absolute', top: 70, left: 0, right: -4, padding: 6, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: palette.paper,
    shadowColor: palette.ink, shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 16 }, elevation: 12,
  },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16 },
  pressed: { backgroundColor: palette.sand },
  suggestionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.yellow, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: typefaces.bold, fontSize: 16, color: palette.ink },
  detail: { fontFamily: typefaces.medium, fontSize: 13, color: palette.muted },
});
