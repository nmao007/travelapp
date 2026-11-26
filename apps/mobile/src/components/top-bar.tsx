import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text, TIGHT_SCALE } from '@/components/text';
import { BrandSlash, Icon } from './icons';
import { Popover, useAnchor } from './popover';
import { afterSheetCloses } from './sheet';
import { apiUrl } from '@/lib/config';
import { haptics } from '@/lib/haptics';
import { colors, fonts, sq } from '@/lib/theme';
import { useTrips } from '@/lib/trips';

// .topbar on phones: 44pt tall, 20pt side padding, 12pt gap. Signed out it
// shows "Sign in"; signed in, the account's initial opens the account menu.
export function TopBar({ onSignIn }: { onSignIn(): void }) {
  const { account } = useTrips();
  return (
    <View style={styles.bar}>
      <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Elsewhere home">
        <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.wordmark}>ELSE</Text>
        <BrandSlash color={colors.action} />
        <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.wordmark}>WHERE</Text>
      </View>
      {account ? <AccountMenu email={account.email} /> : (
        <Pressable accessibilityRole="button" onPress={onSignIn} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
          <Text style={styles.accountText}>Sign in</Text>
        </Pressable>
      )}
    </View>
  );
}

// Sign out, delete the account (Apple requires it in the app), and the
// privacy and support pages the store listing links to.
function AccountMenu({ email }: { email: string }) {
  const { signOut, deleteAccount, showHomeStatus } = useTrips();
  const { ref, anchor, open, close } = useAnchor();
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try { await task(); } catch (error) { showHomeStatus((error as Error).message); } finally { setBusy(false); }
  };
  const confirmDelete = () => {
    haptics.warning();
    Alert.alert('Delete your account?', `This deletes ${email || 'your account'} and every trip and idea saved to it. It can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => run(deleteAccount) },
    ]);
  };
  const items: { key: string; label: string; icon: 'signout' | 'trash' | 'lock' | 'external'; danger?: boolean; onPress(): void }[] = [
    { key: 'signout', label: 'Sign out', icon: 'signout', onPress: () => run(signOut) },
    { key: 'privacy', label: 'Privacy policy', icon: 'lock', onPress: () => Linking.openURL(`${apiUrl}/privacy`) },
    { key: 'support', label: 'Help and support', icon: 'external', onPress: () => Linking.openURL(`${apiUrl}/support`) },
    { key: 'delete', label: 'Delete account', icon: 'trash', danger: true, onPress: () => afterSheetCloses(confirmDelete) },
  ];

  return (
    <View ref={ref} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Account, ${email}`} disabled={busy} onPress={open} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
        {busy ? <ActivityIndicator color={colors.muted} /> : (
          <View style={styles.avatar}><Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.avatarText}>{(email[0] || '?').toUpperCase()}</Text></View>
        )}
      </Pressable>
      <Popover anchor={anchor} align="right" width={248} onClose={close} style={styles.menu}>
        <Text style={styles.email} numberOfLines={1}>{email}</Text>
        {items.map(item => (
          <Pressable key={item.key} accessibilityRole="menuitem" onPress={() => { close(); item.onPress(); }} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
            <Icon name={item.icon} size={19} color={item.danger ? colors.danger : colors.muted} />
            <Text style={[styles.menuText, item.danger && styles.danger]}>{item.label}</Text>
          </Pressable>
        ))}
      </Popover>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 44, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 22 },
  wordmark: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 21, letterSpacing: -0.9, color: colors.ink, includeFontPadding: false },
  account: { height: 44, paddingHorizontal: 10, borderRadius: sq(22), borderCurve: 'continuous', justifyContent: 'center' },
  accountText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  avatarButton: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  menu: { borderRadius: sq(20), borderCurve: 'continuous' },
  email: { paddingTop: 8, paddingBottom: 6, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: sq(22), borderCurve: 'continuous' },
  menuText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 19.5, color: colors.ink },
  danger: { color: colors.danger },
  pressed: { backgroundColor: colors.pressed },
});
