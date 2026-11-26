import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput, TIGHT_SCALE } from '@/components/text';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { tripStops, stopSchedule } from '@trippilot/core/trip-model';
import { Icon } from '../icons';
import { Dropdown, Popover, useAnchor } from '../popover';
import { Accent, Button, Display, IconButton, Segmented } from '../ui';
import { formatDay, rangeLabel } from '@/lib/format';
import { gutter, palette, radii, strokes, typefaces } from '@/lib/design';
import type { Trip } from '@/lib/trips';
import { haptics } from '@/lib/haptics';

// stopRangeLabel() in app.js.
const dateLabel = (value: string) => formatDay(value, { month: 'short', day: 'numeric' });
export function stopRangeLabel(entry: { start: string | null; end: string | null }) {
  if (!entry?.start || !entry.end) return 'Set dates';
  return entry.start === entry.end ? dateLabel(entry.start) : entry.start.slice(0, 7) === entry.end.slice(0, 7) ? `${dateLabel(entry.start)} – ${Number(entry.end.slice(-2))}` : `${dateLabel(entry.start)} – ${dateLabel(entry.end)}`;
}

export type MenuAction = { key: string; label: string; danger?: boolean; onPress(): void };

// ⋯: the trip menu. The button goes ink while the menu is open; the danger
// item ("Delete trip…") sits under a divider on a red tint.
function TripMenu({ actions }: { actions: MenuAction[] }) {
  const { ref, anchor, open, close } = useAnchor();
  const plain = actions.filter(action => !action.danger), danger = actions.filter(action => action.danger);
  return (
    <View ref={ref} collapsable={false}>
      <IconButton icon="more" label="Trip options" variant={anchor ? 'ink' : 'outline'} onPress={open} />
      <Popover anchor={anchor} align="right" width={260} onClose={close}>
        {plain.map(action => <MenuItem key={action.key} action={action} close={close} />)}
        {danger.length ? <View style={styles.divider} /> : null}
        {danger.map(action => <MenuItem key={action.key} action={action} close={close} />)}
      </Popover>
    </View>
  );
}

function MenuItem({ action, close }: { action: MenuAction; close(): void }) {
  return (
    <Pressable accessibilityRole="menuitem" onPress={() => { close(); action.onPress(); }}
      style={({ pressed }) => [styles.menuItem, action.danger && styles.menuDanger, pressed && styles.menuPressed]}>
      <Text style={[styles.menuText, action.danger && styles.menuDangerText]}>{action.label}</Text>
    </Pressable>
  );
}

type HeaderProps = {
  trip: Trip; tab: 'plan' | 'map' | 'ideas'; mode: 'list' | 'calendar' | 'day'; stopFilter: string | null;
  onBack(): void; onShowMode(mode: 'list' | 'day'): void; onStop(placeId: string): void; onDates(): void;
  onRename(): void; menu: MenuAction[]; renaming: boolean; onRenameDone(value: string | null): void;
};

// The trip masthead: back, the dates (or, with several stops, the stop) pill
// and ⋯; then the trip's name in display type, later stops in serif; then the
// Whole trip / Day switch on the Plan tab. In the day view the trip's name
// moves into the bar and the day chips take the title's place.
export function WorkspaceHeader({ trip, tab, mode, stopFilter, onBack, onShowMode, onStop, onDates, onRename, menu, renaming, onRenameDone }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const stops = tripStops(trip) as Trip['stops'];
  const entries = stopSchedule(trip) as { stop: Trip['stops'][number]; start: string | null; end: string | null }[];
  const range = trip.startDate && trip.endDate ? rangeLabel(trip.startDate, trip.endDate) : 'Set dates';
  const inDay = tab === 'plan' && mode === 'day';
  const custom = trip.title?.trim();
  return (
    <View style={[styles.masthead, { paddingTop: insets.top + 8 }]}>
      <View style={styles.bar}>
        <IconButton icon="back" label={inDay || mode === 'calendar' ? 'Back to plan' : 'Back to trips'} onPress={onBack} />
        {inDay ? <Display size="card" numberOfLines={1} style={styles.barTitle}>{custom || stops.map(stop => stop.name).join(' → ')}</Display> : <View style={styles.flex} />}
        {entries.length > 1 ? (
          <Dropdown value={stopFilter || entries[0].stop.placeId} label="Choose destination"
            options={entries.map(entry => ({ value: entry.stop.placeId, label: `${entry.stop.name} · ${stopRangeLabel(entry)}` }))}
            onChange={onStop} triggerStyle={styles.pill} valueStyle={styles.pillText} gap={6} />
        ) : <Button label={range} variant="outline" size="sm" onPress={onDates} accessibilityHint="Change the trip's dates" style={styles.pillButton} />}
        <TripMenu actions={menu} />
      </View>

      {!inDay ? (
        renaming ? <TitleInput initial={custom || stops.map(stop => stop.name).join(' → ')} onDone={onRenameDone} /> : (
          <Pressable accessibilityRole="button" accessibilityLabel={`${custom || stops.map(stop => stop.name).join(' to ')}. Rename trip`} onPress={onRename} style={styles.titleButton}>
            <Display size="title" accessibilityRole="header">
              {custom || stops[0].name}
              {!custom && stops.length > 1 ? <Accent size={34}>{` → ${stops.slice(1).map(stop => stop.name).join(' → ')}`}</Accent> : null}
            </Display>
          </Pressable>
        )
      ) : null}

      {tab === 'plan' ? (
        // In the month calendar neither side is chosen, so both switch views.
        <Segmented<'list' | 'day' | 'calendar'> label="Plan view" value={mode} onChange={next => { if (next !== 'calendar') onShowMode(next); }}
          options={[{ value: 'list', label: 'Whole trip' }, { value: 'day', label: 'Day' }]} />
      ) : null}

    </View>
  );
}

// Edit the title in place; Return or leaving the field saves.
function TitleInput({ initial, onDone }: { initial: string; onDone(value: string | null): void }) {
  const [value, setValue] = useState(initial);
  return (
    <TextInput style={styles.titleInput} value={value} onChangeText={setValue} autoFocus selectTextOnFocus maxLength={160}
      maxFontSizeMultiplier={TIGHT_SCALE} returnKeyType="done" accessibilityLabel="Trip title" onSubmitEditing={() => onDone(value)} onEndEditing={() => onDone(value)} />
  );
}

// The floating tab bar sits this far above the bottom edge; screens pad
// their content by tabBarSpace() so nothing ends up under it.
const BAR_HEIGHT = 68;
export const tabBarBottom = (insets: EdgeInsets) => (insets.bottom ? insets.bottom - 6 : 16);
export const tabBarSpace = (insets: EdgeInsets) => tabBarBottom(insets) + BAR_HEIGHT + 16;

const tabs = [
  { key: 'plan', label: 'Plan' },
  { key: 'map', label: 'Map' },
  { key: 'ideas', label: 'Ideas' },
] as const;

// The trip's tab bar: a floating ink pill with Plan · Map · Ideas and the
// pink + that adds anything (a place, a link, a flight, a note).
export function WorkspaceNav({ active = 'plan', onSelect, onAdd, addLabel }: { active?: string; onSelect(key: string): void; onAdd(): void; addLabel: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.navWrap, { bottom: tabBarBottom(insets) }]}>
      <View style={styles.nav} accessibilityRole="tablist">
        {tabs.map(tab => {
          const selected = tab.key === active;
          return (
            <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { if (!selected) haptics.select(); onSelect(tab.key); }}
              style={[styles.tab, selected && styles.tabOn]}>
              <Text maxFontSizeMultiplier={TIGHT_SCALE} style={[styles.tabText, selected && styles.tabTextOn]}>{tab.label}</Text>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" accessibilityLabel={addLabel} onPress={onAdd} style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
          <Icon name="plus" size={24} color={palette.ink} strokeWidth={3} />
        </Pressable>
      </View>
    </View>
  );
}

// "Delete Lisbon → Porto?": the ink card that confirms deleting a trip.
export function ConfirmDelete({ visible, title, detail, onCancel, onConfirm }: { visible: boolean; title: string; detail: string; onCancel(): void; onConfirm(): void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={styles.confirmBackdrop} onPress={onCancel} accessibilityLabel="Keep the trip" />
      <View accessibilityRole="alert" accessibilityViewIsModal style={[styles.confirm, { bottom: tabBarSpace(insets) - 4 }]}>
        <Display size="section" color={palette.paper}>{title}</Display>
        <Text style={styles.confirmText}>{detail}</Text>
        <View style={styles.confirmActions}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.keep, pressed && { opacity: 0.7 }]}>
            <Text style={styles.keepText}>Keep it</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onConfirm} style={({ pressed }) => [styles.delete, pressed && { opacity: 0.85 }]}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  masthead: { paddingHorizontal: gutter, paddingBottom: 14, gap: 14, backgroundColor: palette.cream },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTitle: { flex: 1, textAlign: 'center' },
  pill: { minHeight: 44, maxWidth: 220, paddingHorizontal: 16, borderWidth: strokes.thin, borderColor: palette.ink, backgroundColor: palette.paper },
  pillText: { flexShrink: 1, fontFamily: typefaces.bold, fontSize: 14, color: palette.ink },
  pillButton: { minHeight: 44 },
  titleButton: { alignSelf: 'flex-start' },
  titleInput: { fontFamily: typefaces.display, fontSize: 40, lineHeight: 46, letterSpacing: -1.6, color: palette.ink, paddingVertical: 0, borderBottomWidth: strokes.mid, borderBottomColor: palette.pink },
  divider: { height: 1.5, marginVertical: 4, marginHorizontal: 10, backgroundColor: palette.sand },
  menuItem: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 14 },
  menuPressed: { backgroundColor: palette.sand },
  menuText: { fontFamily: typefaces.semibold, fontSize: 16, color: palette.ink },
  menuDanger: { backgroundColor: '#FDECEB' },
  menuDangerText: { fontFamily: typefaces.bold, color: '#B13D38' },
  navWrap: { position: 'absolute', left: gutter, right: gutter, alignItems: 'center' },
  nav: {
    width: '100%', maxWidth: 420, height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: radii.pill, backgroundColor: palette.ink,
    shadowColor: palette.ink, shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 10,
  },
  tab: { flex: 1, height: 52, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: palette.yellow },
  tabText: { fontFamily: typefaces.semibold, fontSize: 15, color: palette.paper },
  tabTextOn: { fontFamily: typefaces.heavy, color: palette.ink },
  add: { width: 52, height: 52, borderRadius: 26, backgroundColor: palette.pink, alignItems: 'center', justifyContent: 'center' },
  addPressed: { transform: [{ scale: 0.92 }] },
  confirmBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(26, 16, 51, 0.35)' },
  confirm: { position: 'absolute', left: gutter, right: gutter, padding: 20, gap: 14, borderRadius: 26, borderCurve: 'continuous', backgroundColor: palette.ink },
  confirmText: { fontFamily: typefaces.medium, fontSize: 14, lineHeight: 20, color: '#DCD5EC' },
  confirmActions: { flexDirection: 'row', gap: 10 },
  keep: { flex: 1, minHeight: 48, borderRadius: radii.pill, borderWidth: strokes.mid, borderColor: palette.paper, alignItems: 'center', justifyContent: 'center' },
  keepText: { fontFamily: typefaces.bold, fontSize: 15, color: palette.paper },
  delete: { flex: 1, minHeight: 48, borderRadius: radii.pill, backgroundColor: '#FF8A84', alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontFamily: typefaces.heavy, fontSize: 15, color: palette.ink },
});
