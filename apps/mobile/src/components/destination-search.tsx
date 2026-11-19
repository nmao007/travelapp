import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { tripStops } from '@trippilot/core/trip-model';
import { Icon } from './icons';
import { autocomplete, newSession, placeDetails, placeZone, type Suggestion } from '@/lib/places';
import { colors, fonts, sq } from '@/lib/theme';
import { useTrips, type Trip } from '@/lib/trips';

// The site's home search (setupAutocomplete('destination', ...) in app.js):
// regions only, 2+ characters, 450ms pause, then a dropdown over the page.
export function DestinationSearch() {
  const { trips, saveTrip, createOrOpenTrip, showHomeStatus } = useTrips();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const session = useRef<string | null>(null), request = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // :focus-within draws a 1px inner line in #c85b2a (.2s).
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
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Animated.View style={[styles.focusLine, focusStyle]} pointerEvents="none" />
        <Icon name="search" size={23} color={colors.searchIcon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="City, region, or place"
          placeholderTextColor={colors.placeholder}
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
              <View style={styles.suggestionIcon}><Icon name="pin" size={20} color={colors.action} /></View>
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.detail ? <Text style={styles.detail} numberOfLines={1}>{item.detail}</Text> : null}
              </View>
              <Icon name="arrow" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { zIndex: 60 },
  field: {
    height: 60, paddingHorizontal: 16, gap: 10, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.searchLine, borderRadius: sq(24), borderCurve: 'continuous', backgroundColor: colors.white,
  },
  fieldFocused: { borderColor: colors.searchFocusLine, backgroundColor: colors.searchFocusFill },
  focusLine: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: sq(22.5), borderCurve: 'continuous', borderWidth: 1, borderColor: '#c85b2a' },
  input: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.2, color: colors.ink },
  // .suggestions: absolute, 8pt under the field, over the trip list.
  list: {
    position: 'absolute', top: 68, left: 0, right: 0, padding: 6, borderWidth: 1, borderColor: '#e9ebef', borderRadius: sq(24), borderCurve: 'continuous', backgroundColor: colors.white,
    shadowColor: '#202838', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 10 },
  },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingVertical: 10, paddingHorizontal: 12, borderRadius: sq(20), borderCurve: 'continuous' },
  pressed: { backgroundColor: colors.pressed },
  suggestionIcon: { width: 36, height: 36, borderRadius: sq(13), borderCurve: 'continuous', backgroundColor: '#fff2eb', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  detail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
