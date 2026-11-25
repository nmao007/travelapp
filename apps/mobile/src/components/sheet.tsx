import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, sq } from '@/lib/theme';

// The site's phone .editor-dialog: a sheet attached to the bottom edge with
// 42pt top corners. It appears at once while the backdrop fades in (160ms) and
// closes by fading down 18pt (closeDialogSmooth in motion.js).
type Slot = ReactNode | ((close: () => void) => ReactNode);
const fill = (slot: Slot, close: () => void) => typeof slot === 'function' ? slot(close) : slot;

export function BottomSheet({ visible, onClose, children, footer, header }: { visible: boolean; onClose(): void; children: Slot; footer?: Slot; header?: Slot }) {
  const insets = useSafeAreaInsets();
  // With the keyboard up, the home indicator's space under the footer isn't needed.
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardWillShow', () => setKeyboard(true));
    const hidden = Keyboard.addListener('keyboardWillHide', () => setKeyboard(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  const bottom = keyboard ? 8 : insets.bottom;
  const backdrop = useSharedValue(0), card = useSharedValue(1);
  useEffect(() => {
    if (!visible) return;
    card.value = 1; backdrop.value = 0;
    backdrop.value = withTiming(1, { duration: 160, easing: Easing.ease });
  }, [visible, backdrop, card]);
  const close = () => { card.value = withTiming(0, { duration: 160, easing: Easing.bezier(0.4, 0, 1, 1) }, done => { if (done) runOnJS(onClose)(); }); };
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * card.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: card.value, transform: [{ translateY: (1 - card.value) * 18 }] }));
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <KeyboardAvoidingView style={[styles.fill, { paddingTop: insets.top + 12 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <Animated.View style={[styles.sheet, cardStyle]} accessibilityViewIsModal>
          {fill(header, close)}
          {fill(children, close)}
          {footer ? <View style={{ paddingBottom: bottom }}>{fill(footer, close)}</View> : <View style={{ height: bottom }} />}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.backdrop },
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    // Shrinks to the room above the keyboard; the sheet's own list scrolls.
    flexShrink: 1, backgroundColor: colors.white, borderTopLeftRadius: sq(42), borderTopRightRadius: sq(42), borderCurve: 'continuous', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, shadowOffset: { width: 0, height: -5 },
  },
});
