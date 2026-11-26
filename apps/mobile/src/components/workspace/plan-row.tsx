import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { fixedItem } from '@trippilot/core/itinerary-model';
import { Icon } from '../icons';
import type { SymbolName } from '../icon-symbols';
import { formatClock } from '@/lib/format';
import { kindColors, palette, radii, strokes, typefaces } from '@/lib/design';
import type { PlanItem } from '@/lib/trips';

// Each plan kind has the redesign's color and a line icon.
const KINDS: Record<string, { color: string; icon: SymbolName; label: string }> = {
  Food: { color: kindColors.food, icon: 'food', label: 'Food' },
  Stay: { color: kindColors.stay, icon: 'stay', label: 'Stay' },
  Transport: { color: kindColors.go, icon: 'train', label: 'Getting there' },
  Activity: { color: kindColors.see, icon: 'landmark', label: 'See & do' },
};
export const planKind = (item: Pick<PlanItem, 'kind'>) => KINDS[item.kind || 'Activity'] || KINDS.Activity;

// The kind's colored square with its icon: plan rows and the drag ghost.
export function PlaceMarker({ item, size = 44 }: { item: PlanItem; size?: number }) {
  const kind = planKind(item);
  return (
    <View accessibilityElementsHidden style={[styles.marker, { width: size, height: size, backgroundColor: kind.color }]}>
      <Icon name={kind.icon} size={Math.round(size * 0.5)} color={kind.icon === 'train' ? palette.paper : palette.ink} strokeWidth={2} />
    </View>
  );
}

// What VoiceOver reads for a plan: its name, time and whether it's booked.
const planLabel = (item: PlanItem) => [item.name, item.time ? formatClock(item.time) : '', item.booked ? 'booked' : ''].filter(Boolean).join(', ');

// A plan in the whole-trip list: time, kind dot, name. Plans without a fixed
// time show "any" and a drag handle.
export const TimelineRow = memo(function TimelineRow({ item, onOpen, dragHandle, last = false }: { item: PlanItem; onOpen(item: PlanItem): void; dragHandle?: React.ReactNode; last?: boolean }) {
  const fixed = fixedItem(item);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={planLabel(item)} accessibilityHint="Opens the plan" onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.pressed]}>
      <Text style={[styles.time, !item.time && styles.timeAny]}>{item.time ? formatClock(item.time) : 'any'}</Text>
      <View accessibilityElementsHidden style={[styles.dot, { backgroundColor: planKind(item).color }]} />
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      {item.booked ? <Icon name="check" size={14} color={palette.muted} strokeWidth={2.4} /> : null}
      {!fixed && dragHandle ? <View style={styles.rowHandle}>{dragHandle}</View> : null}
    </Pressable>
  );
});

// A plan in the one-day view: kind tile, name, kind and booking, time.
export const DayCard = memo(function DayCard({ item, onOpen, dragHandle }: { item: PlanItem; onOpen(item: PlanItem): void; dragHandle?: React.ReactNode }) {
  const fixed = fixedItem(item);
  const meta = [planKind(item).label, item.booked ? (item.reference ? `booked · ${item.reference}` : 'booked') : item.reference].filter(Boolean).join(' · ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={planLabel(item)} accessibilityHint="Opens the plan" onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <PlaceMarker item={item} />
      <View style={styles.cardCopy}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{meta}</Text>
        {item.notes ? <Text style={styles.cardNote} numberOfLines={2}>{item.notes}</Text> : null}
      </View>
      {item.time ? <Text style={styles.cardTime}>{formatClock(item.time)}</Text> : null}
      {!fixed && dragHandle ? <View style={styles.cardHandle}>{dragHandle}</View> : null}
    </Pressable>
  );
});

export function DragHandleIcon() {
  return <Icon name="grip" size={20} color={palette.muted} />;
}

const styles = StyleSheet.create({
  marker: { borderRadius: radii.sm, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: palette.sand },
  row: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 14 },
  rowLine: { borderBottomWidth: strokes.thin, borderBottomColor: palette.sand },
  time: { minWidth: 62, fontFamily: typefaces.bold, fontSize: 13, color: palette.muted },
  timeAny: { fontFamily: typefaces.semibold },
  dot: { width: 12, height: 12, borderRadius: 4, borderWidth: strokes.thin, borderColor: palette.ink },
  name: { flex: 1, fontFamily: typefaces.semibold, fontSize: 15, lineHeight: 20, color: palette.ink },
  rowHandle: { width: 36, height: 44, marginRight: -10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 20, borderCurve: 'continuous', borderWidth: strokes.thin, borderColor: palette.line, backgroundColor: palette.paper },
  cardCopy: { flex: 1, minWidth: 0, gap: 2 },
  cardName: { fontFamily: typefaces.bold, fontSize: 16, lineHeight: 21, color: palette.ink },
  cardMeta: { fontFamily: typefaces.semibold, fontSize: 12, lineHeight: 16, color: palette.muted },
  cardNote: { marginTop: 2, fontFamily: typefaces.regular, fontSize: 13, lineHeight: 18, color: palette.muted },
  cardTime: { fontFamily: typefaces.display, fontSize: 15, color: palette.ink },
  cardHandle: { width: 36, height: 44, marginRight: -6 },
});
