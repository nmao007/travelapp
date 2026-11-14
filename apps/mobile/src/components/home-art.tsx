import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import { easeOut } from '@/lib/theme';

// The home illustration (site/dist/index.html .home-art): viewBox 320×250, drawn
// 102pt wide on phones. Each piece rests at a small tilt around its own center
// and eases in like the site's welcome-* keyframes in ui.css.
const WIDTH = 102, SCALE = WIDTH / 320, HEIGHT = 250 * SCALE;
const ease = Easing.bezier(...easeOut);

type Motion = { center: [number, number]; rotate: number; from: { x: number; y: number; rotate: number; scale?: number }; duration: number; delay: number };

function Piece({ motion, children }: { motion: Motion; children: ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) progress.value = withDelay(motion.delay, withTiming(1, { duration: motion.duration, easing: ease }));
  }, [progress, reduced, motion]);
  const style = useAnimatedStyle(() => {
    const t = progress.value, { from } = motion;
    return {
      opacity: t,
      transform: [
        { translateX: from.x * (1 - t) * SCALE },
        { translateY: from.y * (1 - t) * SCALE },
        { rotate: `${from.rotate + (motion.rotate - from.rotate) * t}deg` },
        { scale: (from.scale ?? 1) + (1 - (from.scale ?? 1)) * t },
      ],
    };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [motion.center[0] * SCALE, motion.center[1] * SCALE, 0] }, style]}>
      <Svg width={WIDTH} height={HEIGHT} viewBox="0 0 320 250" fill="none">{children}</Svg>
    </Animated.View>
  );
}

const postcard: Motion = { center: [179.5, 105.5], rotate: 8, from: { x: 8, y: 12, rotate: 2 }, duration: 420, delay: 0 };
const passport: Motion = { center: [112.5, 142.5], rotate: -9, from: { x: -8, y: 12, rotate: -15 }, duration: 440, delay: 40 };
const ticket: Motion = { center: [224.5, 170], rotate: 7, from: { x: 16, y: 0, rotate: 12 }, duration: 420, delay: 100 };
const plane: Motion = { center: [235.5, 50], rotate: 0, from: { x: -20, y: 14, rotate: 0, scale: 0.8 }, duration: 520, delay: 80 };

export function HomeArt() {
  return (
    <View style={styles.art} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <Piece motion={postcard}>
        <G>
          <Path d="M79 42Q79 28 95 28H264Q280 28 280 44V167Q280 183 264 183H95Q79 183 79 167Z" fill="#F0F0FC" />
          <Path d="M91 91V46Q91 40 98 40H261Q268 40 268 47V91Z" fill="#E5E4F8" />
          <Path d="M91 169V123L133 81L179 127L217 94L268 145V169Q268 171 261 171H98Q91 171 91 169Z" fill="#B5B5E5" />
          <Path d="M91 169V151L152 105L215 171H98Q91 171 91 169Z" fill="#787DB5" />
          <Path d="M224 60C224 51 231 47 238 48C247 49 251 55 249 63C247 71 241 75 233 73C227 72 223 67 224 60Z" fill="#FFAE77" />
        </G>
      </Piece>
      <Piece motion={passport}>
        <G>
          <Path d="M48 74Q48 55 67 55H158Q177 55 177 74V211Q177 230 158 230H67Q48 230 48 211Z" fill="#4260CF" />
          <Path d="M58 58V227" stroke="#2E47A9" strokeWidth={2} />
          <Path d="M80 85H145M80 91H122" stroke="#A7B7F4" strokeWidth={3} strokeLinecap="round" />
          <Path d="M87 143C87 126 98 115 114 115C131 115 142 127 142 143C142 160 130 170 114 170C98 170 87 159 87 143Z" stroke="#FFF2DA" strokeWidth={2.5} />
          <Path d="M87 143H142M114 115C100 129 100 156 114 170C128 156 128 129 114 115Z" stroke="#FFF2DA" strokeWidth={2.5} />
          <Path d="M98 197H130M104 203H124" stroke="#A7B7F4" strokeWidth={3} strokeLinecap="round" />
        </G>
      </Piece>
      <Piece motion={ticket}>
        <G>
          <Path d="M154 142Q154 131 165 131H284Q295 131 295 142V161C283 161 283 179 295 179V198Q295 209 284 209H165Q154 209 154 198V179C166 179 166 161 154 161Z" fill="#F57842" />
          <Path d="M253 139V201" stroke="#D75C2A" strokeWidth={1.5} strokeDasharray="3 4" />
          <Path d="M171 149H205M171 156H194" stroke="#FFD8BC" strokeWidth={3} strokeLinecap="round" />
          <Path d="M172 190V182M177 190V177M183 190V180M189 190V176M195 190V181M200 190V178M206 190V176M212 190V182M218 190V177M224 190V180M230 190V176" stroke="#A63F19" strokeWidth={2} />
          <Path d="M270 152V184M266 178L270 184L274 178" stroke="#FFF3E8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      </Piece>
      <Piece motion={plane}>
        <G>
          <Path d="M201 48L270 16L247 84L233 59L201 48Z" fill="#F57842" />
          <Path d="M233 59L270 16L226 52Z" fill="#CF4E26" />
          <Path d="M233 59L231 76L241 70Z" fill="#E06536" />
        </G>
      </Piece>
      <Svg width={WIDTH} height={HEIGHT} viewBox="0 0 320 250" fill="none" style={StyleSheet.absoluteFill}>
        <Path d="M32 38V52M25 45H39M293 104V114M288 109H298" stroke="#B7B7D7" strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // .home-art on phones: 102×80, margin-right -4px.
  art: { width: WIDTH, height: HEIGHT, marginRight: -4 },
});
