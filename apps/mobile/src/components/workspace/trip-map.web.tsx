import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { colors, fonts } from '@/lib/theme';
import type { Trip } from '@/lib/trips';

// react-native-maps has no web version. The web preview is only for checking
// layout, so it shows the site's "Map unavailable" state instead.
export function TripMap(_: { trip: Trip; stopFilter: string | null; commit(trip: Trip): void; onNotice(message: string): void; onNeedDates(): void; onOpenPlan(placeId: string): void }) {
  return <View style={styles.frame}><Text style={styles.text}>Map unavailable</Text></View>;
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  text: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
