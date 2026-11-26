import { memo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { arrivalLabels, flightMetadata, journeyLabels, type Flight, type Leg } from '@/lib/flight-form';
import { formatClock } from '@/lib/format';
import { kindColors, palette, strokes, typefaces } from '@/lib/design';

// AeroDataBox asks for credit wherever its data shows.
function FlightSource({ segment, light = false }: { segment: Flight; light?: boolean }) {
  if (segment.flightData?.provider !== 'AeroDataBox') return null;
  return <Text accessibilityRole="link" onPress={() => Linking.openURL('https://aerodatabox.com')} style={[styles.source, light && styles.sourceLight]}>Flight data: AeroDataBox</Text>;
}

const route = (segment: Flight) => journeyLabels(segment).title;
const number = (segment: Flight) => segment.service_id || String(segment.flightData?.flightNumber || '') || segment.mode;

// A flight in the whole-trip list, as a row like a plan's: the departure
// time and "TP 1351 · LHR → LIS", or on a later arrival day "Land at LIS".
export const FlightRow = memo(function FlightRow({ segment, leg, onOpen, last = false }: { segment: Flight; leg: Leg; onOpen(segment: Flight): void; last?: boolean }) {
  const arriving = leg === 'arrival';
  const name = arriving ? `Land at ${arrivalLabels(segment).title.replace(/^Arrive in /, '')} · ${number(segment)}` : `${number(segment)} · ${route(segment)}`;
  const time = formatClock(arriving ? segment.arrival_time : segment.departure_time);
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${name}${time ? `, ${time}` : ''}. Edit flight`} onPress={() => onOpen(segment)}
        style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.pressed]}>
        <Text style={styles.time}>{time || 'any'}</Text>
        <View accessibilityElementsHidden style={styles.dot} />
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
      </Pressable>
      <FlightSource segment={segment} />
    </View>
  );
});

// A flight in the one-day view: a violet ticket with the number, the route
// and both local times, notched on the left like a boarding pass.
export const FlightCard = memo(function FlightCard({ segment, leg = 'departure', onOpen }: { segment: Flight; leg?: Leg; onOpen(segment: Flight): void }) {
  const metadata = flightMetadata(segment.flightData).filter(value => value !== 'Flight data: AeroDataBox');
  const label = `${segment.mode === 'Train' ? 'TRAIN' : 'FLIGHT'}${leg === 'arrival' ? ' · LANDS TODAY' : ''} · ${number(segment)}`;
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${segment.mode} ${number(segment)}, ${route(segment)}`} onPress={() => onOpen(segment)}
        style={({ pressed }) => [styles.ticket, pressed && styles.ticketPressed]}>
        <View style={styles.ticketCopy}>
          <Text style={styles.ticketLabel} numberOfLines={1}>{label}</Text>
          <Text style={styles.ticketRoute} numberOfLines={1}>{route(segment)}</Text>
          {segment.flightData?.airline ? <Text style={styles.ticketMeta} numberOfLines={1}>{segment.flightData.airline}</Text> : null}
          {metadata.length ? <Text style={styles.ticketMeta} numberOfLines={2}>{metadata.join(' · ')}</Text> : null}
          {segment.notes ? <Text style={styles.ticketMeta} numberOfLines={2}>{segment.notes}</Text> : null}
        </View>
        <View style={styles.ticketTimes}>
          <Text style={styles.ticketTime}>{`${formatClock(segment.departure_time)} dep`}</Text>
          <Text style={[styles.ticketTime, styles.ticketArrive]}>{`${formatClock(segment.arrival_time)} arr`}</Text>
        </View>
        <View accessibilityElementsHidden pointerEvents="none" style={styles.notchRail}><View style={styles.notch} /></View>
      </Pressable>
      <FlightSource segment={segment} />
    </View>
  );
});

const styles = StyleSheet.create({
  pressed: { backgroundColor: palette.sand },
  row: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 14 },
  rowLine: { borderBottomWidth: strokes.thin, borderBottomColor: palette.sand },
  time: { minWidth: 62, fontFamily: typefaces.bold, fontSize: 13, color: palette.muted },
  dot: { width: 12, height: 12, borderRadius: 4, borderWidth: strokes.thin, borderColor: palette.ink, backgroundColor: kindColors.go },
  name: { flex: 1, fontFamily: typefaces.semibold, fontSize: 15, lineHeight: 20, color: palette.ink },
  source: { alignSelf: 'flex-start', marginTop: 4, marginBottom: 6, paddingHorizontal: 14, fontFamily: typefaces.medium, fontSize: 12, lineHeight: 18, color: palette.muted },
  sourceLight: { color: palette.muted },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 20, paddingRight: 16, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.violet, overflow: 'hidden' },
  ticketPressed: { opacity: 0.88 },
  ticketCopy: { flex: 1, minWidth: 0, gap: 1 },
  ticketLabel: { fontFamily: typefaces.heavy, fontSize: 11, letterSpacing: 0.6, color: palette.yellow },
  ticketRoute: { fontFamily: typefaces.display, fontSize: 22, lineHeight: 27, color: palette.paper },
  ticketMeta: { fontFamily: typefaces.medium, fontSize: 12, lineHeight: 16, color: '#DCD5FF' },
  ticketTimes: { alignItems: 'flex-end', gap: 2 },
  ticketTime: { fontFamily: typefaces.bold, fontSize: 13, color: palette.paper },
  ticketArrive: { color: palette.yellow },
  // The boarding-pass notch: a cream circle cut into the left edge.
  notchRail: { position: 'absolute', left: -9, top: 0, bottom: 0, justifyContent: 'center' },
  notch: { width: 18, height: 18, borderRadius: 9, backgroundColor: palette.cream },
});
