// The redesign's look (Claude Design canvas "Elsewhere — maximalist
// redesign"). Screens move onto these tokens one by one; until a screen is
// redone it keeps using theme.ts.

export const palette = {
  cream: '#FFF6E9', // page background
  paper: '#FFFFFF', // cards, inputs, outline buttons
  sand: '#F1E6D3', // segmented track, soft buttons, row dividers
  line: '#EADCC6', // card borders
  dash: '#B9A98F', // dashed "add" rows
  grabber: '#CBBFAA',
  ink: '#1A1033', // text, outlines, hard shadows, dark surfaces
  muted: '#5B4F73', // secondary text (7.3:1 on cream)
  faint: '#8C8299', // disabled text
  yellow: '#FFE14D',
  pink: '#FF3D8B', // the accent
  pinkText: '#C2185B', // pink for text on cream (5.6:1)
  orange: '#FF7A1A',
  blue: '#2457D6', // serif accent words, trip cards
  violet: '#3B2BFF', // links and text actions
  mint: '#2FE6B0',
  lavender: '#B9A8FF',
  danger: '#C0262D',
  scrim: 'rgba(26, 16, 51, 0.55)',
} as const;

// Plan and idea kinds each have a color, used for dots, pins and chips.
export const kindColors = {
  food: palette.orange,
  see: palette.mint,
  night: palette.pink,
  stay: palette.lavender,
  go: palette.violet,
} as const;

export const typefaces = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  serif: 'InstrumentSerif_400Regular_Italic',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
} as const;

// Corner radii from the canvas. Pills use `pill`.
export const radii = { sm: 13, md: 18, lg: 22, xl: 28, sheet: 34, pill: 999 } as const;

// Outline widths: hairline cards 1.5, buttons and chips 1.5–2, heavy cards 2.5.
export const strokes = { thin: 1.5, mid: 2, heavy: 2.5 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

// Page side padding on phones.
export const gutter = 20;
