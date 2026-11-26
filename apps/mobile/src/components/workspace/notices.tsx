import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { tabBarSpace } from './chrome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { restoreItineraryEvent } from '@trippilot/core/itinerary-model';
import { Icon } from '../icons';
import { gutter, palette, radii, typefaces } from '@/lib/design';
import type { Trip } from '@/lib/trips';

// Both notices float 12pt above the floating tab bar.
function useBottom() { return tabBarSpace(useSafeAreaInsets()) - 4; }

// A short ink toast that clears itself after 3.5s.
export function TripNotice({ message, onHide }: { message: string; onHide(): void }) {
  const bottom = useBottom();
  useEffect(() => { if (!message) return; const timer = setTimeout(onHide, 3500); return () => clearTimeout(timer); }, [message, onHide]);
  if (!message) return null;
  return (
    <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(160)} style={[styles.notice, { bottom }]} accessibilityLiveRegion="polite">
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

// A removed plan (name, day) or flight (service_id, departure_date).
type Removal = { tripId: string; collection: string; record: { name?: string; day?: string; service_id?: string; departure_date?: string }; [key: string]: unknown };

// "Removed X" with a yellow Undo, for 12 seconds.
export function RemovalNotice({ removal, trip, onUndo, onHide }: { removal: Removal | null; trip: Trip; onUndo(result: { trip: Trip; day: string }): void; onHide(): void }) {
  const bottom = useBottom();
  const error = useRef('');
  useEffect(() => { if (!removal) return; error.current = ''; const timer = setTimeout(onHide, 12000); return () => clearTimeout(timer); }, [removal, onHide]);
  if (!removal || removal.tripId !== trip.id) return null;
  return (
    <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(160)} style={[styles.notice, styles.removal, { bottom }]} accessibilityLiveRegion="polite">
      <Text style={[styles.message, styles.removalMessage]} numberOfLines={2}>{error.current || `Removed ${removal.record.name || removal.record.service_id}`}</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        try { onUndo({ trip: restoreItineraryEvent(trip, removal) as Trip, day: removal.record.day || removal.record.departure_date || '' }); }
        catch (failure) { error.current = (failure as Error).message; onHide(); }
      }} style={({ pressed }) => [styles.undo, pressed && styles.undoPressed]}>
        <Text style={styles.undoText}>Undo</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onHide} style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
        <Icon name="close" size={18} color={palette.paper} strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute', left: gutter, right: gutter, minHeight: 52, justifyContent: 'center', paddingVertical: 8, paddingLeft: 16, paddingRight: 8, borderRadius: 16, borderCurve: 'continuous', backgroundColor: palette.ink,
    shadowColor: palette.ink, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  removal: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  message: { fontFamily: typefaces.semibold, fontSize: 14, lineHeight: 19, color: palette.paper },
  removalMessage: { flex: 1 },
  undo: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderCurve: 'continuous', backgroundColor: palette.yellow, justifyContent: 'center' },
  undoPressed: { backgroundColor: '#F5D21F' },
  undoText: { fontFamily: typefaces.heavy, fontSize: 14, color: palette.ink },
  dismiss: { width: 40, height: 40, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
});
