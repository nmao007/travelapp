import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { restoreItineraryEvent } from '@trippilot/core/itinerary-model';
import { Icon } from '../icons';
import { colors, fonts, sq } from '@/lib/theme';
import type { Trip } from '@/lib/trips';

// Both notices float 12pt above the tab bar (#removal-notice: bottom 78px).
function useBottom() { return 78 + useSafeAreaInsets().bottom; }

// #trip-status: a short message that clears itself after 3.5s.
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

// #removal-notice: "Removed X" with Undo for 12 seconds.
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
        <Icon name="close" size={18} color="#555555" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute', left: 12, right: 12, padding: 10, borderWidth: 1, borderColor: '#e8e8e8', borderRadius: sq(18), borderCurve: 'continuous', backgroundColor: colors.white,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 11, shadowOffset: { width: 0, height: 6 },
  },
  removal: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  message: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  removalMessage: { flex: 1, paddingLeft: 1 },
  undo: { minHeight: 52, paddingHorizontal: 8, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.accent, justifyContent: 'center' },
  undoPressed: { backgroundColor: colors.accentPressed },
  undoText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.white },
  dismiss: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.pressed },
});
