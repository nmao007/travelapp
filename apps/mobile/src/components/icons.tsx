import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { placeArt } from '@trippilot/core/place-art';
import { symbols, type SymbolName } from './icon-symbols';

// The site's line icons (.icon in app.css): stroke currentColor 1.8, round caps.
export const Icon = memo(function Icon({ name, size = 20, width, height, color, strokeWidth = 1.8, style }: { name: SymbolName; size?: number; width?: number; height?: number; color: string; strokeWidth?: number; style?: StyleProp<ViewStyle> }) {
  const symbol = symbols[name];
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${symbol.viewBox}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${symbol.body}</svg>`;
  return <SvgXml xml={xml} width={width ?? size} height={height ?? size} style={style} />;
});

// placeArt() illustrations shared with the site (packages/core/src/place-art.js).
export const Art = memo(function Art({ name, size }: { name: string; size: number }) {
  return <SvgXml xml={placeArt(name).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')} width={size} height={size} />;
});

export function GuideArt({ size = 38 }: { size?: number }) {
  return <Art name="guide" size={size} />;
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
