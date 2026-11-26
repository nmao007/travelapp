import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, TIGHT_SCALE } from '@/components/text';
import { palette, radii, strokes, typefaces } from '@/lib/design';

// The canvas's hard offset shadow (box-shadow: 6px 6px 0 #1A1033). Drawn as an
// ink layer behind the content rather than a native shadow, so it's the same
// on iOS and Android. The wrapper keeps the offset's room in the layout.
export function Raised({ offset = 5, radius = radii.xl, color = palette.ink, pressed = false, style, children }: {
  offset?: number; radius?: number; color?: string; pressed?: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  return (
    <View style={[{ marginRight: offset, marginBottom: offset }, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: offset, left: offset, right: -offset, bottom: -offset, borderRadius: radius, borderCurve: 'continuous', backgroundColor: color }]} />
      {/* Pressing pushes the face into its shadow. */}
      <View style={pressed ? { transform: [{ translateX: offset }, { translateY: offset }] } : null}>{children}</View>
    </View>
  );
}

type Tone = 'paper' | 'ink' | 'yellow' | 'pink' | 'blue' | 'violet' | 'orange' | 'mint' | 'lavender';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  paper: { bg: palette.paper, fg: palette.ink },
  ink: { bg: palette.ink, fg: palette.paper },
  yellow: { bg: palette.yellow, fg: palette.ink },
  pink: { bg: palette.pink, fg: palette.ink },
  blue: { bg: palette.blue, fg: palette.paper },
  violet: { bg: palette.violet, fg: palette.paper },
  orange: { bg: palette.orange, fg: palette.ink },
  mint: { bg: palette.mint, fg: palette.ink },
  lavender: { bg: palette.lavender, fg: palette.ink },
};
export const toneColors = (tone: Tone) => TONES[tone];
export type { Tone };

// A card. `outline`: 'heavy' draws the 2.5pt ink border of the bold cards
// (Up next, Someday pile); 'soft' the 1.5pt sand border of quiet rows.
// `raised` adds the hard shadow.
export function Card({ tone = 'paper', outline = 'soft', raised = false, radius = radii.xl, style, children }: {
  tone?: Tone; outline?: 'heavy' | 'soft' | 'none'; raised?: boolean; radius?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  const face = (
    <View style={[{ backgroundColor: TONES[tone].bg, borderRadius: radius, borderCurve: 'continuous' }, outline === 'heavy' ? styles.heavy : outline === 'soft' ? styles.soft : null, style]}>
      {children}
    </View>
  );
  return raised ? <Raised radius={radius}>{face}</Raised> : face;
}

// A tilted pill badge: "IN 19 DAYS ✦", "TODAY · SUN, NOV 15".
export function Sticker({ children, tone = 'yellow', tilt = -6, style }: { children: React.ReactNode; tone?: Tone; tilt?: number; style?: StyleProp<ViewStyle> }) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.sticker, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <Text maxFontSizeMultiplier={TIGHT_SCALE} style={[styles.stickerText, { color: fg }]}>{children}</Text>
    </View>
  );
}

// The small colored square for a plan or idea kind.
export function KindDot({ color, size = 12, outlined = true }: { color: string; size?: number; outlined?: boolean }) {
  return <View accessibilityElementsHidden style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: color, borderWidth: outlined ? strokes.thin : 0, borderColor: palette.ink }} />;
}

// The sheet's drag handle.
export function Grabber() {
  return <View accessibilityElementsHidden style={styles.grabber} />;
}

const styles = StyleSheet.create({
  heavy: { borderWidth: strokes.heavy, borderColor: palette.ink },
  soft: { borderWidth: strokes.thin, borderColor: palette.line },
  sticker: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12, borderRadius: radii.pill, borderWidth: strokes.mid, borderColor: palette.ink },
  stickerText: { fontFamily: typefaces.display, fontSize: 13, lineHeight: 16, letterSpacing: 0.6 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 4, backgroundColor: palette.grabber },
});
