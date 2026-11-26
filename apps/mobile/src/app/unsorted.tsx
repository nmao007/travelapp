import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UnsortedIdeas } from '@/components/saved-videos';
import { PageHeader } from '@/components/ui';
import { gutter, palette } from '@/lib/design';

// Unsorted ideas: videos and links shared without a trip, opened from home.
export default function UnsortedScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <PageHeader title="Fresh from your feed" subtitle="Videos you saved without a trip. Add each to one, or start a new trip." />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}>
        <UnsortedIdeas />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  body: { paddingHorizontal: gutter, paddingTop: 8 },
});
