import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { tripTitle } from '@trippilot/core/trip-model';
import { GuideArt, Icon } from './icons';
import { colors, fonts, tripCardTints, sq } from '@/lib/theme';
import type { Trip } from '@/lib/trips';

// dateLabel / tripDateLabel from site/dist/app.js.
const dateLabel = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
export const tripDateLabel = (trip: Trip) => trip.startDate && trip.endDate ? `${dateLabel(trip.startDate)} – ${dateLabel(trip.endDate)}` : 'Add dates';

// #home-view .recent-trip on phones.
export function RecentTrip({ trip, index, onPress }: { trip: Trip; index: number; onPress?(): void }) {
  const tint = tripCardTints[index % 3];
  const dates = trip.startDate ? tripDateLabel(trip) : '';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: tint.background, borderColor: tint.border }, pressed && styles.pressed]}
    >
      {({ pressed }) => (
        <>
          <View style={pressed && styles.iconPressed}><GuideArt size={38} /></View>
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>{tripTitle(trip)}</Text>
            {dates ? <Text style={styles.meta}>{dates}</Text> : null}
          </View>
          <View style={pressed && styles.iconPressed}><Icon name="arrow" size={17} color={colors.tripArrow} /></View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80, padding: 14, borderWidth: 1, borderRadius: sq(26), borderCurve: 'continuous' },
  pressed: { backgroundColor: colors.pressed },
  iconPressed: { transform: [{ scale: 0.9 }] },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, color: colors.tripTitle },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.tripMeta },
});
