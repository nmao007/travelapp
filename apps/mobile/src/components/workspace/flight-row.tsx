import { memo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Art } from '../icons';
import { arrivalLabels, flightMetadata, journeyLabels, legLabel, legs, type Flight, type Leg } from '@/lib/flight-form';
import { formatClock } from '@/lib/format';
import { colors, fonts, sq } from '@/lib/theme';

// .flight-main-icon with the plane illustration (a train for ones added on the site).
function FlightIcon({ segment }: { segment: Flight }) {
  const train = segment.mode === 'Train';
  return <View style={[styles.icon, { backgroundColor: train ? '#f4f3fb' : '#f0f3fc' }]}><Art name={train ? 'train' : 'plane'} size={34} /></View>;
}

// appendFlightSource(): AeroDataBox asks for credit wherever its data shows.
function FlightSource({ segment }: { segment: Flight }) {
  if (segment.flightData?.provider !== 'AeroDataBox') return null;
  return <Text accessibilityRole="link" onPress={() => Linking.openURL('https://aerodatabox.com')} style={styles.source}>Flight data: AeroDataBox</Text>;
}

// transportJourney() and arrivalJourney() in itinerary-ui.js: a flight in the
// timeline and calendar agenda. The departure day shows the route and both
// times; a later arrival day shows "Arrive in …" with the landing time.
export const FlightRow = memo(function FlightRow({ segment, leg, onOpen }: { segment: Flight; leg: Leg; onOpen(segment: Flight): void }) {
  if (leg === 'arrival') {
    const { title, detail, time } = arrivalLabels(segment);
    return (
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${title} at ${time}${segment.service_id ? ` · ${segment.service_id}` : ''}`} onPress={() => onOpen(segment)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <FlightIcon segment={segment} />
          <View style={styles.copy}>
            <Text style={styles.arrivalTitle} numberOfLines={1}>{title}</Text>
            {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}
          </View>
          <Text style={styles.arrivalTime}>{time}</Text>
        </Pressable>
        <FlightSource segment={segment} />
      </View>
    );
  }
  const { title, detail } = journeyLabels(segment);
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit flight ${segment.service_id}, ${title}, ${detail}`} onPress={() => onOpen(segment)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <FlightIcon segment={segment} />
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
      </Pressable>
      <FlightSource segment={segment} />
    </View>
  );
});

// transportCard() in the single-day view: number and airline, then each leg's
// date, local time and airport, with the provider's details underneath.
export const FlightCard = memo(function FlightCard({ segment, onOpen }: { segment: Flight; onOpen(segment: Flight): void }) {
  const metadata = flightMetadata(segment.flightData);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${segment.mode} ${segment.service_id}, departure`} onPress={() => onOpen(segment)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardHeading}>
        <Art name={segment.mode === 'Train' ? 'train' : 'plane'} size={30} />
        <Text style={styles.cardNumber} numberOfLines={1}>{segment.service_id}</Text>
        {segment.flightData?.airline ? <Text style={styles.cardAirline} numberOfLines={1}>{segment.flightData.airline}</Text> : null}
      </View>
      <View style={styles.cardLegs}>
        {legs.map(key => (
          <View key={key} style={styles.cardLeg}>
            <Text style={styles.cardLegLabel}>{legLabel(segment, key)}</Text>
            <Text style={styles.cardTime}>{formatClock(segment[`${key}_time`])}</Text>
            <Text style={styles.cardLocation}>{segment[`${key}_location`]}</Text>
          </View>
        ))}
      </View>
      {metadata.length ? <View style={styles.metadata}>{metadata.map(value => <Text key={value} style={styles.metadataText}>{value}</Text>)}</View> : null}
      {segment.notes ? <Text style={styles.notes}>{segment.notes}</Text> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.pressed },
  // .place-marker / .flight-main-icon with an illustration: 42pt, 22pt squircle.
  icon: { width: 42, height: 42, borderRadius: sq(22), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  // .flight-main-card on phones: flat, 68pt tall, a hairline under it.
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eeeeee', backgroundColor: colors.white },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, letterSpacing: -0.2, color: colors.ink },
  detail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: '#666666' },
  arrivalTitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 21.25, letterSpacing: -0.25, color: '#252525' },
  arrivalTime: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: '#555555' },
  source: { alignSelf: 'flex-start', marginTop: 4, marginBottom: 10, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.muted },
  // .selected-day > .transport-card on phones.
  card: { padding: 14, borderWidth: 1, borderColor: '#e9eaed', borderRadius: sq(30), borderCurve: 'continuous', backgroundColor: colors.white, backgroundImage: 'linear-gradient(135deg, #f6f7ff, #ffffff 70%)' },
  cardPressed: { backgroundImage: undefined, backgroundColor: colors.pressed },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardNumber: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  cardAirline: { flexShrink: 1, marginLeft: 'auto', fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  cardLegs: { flexDirection: 'row', gap: 16, marginTop: 10 },
  cardLeg: { flex: 1, minWidth: 0, gap: 6 },
  cardLegLabel: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted },
  cardTime: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.8, color: colors.action },
  cardLocation: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.ink },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, marginTop: 14 },
  metadataText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.muted },
  notes: { marginTop: 15, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
});
