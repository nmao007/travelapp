import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { UnsortedIdeas } from '@/components/saved-videos';
import { colors, fonts, sq } from '@/lib/theme';

// Unsorted ideas: videos and links shared without a trip, opened from home.
export default function UnsortedScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Icon name="back" size={24} color="#222222" />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} accessibilityRole="header">Unsorted ideas</Text>
          <Text style={styles.subtitle}>Add each to a trip, or start a new one</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}>
        <UnsortedIdeas />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  // The trip workspace's masthead: back button, then the title.
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
  back: { width: 44, height: 44, marginLeft: -8, alignItems: 'center', justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous' },
  pressed: { backgroundColor: colors.pressed },
  titleWrap: { flex: 1, marginLeft: 12 },
  title: { marginTop: 2, fontFamily: fonts.bold, fontSize: 23, lineHeight: 26.45, letterSpacing: -0.7, color: colors.ink },
  subtitle: { marginTop: 3, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  body: { paddingHorizontal: 16, paddingTop: 12 },
});
