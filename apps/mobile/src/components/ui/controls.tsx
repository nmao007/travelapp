import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/text';
import { palette, radii, strokes, typefaces } from '@/lib/design';
import { haptics } from '@/lib/haptics';

// A pill chip: filters ("Food"), place picks ("✓ Manteigaria"), months.
// Selected chips go ink (filters) or yellow with a heavier ring (picks).
export function Chip({ label, selected = false, onPress, dot, look = 'ink', disabled, size = 'md', style }: {
  label: string; selected?: boolean; onPress?(): void; dot?: string; look?: 'ink' | 'yellow'; disabled?: boolean; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle>;
}) {
  const on = look === 'ink'
    ? { backgroundColor: palette.ink, borderColor: palette.ink, color: palette.paper }
    : { backgroundColor: palette.yellow, borderColor: palette.ink, color: palette.ink };
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled: !!disabled }} disabled={disabled || !onPress} onPress={onPress}
      hitSlop={size === 'sm' ? 5 : 3}
      style={({ pressed }) => [styles.chip, size === 'sm' ? styles.chipSm : null,
        selected ? { backgroundColor: on.backgroundColor, borderColor: on.borderColor, borderWidth: look === 'yellow' ? strokes.mid : strokes.thin } : null,
        disabled ? styles.chipDisabled : null, pressed && !selected ? { backgroundColor: palette.sand } : null, style]}>
      {dot ? <View accessibilityElementsHidden style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.chipText, size === 'sm' ? styles.chipTextSm : null, { color: selected ? on.color : disabled ? palette.faint : palette.ink }]}>{label}</Text>
    </Pressable>
  );
}

// The Whole trip / Day switch: a sand track with the chosen side in white.
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange(value: T): void; label: string }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.track}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }}
            onPress={() => { if (!selected) { haptics.select(); onChange(option.value); } }}
            style={[styles.segment, selected && styles.segmentOn]}>
            <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: strokes.thin, borderColor: palette.line, backgroundColor: palette.paper },
  chipSm: { minHeight: 34, paddingHorizontal: 10 },
  chipDisabled: { backgroundColor: palette.sand, borderStyle: 'dashed', borderColor: palette.grabber },
  dot: { width: 9, height: 9, borderRadius: 3 },
  chipText: { fontFamily: typefaces.heavy, fontSize: 14 },
  chipTextSm: { fontFamily: typefaces.bold, fontSize: 13 },
  track: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.pill, backgroundColor: palette.sand },
  segment: { flex: 1, minHeight: 38, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: palette.paper, shadowColor: palette.ink, shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontFamily: typefaces.semibold, fontSize: 14, color: palette.muted },
  segmentTextOn: { fontFamily: typefaces.heavy, color: palette.ink },
});
