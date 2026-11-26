import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Icon } from '../icons';
import type { SymbolName } from '../icon-symbols';
import { Dropdown } from '../popover';
import { BottomSheet, afterSheetCloses } from '../sheet';
import { Accent, SheetHeader } from '../ui';
import { formatDay } from '@/lib/format';
import { gutter, palette, radii, strokes, typefaces } from '@/lib/design';

export type AddKind = 'place' | 'link' | 'flight' | 'note';

const TILES: { kind: AddKind; label: string; detail: string; icon: SymbolName; bg: string; fg: string; iconColor: string }[] = [
  { kind: 'place', label: 'A place', detail: 'Search or pick an idea', icon: 'pin', bg: palette.orange, fg: palette.ink, iconColor: palette.ink },
  { kind: 'link', label: 'A link', detail: 'TikTok, Reels, YouTube', icon: 'link', bg: palette.pink, fg: palette.ink, iconColor: palette.ink },
  { kind: 'flight', label: 'A flight', detail: 'By flight number', icon: 'plane', bg: palette.violet, fg: palette.paper, iconColor: palette.yellow },
  { kind: 'note', label: 'A note', detail: 'Your own plan or idea', icon: 'edit', bg: palette.yellow, fg: palette.ink, iconColor: palette.ink },
];

// The tab bar's +: "Add to *Lisbon*" for the chosen day, as four tiles. Each
// closes this sheet, then opens its own (iOS can't show two at once).
export function AddMenu({ visible, tripName, day, days, onDay, onClose, onPick }: {
  visible: boolean; tripName: string; day: string | null; days: string[]; onDay(day: string): void; onClose(): void; onPick(kind: AddKind): void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}
      header={close => <SheetHeader title={<>Add to <Accent>{tripName}</Accent></>} onClose={close}>
        {days.length && day ? (
          <Dropdown value={day} label="Day to add to" options={days.map(value => ({ value, label: `For ${formatDay(value, { weekday: 'short', month: 'short', day: 'numeric' })}` }))}
            onChange={onDay} triggerStyle={styles.day} valueStyle={styles.dayText} gap={6} />
        ) : <Text style={styles.noDates}>No dates yet: places, flights and notes ask for them first.</Text>}
      </SheetHeader>}>
      {close => (
        <ScrollView style={styles.body} contentContainerStyle={styles.content}>
          <View style={styles.grid}>
            {TILES.map(tile => (
              <Pressable key={tile.kind} accessibilityRole="button" accessibilityLabel={`${tile.label}. ${tile.detail}`}
                onPress={() => { close(); afterSheetCloses(() => onPick(tile.kind)); }}
                style={({ pressed }) => [styles.tile, { backgroundColor: tile.bg }, pressed && styles.tilePressed]}>
                <Icon name={tile.icon} size={30} color={tile.iconColor} strokeWidth={2.2} />
                <View>
                  <Text style={[styles.tileLabel, { color: tile.fg }]}>{tile.label}</Text>
                  <Text style={[styles.tileDetail, { color: tile.fg }]}>{tile.detail}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          <View style={styles.hint}>
            <Icon name="external" size={22} color={palette.violet} strokeWidth={2.2} />
            <Text style={styles.hintText}>Faster: in TikTok or Instagram tap <Text style={styles.hintBold}>Share → Elsewhere</Text></Text>
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  day: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 14, borderWidth: strokes.thin, borderColor: palette.ink, backgroundColor: palette.paper },
  dayText: { fontFamily: typefaces.bold, fontSize: 14, color: palette.ink },
  noDates: { fontFamily: typefaces.semibold, fontSize: 13, lineHeight: 18, color: palette.muted },
  body: { flexGrow: 0 },
  content: { paddingHorizontal: gutter, paddingBottom: 16, gap: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Two per row: (100% − 12pt gap) / 2.
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 132, padding: 14, justifyContent: 'space-between', gap: 12, borderRadius: 24, borderCurve: 'continuous', borderWidth: strokes.heavy, borderColor: palette.ink },
  tilePressed: { transform: [{ scale: 0.97 }] },
  tileLabel: { fontFamily: typefaces.display, fontSize: 20, lineHeight: 24 },
  tileDetail: { fontFamily: typefaces.semibold, fontSize: 12, lineHeight: 16 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.md, borderWidth: strokes.thin, borderColor: palette.line, backgroundColor: palette.paper },
  hintText: { flex: 1, fontFamily: typefaces.semibold, fontSize: 13, lineHeight: 18, color: palette.ink },
  hintBold: { fontFamily: typefaces.heavy },
});
