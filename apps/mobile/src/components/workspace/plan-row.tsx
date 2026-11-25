import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { fixedItem } from '@trippilot/core/itinerary-model';
import { placeIcon } from '@trippilot/core/place-search';
import { phonePlaceSymbol } from '@trippilot/core/phone-motion';
import { Art, Icon } from '../icons';
import { formatClock } from '@/lib/format';
import { colors, fonts, sq } from '@/lib/theme';
import type { PlanItem } from '@/lib/trips';

// decoratePlaceIcon in app.js, before Google details are known.
export const planArt = (item: PlanItem) => phonePlaceSymbol(item, placeIcon(item));
const markerFill = (art: string) => art === 'food' ? '#fff0e6' : art === 'leaf' ? '#eef5f3' : '#f4f3fb';

export function PlaceMarker({ item }: { item: PlanItem }) {
  const art = planArt(item);
  return <View style={[styles.marker, { backgroundColor: markerFill(art) }]}><Art name={art} size={34} /></View>;
}

// What VoiceOver reads for a plan: its name, time and whether it's booked.
const planLabel = (item: PlanItem) => [item.name, item.time ? formatClock(item.time) : '', item.booked ? 'booked' : ''].filter(Boolean).join(', ');

// .place-item.timeline-item on phones: marker, name with reference or note,
// and either a time (with lock/check) or a drag handle for flexible plans.
export const TimelineRow = memo(function TimelineRow({ item, onOpen, dragHandle }: { item: PlanItem; onOpen(item: PlanItem): void; dragHandle?: React.ReactNode }) {
  const fixed = fixedItem(item);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={planLabel(item)} accessibilityHint="Opens the plan" onPress={() => onOpen(item)} style={({ pressed }) => [styles.row, !fixed && styles.flexibleRow, pressed && styles.pressed]}>
      <PlaceMarker item={item} />
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {item.reference ? <Text style={styles.small} numberOfLines={1}>{item.reference}</Text> : null}
        {item.notes ? <Text style={styles.small} numberOfLines={1}>{item.notes}</Text> : null}
      </View>
      {fixed ? (
        <View style={styles.schedule}>
          <Icon name={item.booked ? 'check' : 'lock'} size={12} color="#999999" />
          {item.time ? <Text style={styles.time}>{formatClock(item.time)}</Text> : null}
        </View>
      ) : null}
      {!fixed && dragHandle ? <View style={styles.rowHandle}>{dragHandle}</View> : null}
    </Pressable>
  );
});

// .day-place-card in the single-day view.
export const DayCard = memo(function DayCard({ item, onOpen, dragHandle }: { item: PlanItem; onOpen(item: PlanItem): void; dragHandle?: React.ReactNode }) {
  const fixed = fixedItem(item);
  const category = item.kind && item.kind !== 'Activity' ? item.kind : '';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={planLabel(item)} accessibilityHint="Opens the plan" onPress={() => onOpen(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {item.time || fixed ? (
        <View style={styles.cardSchedule}>
          {item.time ? <Text style={styles.cardTime}>{formatClock(item.time)}</Text> : <View />}
          {fixed ? <Text style={styles.cardBooked}>{item.booked ? 'Reserved' : 'Fixed time'}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.cardHeading, !fixed && styles.cardHeadingFlexible]}>
        <PlaceMarker item={item} />
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
      </View>
      {!fixed && dragHandle ? <View style={styles.cardHandle}>{dragHandle}</View> : null}
      <View style={[styles.cardDetails, category ? styles.cardDetailsFilled : null]}>
        {category ? <Text style={styles.cardCategory}>{category}</Text> : null}
      </View>
      {item.reference ? <Text style={styles.cardReference}>{`Confirmation · ${item.reference}`}</Text> : null}
      {item.notes ? <Text style={styles.cardNote}>{item.notes}</Text> : null}
      <View style={styles.cardFooter} />
    </Pressable>
  );
});

export function DragHandleIcon() {
  return <Icon name="grip" size={20} color={colors.muted} />;
}

const styles = StyleSheet.create({
  marker: { width: 42, height: 42, borderRadius: sq(22), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 69, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: colors.white },
  flexibleRow: { paddingRight: 44 },
  pressed: { backgroundColor: colors.pressed },
  copy: { flex: 1, minWidth: 0, gap: 5, justifyContent: 'center', minHeight: 44 },
  name: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 21.25, letterSpacing: -0.25, color: '#252525' },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 15.6, color: colors.muted },
  schedule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: '#626262' },
  card: { padding: 14, borderWidth: 1, borderColor: '#ececec', borderRadius: sq(30), borderCurve: 'continuous', backgroundColor: colors.white },
  cardSchedule: { height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  cardTime: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.action },
  cardBooked: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: '#777777' },
  cardHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeadingFlexible: { paddingRight: 32 },
  cardHandle: { position: 'absolute', top: 8, right: 2, width: 44, height: 48 },
  rowHandle: { position: 'absolute', right: -8, top: 10, bottom: 10, width: 44 },
  // .place-copy is 44pt tall with the name at its top.
  cardName: { flex: 1, alignSelf: 'flex-start', fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22.5, letterSpacing: -0.35, color: '#252525' },
  cardDetails: { marginTop: 2, paddingLeft: 54 },
  cardDetailsFilled: { paddingBottom: 7 },
  cardCategory: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#737373' },
  cardReference: { marginTop: 7, paddingLeft: 54, fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: '#6b625c' },
  cardNote: { marginTop: 7, paddingLeft: 54, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: '#444444' },
  cardFooter: { marginTop: 8 },
});
