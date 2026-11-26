import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/text';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from './icons';
import { palette, radii, typefaces } from '@/lib/design';

type Anchor = { x: number; y: number; width: number; height: number };

// A floating panel under (or aligned to) a trigger, closed by tapping outside.
// Fades and drops 6pt in over 160ms like the site's dropdown and menu motion;
// `above` opens it over the trigger instead, rising into place.
export function Popover({ anchor, align = 'left', width, above = false, onClose, children, style }: { anchor: Anchor | null; align?: 'left' | 'right'; width?: number; above?: boolean; onClose(): void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const progress = useSharedValue(0);
  const { height } = useWindowDimensions();
  useEffect(() => { if (anchor) { progress.value = 0; progress.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }); } }, [anchor, progress]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * (above ? 6 : -6) }] }));
  if (!anchor) return null;
  const position = align === 'right' ? { right: undefined, left: anchor.x + anchor.width - (width ?? anchor.width) } : { left: anchor.x };
  const edge = above ? { bottom: height - anchor.y + 8 } : { top: anchor.y + anchor.height + 8 };
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View style={[styles.panel, { ...edge, width: width ?? anchor.width, ...position }, motion, style]}>
        {children}
      </Animated.View>
    </Modal>
  );
}

// Measure a trigger in window coordinates, for anchoring a Popover.
export function useAnchor() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = () => ref.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  return { ref, anchor, open, close: () => setAnchor(null) };
}

// .coded-dropdown on phones: a value with a chevron that flips while open, and
// a list of options with a check on the selected one.
export function Dropdown<T extends string>({ value, options, onChange, label, triggerStyle, valueStyle, chevronColor = palette.ink, disabled, gap = 8, fullWidth }: {
  value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange(value: T): void; label: string;
  triggerStyle?: StyleProp<ViewStyle>; valueStyle?: StyleProp<TextStyle>; chevronColor?: string; disabled?: boolean; gap?: number; fullWidth?: boolean;
}) {
  const { ref, anchor, open, close } = useAnchor();
  const { height } = useWindowDimensions();
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const current = options.find(option => option.value === value);
  // Long lists (time zones) scroll within the room left on screen, opening
  // above the trigger when there's more room there, scrolled to the value.
  const below = anchor ? height - (anchor.y + anchor.height + 8) - 34 : 0, aboveRoom = anchor ? anchor.y - 8 - 54 : 0;
  const above = Boolean(anchor) && options.length * OPTION > below && aboveRoom > below;
  const maxHeight = Math.max(OPTION * 3, above ? aboveRoom : below) - 14;
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  return (
    <View ref={ref} collapsable={false} style={fullWidth ? { flex: 1 } : undefined}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: Boolean(anchor), disabled }} disabled={disabled} onPress={open}
        style={({ pressed }) => [styles.trigger, { gap }, triggerStyle, pressed && styles.pressed]}>
        <Text style={valueStyle} numberOfLines={1}>{current?.label ?? ''}</Text>
        <Icon name="chevron" size={16} color={chevronColor} style={anchor ? styles.flipped : undefined} />
      </Pressable>
      <Popover anchor={anchor} above={above} onClose={close} style={styles.menu}>
        <ScrollView ref={list} style={{ maxHeight }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={options.length * OPTION > maxHeight}
          onContentSizeChange={() => requestAnimationFrame(() => list.current?.scrollTo({ y: Math.max(0, selectedIndex * OPTION - maxHeight / 2 + OPTION / 2), animated: false }))}>
          {options.map(option => {
            const selected = option.value === value;
            return (
              <Pressable key={option.value} accessibilityRole="menuitem" accessibilityState={{ selected, disabled: option.disabled }} disabled={option.disabled}
                onPress={() => { close(); if (!selected) onChange(option.value); }}
                style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && !selected && styles.pressed, option.disabled && styles.disabled]}>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={1}>{option.label}</Text>
                <Icon name="check" size={16} strokeWidth={2.6} color={palette.ink} style={{ opacity: selected ? 1 : 0 }} />
              </Pressable>
            );
          })}
        </ScrollView>
      </Popover>
    </View>
  );
}

const OPTION = 44;
const styles = StyleSheet.create({
  // The redesign's menu panel: white, 22pt corners, a soft ink shadow.
  panel: {
    position: 'absolute', padding: 6, backgroundColor: palette.paper, borderRadius: radii.lg, borderCurve: 'continuous',
    shadowColor: palette.ink, shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 16 }, elevation: 12,
  },
  trigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: radii.pill },
  pressed: { backgroundColor: palette.sand },
  flipped: { transform: [{ rotate: '180deg' }] },
  menu: {},
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  optionSelected: { backgroundColor: palette.sand },
  optionText: { flexShrink: 1, fontFamily: typefaces.semibold, fontSize: 16, color: palette.ink },
  optionTextSelected: { fontFamily: typefaces.heavy },
  disabled: { opacity: 0.3 },
});
