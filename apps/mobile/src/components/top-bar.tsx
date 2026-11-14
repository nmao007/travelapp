import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandSlash, Icon } from './icons';
import { colors, fonts } from '@/lib/theme';
import { useTrips } from '@/lib/trips';

// .topbar on phones: 44pt tall, 20pt side padding, 12pt gap. Signed out it
// shows "Sign in"; signed in, an icon-only sign-out button.
export function TopBar({ onSignIn }: { onSignIn(): void }) {
  const { account, signOut } = useTrips();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <View style={styles.bar}>
      <View style={styles.brand} accessibilityRole="header" accessibilityLabel="TripPilot home">
        <Text style={styles.wordmark}>TRIP</Text>
        <BrandSlash color={colors.action} />
        <Text style={styles.wordmark}>PILOT</Text>
      </View>
      {account ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          disabled={signingOut}
          onPress={async () => { setSigningOut(true); try { await signOut(); } finally { setSigningOut(false); } }}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          {({ pressed }) => <View style={pressed && styles.iconPressed}><Icon name="signout" color={colors.muted} /></View>}
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={onSignIn} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
          <Text style={styles.accountText}>Sign in</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 44, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white },
  brand: { flexDirection: 'row', alignItems: 'center', height: 22 },
  wordmark: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 21, letterSpacing: -0.9, color: colors.ink, includeFontPadding: false },
  account: { height: 44, paddingHorizontal: 10, borderRadius: 22, justifyContent: 'center' },
  accountText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  signOut: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.pressed },
  iconPressed: { transform: [{ scale: 0.9 }] },
});
