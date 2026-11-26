// The old site-matched theme, now mapped onto the redesign's palette and Inter
// (src/lib/design.ts) so screens not yet rebuilt still look like the rest.
// New code uses design.ts directly.
export const colors = {
  ink: '#1A1033',
  title: '#1A1033',
  muted: '#5B4F73',
  action: '#3B2BFF', // links and text actions (violet)
  accent: '#1A1033', // primary buttons: ink with white text
  accentPressed: '#2E2350',
  punctuation: '#FF3D8B',
  searchIcon: '#1A1033',
  danger: '#C0262D',
  line: '#EADCC6',
  inputLine: '#EADCC6',
  searchLine: '#1A1033',
  searchFocusLine: '#1A1033',
  searchFocusFill: '#FFFFFF',
  searchFocusRing: '#FFE14D',
  placeholder: '#8C8299',
  inputPlaceholder: '#8C8299',
  soft: '#F1E6D3',
  pressed: '#F1E6D3',
  sectionLabel: '#5B4F73',
  tripTitle: '#1A1033',
  tripMeta: '#5B4F73',
  tripArrow: '#1A1033',
  closeIcon: '#1A1033',
  backdrop: 'rgba(26, 16, 51, 0.55)',
  white: '#ffffff',
};

// Recent trip cards cycle through three tints (:nth-child(3n+1/2/3)).
export const tripCardTints = [
  { background: '#f8f9fc', border: '#eff0f3' },
  { background: '#fff8f2', border: '#f9eee5' },
  { background: '#f6f4fc', border: '#efedf6' },
];

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

// CSS --ease-out: cubic-bezier(.16, 1, .3, 1)
export const easeOut = [0.16, 1, 0.3, 1] as const;

// The site gives every element on phones CSS squircle corners (corner-shape:
// squircle in phone.css). iOS continuous corners at ~0.65x the CSS radius
// draw the same shape; use sq() for every radius taken from the site's CSS.
export const sq = (radius: number) => Math.round(radius * 0.65 * 10) / 10;
