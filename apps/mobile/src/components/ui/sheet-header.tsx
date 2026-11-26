import { StyleSheet, View } from 'react-native';
import { gutter } from '@/lib/design';
import { IconButton } from './buttons';
import { Display } from './type';

// A sheet's title row: "Add to *Lisbon*" with the soft close button.
export function SheetHeader({ title, onClose, children }: { title: React.ReactNode; onClose(): void; children?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <Display size="sheet" accessibilityRole="header" style={styles.title}>{title}</Display>
        <IconButton icon="close" label="Close" variant="soft" onPress={onClose} iconSize={18} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 8, paddingHorizontal: gutter, paddingBottom: 12, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1 },
});
