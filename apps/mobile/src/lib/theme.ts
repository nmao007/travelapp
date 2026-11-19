// Values measured from the site's phone layout (402pt wide, site/dist/*.css) so
// the native screens match it exactly. Change them together with the site.
export const colors = {
  ink: '#242424',
  title: '#292c35', // rgb(41, 44, 53)
  muted: '#666666',
  action: '#c34e1f',
  accent: '#f36b32',
  accentPressed: '#ba4c1b',
  punctuation: '#ef7541', // rgb(239, 117, 65)
  searchIcon: '#e76632', // rgb(231, 102, 50)
  danger: '#b13d38', // rgb(177, 61, 56)
  line: '#ececec',
  inputLine: '#dfe2e7', // rgb(223, 226, 231)
  searchLine: '#e3e5eb', // rgb(227, 229, 235)
  searchFocusLine: '#ef7541',
  searchFocusFill: '#fffcfa',
  searchFocusRing: '#fff0e6',
  placeholder: '#8b8e99', // rgb(139, 142, 153)
  inputPlaceholder: '#858b95', // rgb(133, 139, 149)
  soft: '#f5f6f8',
  pressed: '#f4f4f4',
  sectionLabel: '#5d6270', // rgb(93, 98, 112)
  tripTitle: '#313541', // rgb(49, 53, 65)
  tripMeta: '#7d8290', // rgb(125, 130, 144)
  tripArrow: '#969ca9', // rgb(150, 156, 169)
  closeIcon: '#555555',
  backdrop: 'rgba(0, 0, 0, 0.333)',
  white: '#ffffff',
};

// Recent trip cards cycle through three tints (:nth-child(3n+1/2/3)).
export const tripCardTints = [
  { background: '#f8f9fc', border: '#eff0f3' },
  { background: '#fff8f2', border: '#f9eee5' },
  { background: '#f6f4fc', border: '#efedf6' },
];

export const fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};

// CSS --ease-out: cubic-bezier(.16, 1, .3, 1)
export const easeOut = [0.16, 1, 0.3, 1] as const;

// The site gives every element on phones CSS squircle corners (corner-shape:
// squircle in phone.css). iOS continuous corners at ~0.65x the CSS radius
// draw the same shape; use sq() for every radius taken from the site's CSS.
export const sq = (radius: number) => Math.round(radius * 0.65 * 10) / 10;
