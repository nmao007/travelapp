import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// The site's <symbol> icons (site/dist/index.html): 24×24, stroke 1.8, round caps.
const paths = {
  search: <><Circle cx={10.8} cy={10.8} r={6.6} /><Path d="m16 16 4.5 4.5" /></>,
  arrow: <Path d="M5 12h14m-6-6 6 6-6 6" />,
  close: <Path d="M5 5l14 14M19 5 5 19" />,
  signout: <Path d="M10 4H4v16h6m4-12 4 4-4 4m-5-4h13" />,
};

export function Icon({ name, size = 20, color }: { name: keyof typeof paths; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </Svg>
  );
}

// placeArt('guide') from site/dist/place-art.js, used on recent trip cards.
export function GuideArt({ size = 38 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x={8} y={9} width={28} height={32} rx={5} fill="#9ba5e8" />
      <Path d="M14 9v32" stroke="#7782cd" strokeWidth={2} />
      <Path d="m25 15 7 12-7 7-7-7Z" fill="#ffdf9c" />
      <Path d="m25 18 3 9-3 4-3-4Z" fill="#f38a50" />
      <Path d="m36 11 5-4v18l-5-3" fill="#e7bd67" />
    </Svg>
  );
}

// The brand slash: viewBox 0 0 10 24, drawn 9×22. On the site it sits 3pt
// from each word (1px margin plus inline spacing), measured at phone width.
export function BrandSlash({ color }: { color: string }) {
  return (
    <View style={{ marginHorizontal: 3 }}>
      <Svg width={9} height={22} viewBox="0 0 10 24">
        <Path d="M8 2 2 22" fill="none" stroke={color} strokeWidth={2.6} />
      </Svg>
    </View>
  );
}
