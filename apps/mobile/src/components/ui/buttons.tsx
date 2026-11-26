import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/text';
import { Icon } from '../icons';
import type { SymbolName } from '../icon-symbols';
import { palette, radii, strokes, typefaces } from '@/lib/design';
import { Raised } from './surfaces';

type Variant = 'ink' | 'accent' | 'yellow' | 'outline' | 'soft' | 'danger';
const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string; pressed: string }> = {
  ink: { bg: palette.ink, fg: palette.paper, pressed: '#2E2350' },
  accent: { bg: palette.pink, fg: palette.ink, border: palette.ink, pressed: '#F0247A' },
  yellow: { bg: palette.yellow, fg: palette.ink, pressed: '#F5D21F' },
  outline: { bg: palette.paper, fg: palette.ink, border: palette.ink, pressed: palette.sand },
  soft: { bg: palette.sand, fg: palette.ink, pressed: '#E8D9C0' },
  danger: { bg: palette.paper, fg: palette.danger, border: palette.danger, pressed: '#FBE9E9' },
};

// A pill button. `raised` gives the main call to action its hard shadow
// ("Start the trip ✦"); pressing pushes it into the shadow.
export function Button({ label, onPress, variant = 'ink', size = 'md', icon, raised = false, disabled, full = false, accessibilityLabel, accessibilityHint, style }: {
  label: string; onPress(): void; variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: SymbolName; raised?: boolean; disabled?: boolean; full?: boolean;
  accessibilityLabel?: string; accessibilityHint?: string; style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const height = size === 'lg' ? 58 : size === 'md' ? 48 : 40;
  const fontSize = size === 'lg' ? 17 : size === 'md' ? 15 : 14;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress} style={[full && styles.full, style]}>
      {({ pressed }) => {
        const face = (
          <View style={[styles.button, { minHeight: height, backgroundColor: pressed && !raised ? v.pressed : v.bg, paddingHorizontal: size === 'sm' ? 14 : 20 },
            v.border ? { borderWidth: raised ? strokes.heavy : strokes.mid, borderColor: v.border } : null, disabled && styles.disabled]}>
            {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} color={v.fg} strokeWidth={2.4} /> : null}
            <Text style={[styles.label, { color: v.fg, fontSize }]}>{label}</Text>
          </View>
        );
        return raised ? <Raised offset={4} radius={radii.pill} color={palette.ink} pressed={pressed && !disabled}>{face}</Raised> : face;
      }}
    </Pressable>
  );
}

// A round 44pt icon button. 'outline' is the header style (white, ink ring);
// 'soft' the sheet close button (sand, no ring); 'ink' and 'accent' fill it.
export function IconButton({ icon, label, onPress, variant = 'outline', size = 44, iconSize = 20, style }: {
  icon: SymbolName; label: string; onPress(): void; variant?: 'outline' | 'soft' | 'ink' | 'accent'; size?: number; iconSize?: number; style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'outline' ? palette.paper : variant === 'soft' ? palette.sand : variant === 'ink' ? palette.ink : palette.pink;
  const fg = variant === 'ink' ? palette.paper : palette.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        variant === 'outline' && styles.ring, pressed && styles.roundPressed, style]}>
      <Icon name={icon} size={iconSize} color={fg} strokeWidth={2.4} />
    </Pressable>
  );
}

// A text action in violet: "Sort them →", "Open day ›".
export function LinkButton({ label, onPress, color = palette.violet, style }: { label: string; onPress(): void; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }, style]}>
      <Text style={[styles.linkText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// The dashed "+ Add to Saturday" / "Free day so far" row.
export function DashedButton({ label, onPress, trailing, style }: { label: string; onPress(): void; trailing?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dashed, trailing ? styles.dashedSplit : null, pressed && { backgroundColor: palette.sand }, style]}>
      <Text style={[styles.dashedText, trailing ? { color: palette.muted, fontFamily: typefaces.semibold } : null]}>{label}</Text>
      {trailing ? <Text style={styles.dashedText}>{trailing}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radii.pill, paddingVertical: 10 },
  label: { fontFamily: typefaces.heavy, textAlign: 'center' },
  disabled: { opacity: 0.45 },
  round: { alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: strokes.thin, borderColor: palette.ink },
  roundPressed: { transform: [{ scale: 0.92 }] },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: typefaces.bold, fontSize: 14 },
  dashed: { minHeight: 50, paddingHorizontal: 16, borderRadius: radii.lg, borderWidth: strokes.mid, borderStyle: 'dashed', borderColor: palette.dash, alignItems: 'center', justifyContent: 'center' },
  dashedSplit: { flexDirection: 'row', justifyContent: 'space-between' },
  dashedText: { fontFamily: typefaces.heavy, fontSize: 14, color: palette.violet },
});
