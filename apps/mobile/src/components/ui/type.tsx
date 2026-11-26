import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { Text, TIGHT_SCALE } from '@/components/text';
import { palette, typefaces } from '@/lib/design';

// The redesign's type. Display sizes (Bricolage Grotesque) grow less with the
// phone's text size than body text, so a 58pt title can't push a screen apart.
type Props = { children: React.ReactNode; style?: StyleProp<TextStyle>; color?: string; numberOfLines?: number; accessibilityRole?: 'header' };

const DISPLAY = {
  hero: { fontSize: 58, lineHeight: 58, letterSpacing: -2.5 },
  title: { fontSize: 46, lineHeight: 46, letterSpacing: -2 },
  sheet: { fontSize: 30, lineHeight: 32, letterSpacing: -1 },
  section: { fontSize: 22, lineHeight: 26, letterSpacing: -0.5 },
  card: { fontSize: 18, lineHeight: 22, letterSpacing: -0.2 },
} as const;

// A Bricolage Grotesque heading. Big sizes are tight-leading, so a serif
// accent word inside one (Accent) sits on the same line.
export function Display({ size = 'section', children, style, color = palette.ink, numberOfLines, accessibilityRole }: Props & { size?: keyof typeof DISPLAY }) {
  return (
    <Text maxFontSizeMultiplier={TIGHT_SCALE} numberOfLines={numberOfLines} accessibilityRole={accessibilityRole}
      style={[styles.display, DISPLAY[size], { color }, style]}>
      {children}
    </Text>
  );
}

// The italic serif word inside a heading: "Where to *next?*". Nest it in
// Display; it inherits the heading's size unless given one. Given a size, it
// also gets room above for the serif's tall question marks and capitals.
export function Accent({ children, color = palette.blue, size }: { children: React.ReactNode; color?: string; size?: number }) {
  return <Text style={[styles.accent, { color }, size ? { fontSize: size * 1.12, lineHeight: Math.round(size * 1.3) } : null]}>{children}</Text>;
}

// Small caps label: "UP NEXT", "WHERE IN ITALY?".
export function Eyebrow({ children, style, color = palette.ink }: Props) {
  return <Text maxFontSizeMultiplier={TIGHT_SCALE} style={[styles.eyebrow, { color }, style]}>{children}</Text>;
}

// Inter body text.
const BODY = {
  lg: { fontSize: 16, lineHeight: 22 },
  md: { fontSize: 15, lineHeight: 21 },
  sm: { fontSize: 13, lineHeight: 18 },
  xs: { fontSize: 12, lineHeight: 16 },
} as const;
const WEIGHT = { regular: typefaces.regular, medium: typefaces.medium, semibold: typefaces.semibold, bold: typefaces.bold, heavy: typefaces.heavy } as const;

export function Body({ size = 'md', weight = 'semibold', children, style, color = palette.ink, numberOfLines }: Props & { size?: keyof typeof BODY; weight?: keyof typeof WEIGHT }) {
  return <Text numberOfLines={numberOfLines} style={[BODY[size], { fontFamily: WEIGHT[weight], color }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  display: { fontFamily: typefaces.display },
  // Instrument Serif runs small next to Bricolage at the same size.
  accent: { fontFamily: typefaces.serif, letterSpacing: 0 },
  eyebrow: { fontFamily: typefaces.heavy, fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
});
