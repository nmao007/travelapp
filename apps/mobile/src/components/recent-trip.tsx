import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { tripTitle } from '@trippilot/core/trip-model';
import { Display } from './ui';
import { palette, radii, strokes, typefaces } from '@/lib/design';
import type { Trip } from '@/lib/trips';

const dateLabel = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
export const tripDateLabel = (trip: Trip) => trip.startDate && trip.endDate ? `${dateLabel(trip.startDate)} – ${dateLabel(trip.endDate)}` : 'Dates not set';

// Trips get a color each, in turn: the tile on their row and their Up next card.
const TILES = [
  { fill: palette.blue, edge: palette.yellow },
  { fill: palette.pink, edge: palette.orange },
  { fill: palette.mint, edge: palette.violet },
  { fill: palette.orange, edge: palette.pink },
  { fill: palette.lavender, edge: palette.blue },
];
export const tripTile = (index: number) => TILES[index % TILES.length];

export function tripCounts(trip: Trip) {
  const plans = (trip.items || []).length, ideas = ((trip.boardItems as unknown[] | undefined) || []).length;
  return [plans ? `${plans} ${plans === 1 ? 'plan' : 'plans'}` : '', ideas ? `${ideas} ${ideas === 1 ? 'idea' : 'ideas'}` : ''].filter(Boolean).join(' · ');
}

// A trip as a row: its color tile, name, dates and counts, and an arrow.
export function RecentTrip({ trip, index, onPress }: { trip: Trip; index: number; onPress?(): void }) {
  const tile = tripTile(index);
  const meta = [tripDateLabel(trip), tripCounts(trip)].filter(Boolean).join(' · ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${tripTitle(trip)}, ${meta}`} onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View accessibilityElementsHidden style={[styles.tile, { backgroundColor: tile.fill, borderBottomColor: tile.edge }]} />
      <View style={styles.copy}>
        <Display size="card" numberOfLines={1}>{tripTitle(trip)}</Display>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      </View>
      <Text accessibilityElementsHidden style={styles.arrow}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: 24, borderCurve: 'continuous', borderWidth: strokes.thin, borderColor: palette.line, backgroundColor: palette.paper },
  pressed: { backgroundColor: palette.sand },
  tile: { width: 60, height: 60, borderRadius: radii.md - 2, borderCurve: 'continuous', borderBottomWidth: 6 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  meta: { fontFamily: typefaces.medium, fontSize: 13, color: palette.muted },
  arrow: { paddingRight: 6, fontFamily: typefaces.bold, fontSize: 20, color: palette.ink },
});
