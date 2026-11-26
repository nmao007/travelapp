import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gutter, palette, typefaces } from '@/lib/design';
import { IconButton } from './buttons';
import { Display } from './type';

// A page's top: the back button, then the title in display type and a line
// under it.
export function PageHeader({ title, subtitle }: { title: React.ReactNode; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View>
        <Display size="title" accessibilityRole="header">{title}</Display>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: gutter, paddingBottom: 8, gap: 14, backgroundColor: palette.cream },
  subtitle: { marginTop: 4, fontFamily: typefaces.semibold, fontSize: 14, lineHeight: 20, color: palette.muted },
});
