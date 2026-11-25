import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tripStops, stopSchedule } from '@trippilot/core/trip-model';
import { Art, Icon } from '../icons';
import { Dropdown, Popover, useAnchor } from '../popover';
import type { SymbolName } from '../icon-symbols';
import { formatDay, rangeLabel } from '@/lib/format';
import { colors, fonts, sq } from '@/lib/theme';
import type { Trip } from '@/lib/trips';

// stopRangeLabel() in app.js.
const dateLabel = (value: string) => formatDay(value, { month: 'short', day: 'numeric' });
export function stopRangeLabel(entry: { start: string | null; end: string | null }) {
  if (!entry?.start || !entry.end) return 'Set dates';
  return entry.start === entry.end ? dateLabel(entry.start) : entry.start.slice(0, 7) === entry.end.slice(0, 7) ? `${dateLabel(entry.start)} – ${Number(entry.end.slice(-2))}` : `${dateLabel(entry.start)} – ${dateLabel(entry.end)}`;
}

function RoundButton({ icon, label, onPress, size = 18, color = '#333333', style, iconStyle }: { icon: SymbolName; label: string; onPress(): void; size?: number; color?: string; style?: object; iconStyle?: object }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.round, style, pressed && styles.pressed]}>
      {({ pressed }) => <View style={[pressed && styles.iconPressed, iconStyle]}><Icon name={icon} size={size} color={color} /></View>}
    </Pressable>
  );
}

// onPress returns true to keep the menu open (the two-step "Delete trip").
export type MenuAction = { key: string; label: string; icon?: SymbolName; danger?: boolean; onPress(): boolean | void };

// #trip-menu: a right-aligned list under the ⋯ button.
function TripMenu({ actions, onOpen }: { actions: MenuAction[]; onOpen?(): void }) {
  const { ref, anchor, open, close } = useAnchor();
  return (
    <View ref={ref} collapsable={false}>
      <RoundButton icon="more" label="Trip options" onPress={() => { onOpen?.(); open(); }} />
      <Popover anchor={anchor} align="right" width={248} onClose={close} style={styles.menu}>
        {actions.map(action => (
          <Pressable key={action.key} accessibilityRole="menuitem" onPress={() => { if (!action.onPress()) close(); }} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
            {action.icon ? <Icon name={action.icon} size={19} color={colors.muted} /> : null}
            <Text style={[styles.menuText, action.danger && styles.danger]}>{action.label}</Text>
          </Pressable>
        ))}
      </Popover>
    </View>
  );
}

type HeaderProps = {
  trip: Trip; mode: 'list' | 'calendar' | 'day'; day: string; stopFilter: string | null; days: string[]; dayContext: string;
  onBack(): void; onAdd?(): void; addLabel?: string; showToggle?: boolean; onToggleMode(): void; onStop(placeId: string): void; onDay(day: string): void; onRename(): void; menu: MenuAction[]; onMenuOpen?(): void; renaming: boolean; onRenameDone(value: string | null): void;
};

// The phone masthead: trip title or day picker, add (+) and ⋯, then the stop
// picker and calendar switch while viewing the whole trip.
export function WorkspaceHeader({ trip, mode, day, stopFilter, days, dayContext, onBack, onAdd, addLabel = 'Add a plan', showToggle = true, onToggleMode, onStop, onDay, onRename, menu, onMenuOpen, renaming, onRenameDone }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const stops = tripStops(trip) as Trip['stops'];
  const entries = stopSchedule(trip) as { stop: Trip['stops'][number]; start: string | null; end: string | null }[];
  const range = trip.startDate && trip.endDate ? rangeLabel(trip.startDate, trip.endDate) : 'Dates not set';
  return (
    <View style={[styles.masthead, { paddingTop: insets.top }]}>
      <View style={styles.hero}>
        <RoundButton icon="back" label={mode === 'list' ? 'Back to trips' : mode === 'calendar' ? 'Back to plan' : 'Back to plan'} onPress={onBack} size={24} color="#222222" style={styles.back} />
        {mode === 'day' ? (
          <View style={styles.titleWrap}>
            <Dropdown value={day} label="Choose day" options={days.map(value => ({ value, label: formatDay(value) }))} onChange={onDay}
              gap={4} triggerStyle={styles.dayTrigger} valueStyle={styles.dayValue} chevronColor={colors.ink} />
            <Text style={[styles.subtitle, styles.dayContext]} numberOfLines={1}>{dayContext}</Text>
          </View>
        ) : (
          <View style={styles.titleWrap}>
            {renaming ? <TitleInput initial={trip.title?.trim() || stops.map(stop => stop.name).join(' → ')} onDone={onRenameDone} /> : <Pressable accessibilityRole="button" accessibilityLabel="Edit trip title" onPress={onRename} style={styles.titleButton}>
              <View style={styles.titleRow}>
                {trip.title?.trim() ? <Text style={styles.title} numberOfLines={2}>{trip.title.trim()}</Text> : stops.map((stop, index) => (
                  <Fragment key={stop.placeId}>
                    {index ? <View style={styles.titleGap} /> : null}
                    <Text style={styles.title}>{stop.name}</Text>
                  </Fragment>
                ))}
              </View>
            </Pressable>}
            {mode === 'list' ? <Text style={styles.subtitle}>{range}</Text> : null}
          </View>
        )}
        {onAdd ? <RoundButton icon="plus" label={addLabel} onPress={onAdd} size={23} color={colors.white} style={styles.add} /> : null}
        <TripMenu actions={menu} onOpen={onMenuOpen} />
      </View>
      {mode !== 'day' ? (
        <View style={styles.routeBar}>
          <Dropdown value={stopFilter || entries[0]?.stop.placeId || ''} label="Choose destination" disabled={entries.length < 2} fullWidth
            options={entries.map(entry => ({ value: entry.stop.placeId, label: `${entry.stop.name} · ${stopRangeLabel(entry)}` }))}
            onChange={onStop} triggerStyle={styles.stopTrigger} valueStyle={styles.stopValue} chevronColor="#555555" />
          {mode === 'list' && showToggle ? <RoundButton icon="calendar" label="Show calendar" onPress={onToggleMode} size={20} color="#555555" style={styles.toggle} /> : null}
        </View>
      ) : null}
    </View>
  );
}

// #trip-title-input: edit the title in place; Return or leaving the field saves.
function TitleInput({ initial, onDone }: { initial: string; onDone(value: string | null): void }) {
  const [value, setValue] = useState(initial);
  return (
    <TextInput style={[styles.title, styles.titleInput]} value={value} onChangeText={setValue} autoFocus selectTextOnFocus maxLength={160}
      returnKeyType="done" accessibilityLabel="Trip title" onSubmitEditing={() => onDone(value)} onEndEditing={() => onDone(value)} />
  );
}

const tabs: { key: string; label: string; art: string }[] = [
  { key: 'plan', label: 'Plan', art: 'list' },
  { key: 'travel', label: 'Travel', art: 'plane' },
  { key: 'explore', label: 'Explore', art: 'map' },
  { key: 'ideas', label: 'Ideas', art: 'ideas' },
];

// .workspace-nav: the phone tab bar. Travel arrives in a later milestone.
export function WorkspaceNav({ active = 'plan', onSelect }: { active?: string; onSelect(key: string): void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { height: 66 + insets.bottom, paddingBottom: insets.bottom }]} accessibilityRole="tablist">
      {tabs.map(tab => {
        const selected = tab.key === active;
        return (
          <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onSelect(tab.key)} style={styles.navButton}>
            <View style={{ opacity: selected ? 1 : 0.6 }}><Art name={tab.art} size={tab.key === 'ideas' ? 30 : 28} /></View>
            <Text style={[styles.navLabel, { color: selected ? colors.action : '#626262' }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.pressed },
  iconPressed: { transform: [{ scale: 0.9 }] },
  masthead: { paddingHorizontal: 16, backgroundColor: colors.white },
  hero: { height: 56, flexDirection: 'row', alignItems: 'flex-start' },
  round: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  back: { marginLeft: -8 },
  titleWrap: { flex: 1, marginLeft: 12, marginRight: 8 },
  titleButton: { alignSelf: 'flex-start', borderRadius: sq(22), borderCurve: 'continuous' },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 2 },
  // The site draws an 18pt arrow between stop names in the header's white text color.
  titleGap: { width: 18 },
  titleInput: { paddingVertical: 0, minHeight: 30, borderBottomWidth: 1, borderBottomColor: colors.accent },
  title: { fontFamily: fonts.bold, fontSize: 23, lineHeight: 26.45, letterSpacing: -0.7, color: colors.ink, marginTop: 2 },
  subtitle: { marginTop: 3, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  dayTrigger: { justifyContent: 'space-between' },
  dayContext: { marginTop: 0 },
  dayValue: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.5, color: colors.ink },
  add: { backgroundColor: colors.accent, marginRight: 4 },
  // .trip-masthead ends 6pt below the route bar.
  routeBar: { height: 53, marginBottom: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#ececec' },
  stopTrigger: { justifyContent: 'space-between', backgroundColor: colors.white },
  stopValue: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 19, color: colors.muted },
  toggle: { backgroundColor: colors.soft },
  menu: { borderRadius: sq(20), borderCurve: 'continuous' },
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: sq(22), borderCurve: 'continuous' },
  menuText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 19.5, color: colors.ink },
  danger: { color: colors.danger },
  nav: { flexDirection: 'row', gap: 8, paddingTop: 2, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#eeeeee', backgroundColor: colors.white },
  navButton: { flex: 1, height: 62, paddingVertical: 4, gap: 3, alignItems: 'center', justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous' },
  navLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
});
