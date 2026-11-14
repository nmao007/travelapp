import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from './icons';
import { colors, fonts } from '@/lib/theme';
import { useTrips } from '@/lib/trips';

// The site's #account-dialog on phones. It appears at once while the backdrop
// fades in (160ms); the close button fades it down 18pt (160ms) like
// closeDialogSmooth in site/dist/motion.js. Copy matches setAccountMode in app.js.
const copy = {
  login: { title: 'Sign in', submit: 'Sign in', description: 'Open the trips saved to your profile on this browser.', toggle: 'Create an account' },
  signup: { title: 'Create your account', submit: 'Create account', description: 'Create a profile for your trips on this browser.', toggle: 'Already have an account? Sign in' },
};

export function AccountSheet({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const { signIn, createAccount } = useTrips();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean }>({ text: '', error: false });
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const backdrop = useSharedValue(0), card = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    setMode('login'); setMessage({ text: '', error: false });
    card.value = 1; backdrop.value = 0;
    backdrop.value = withTiming(1, { duration: 160, easing: Easing.ease });
  }, [visible, backdrop, card]);

  const reset = () => { setEmail(''); setPassword(''); setMessage({ text: '', error: false }); };
  const closeSmooth = () => {
    card.value = withTiming(0, { duration: 160, easing: Easing.bezier(0.4, 0, 1, 1) }, done => { if (done) runOnJS(onClose)(); });
  };
  const switchMode = () => { setMode(current => current === 'signup' ? 'login' : 'signup'); setMessage({ text: '', error: false }); };

  async function submit() {
    setBusy(true); setMessage({ text: 'Opening your profile…', error: false });
    try {
      if (mode === 'signup') await createAccount(email, password); else await signIn(email, password);
      reset(); onClose();
    } catch (error) {
      setMessage({ text: (error as Error).message || 'Could not open this profile.', error: true });
    } finally { setBusy(false); }
  }

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: card.value, transform: [{ translateY: (1 - card.value) * 18 }] }));
  const text = copy[mode];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={closeSmooth}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSmooth} accessibilityLabel="Close account dialog" />
        <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal>
          <View style={styles.heading}>
            <View>
              <Text style={styles.label}>YOUR PROFILE</Text>
              <Text style={styles.title} accessibilityRole="header">{text.title}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close account dialog" onPress={closeSmooth} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              {({ pressed }) => <View style={pressed && styles.iconPressed}><Icon name="close" size={18} color={colors.closeIcon} /></View>}
            </Pressable>
          </View>
          <Text style={styles.description}>{text.description}</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input} value={email} onChangeText={setEmail} autoFocus
              autoComplete="email" textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              maxLength={254} placeholder="you@example.com" placeholderTextColor={colors.inputPlaceholder}
              returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} submitBehavior="submit"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              ref={passwordRef} style={styles.input} value={password} onChangeText={setPassword} secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              placeholder="At least 8 characters" placeholderTextColor={colors.inputPlaceholder} returnKeyType="go" onSubmitEditing={submit}
            />
          </View>
          {message.text ? <Text style={[styles.message, message.error && styles.error]} accessibilityLiveRegion="polite">{message.text}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}>
            <Text style={styles.submitText}>{text.submit}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={switchMode} style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
            <Text style={styles.toggleText}>{text.toggle}</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.backdrop },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // 364pt wide on a 402pt screen (19pt margins), 20pt padding, 16pt gaps.
  card: {
    width: '100%', maxWidth: 364, marginHorizontal: 19, padding: 20, gap: 16, backgroundColor: colors.white,
    borderTopLeftRadius: 42, borderTopRightRadius: 42, borderCurve: 'continuous',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, shadowOffset: { width: 0, height: -5 },
  },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  title: { marginTop: 6, fontFamily: fonts.semibold, fontSize: 24, letterSpacing: -0.96, color: colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  description: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.muted },
  field: { gap: 7 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  input: { height: 48, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.inputLine, borderRadius: 22, backgroundColor: colors.white, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  message: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  error: { color: colors.danger },
  submit: { minHeight: 52, paddingVertical: 12, paddingHorizontal: 19, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  submitPressed: { backgroundColor: colors.accentPressed },
  submitText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.white },
  toggle: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 6, borderRadius: 22, justifyContent: 'center' },
  toggleText: { fontFamily: fonts.bold, fontSize: 14, color: colors.action, textDecorationLine: 'underline', textDecorationColor: colors.action },
  pressed: { backgroundColor: colors.pressed },
  iconPressed: { transform: [{ scale: 0.9 }] },
});
