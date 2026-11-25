import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TIGHT_SCALE } from '@/components/text';
import { BrandSlash, Icon } from './icons';
import { colors, fonts, sq } from '@/lib/theme';
import { useTrips } from '@/lib/trips';

// .topbar on phones: 44pt tall, 20pt side padding, 12pt gap. Signed out it
// shows "Sign in"; signed in, an icon-only sign-out button.
export function TopBar({ onSignIn }: { onSignIn(): void }) {
  const { account, signOut } = useTrips();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <View style={styles.bar}>
      <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Elsewhere home">
        <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.wordmark}>ELSE</Text>
        <BrandSlash color={colors.action} />
        <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.wordmark}>WHERE</Text>
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
  account: { height: 44, paddingHorizontal: 10, borderRadius: sq(22), borderCurve: 'continuous', justifyContent: 'center' },
  accountText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  signOut: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.pressed },
  iconPressed: { transform: [{ scale: 0.9 }] },
});
