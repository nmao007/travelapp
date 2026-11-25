import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import type { Trip } from '@/lib/trips';

// react-native-maps has no web version. The web preview is only for checking
// layout, so it shows the site's "Map unavailable" state instead.
export function ExploreMap(_: { trip: Trip; stopFilter: string | null; onOpenPlan(placeId: string): void }) {
  return <View style={styles.frame}><Text style={styles.text}>Map unavailable</Text></View>;
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  text: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
