import { useState } from 'react';
import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/sheet';
import { Accent, Body, Button, Card, Chip, DashedButton, Display, Eyebrow, IconButton, KindDot, LinkButton, Segmented, SheetHeader, Sticker } from '@/components/ui';
import { gutter, kindColors, palette } from '@/lib/design';

// Development only: every redesign building block on one screen, for checking
// them on small phones and at large text sizes. Open elsewhere://design.
export default function DesignPreview() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'trip' | 'day'>('trip');
  const [filter, setFilter] = useState('All');
  const [sheet, setSheet] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.row}>
        <IconButton icon="back" label="Back" onPress={() => {}} />
        <View style={styles.row}>
          <Button label="Nov 14 – 20" variant="outline" size="sm" onPress={() => {}} />
          <IconButton icon="more" label="Trip options" onPress={() => {}} />
        </View>
      </View>

      <View>
        <Display size="hero" accessibilityRole="header">Where to</Display>
        <Display size="hero"><Accent color={palette.pink} size={58}>next?</Accent></Display>
      </View>
      <Display size="title">Lisbon <Accent size={34}>→ Porto</Accent></Display>

      <Segmented<'trip' | 'day'> label="Plan view" value={view} onChange={setView} options={[{ value: 'trip', label: 'Whole trip' }, { value: 'day', label: 'Day' }]} />

      <Card tone="blue" outline="heavy" raised style={styles.upNext}>
        <Sticker>IN 19 DAYS ✦</Sticker>
        <Display size="title" color={palette.paper}>Lisbon</Display>
        <Body color={palette.paper}>Nov 14 – 20 · <Accent color={palette.paper}>then Porto</Accent></Body>
      </Card>

      <Card tone="yellow" outline="heavy" raised style={styles.pile}>
        <Eyebrow>FROM YOUR SOMEDAY PILE</Eyebrow>
        <Display size="sheet">14 spots saved in Italy. When are you <Accent color={palette.pinkText}>going?</Accent></Display>
        <View style={styles.wrap}>
          <Chip label="Spring" onPress={() => {}} />
          <Chip label="Summer" onPress={() => {}} />
          <Chip label="Pick dates" selected onPress={() => {}} />
        </View>
      </Card>

      <Eyebrow color={palette.muted}>BUTTONS</Eyebrow>
      <Button label="Start the trip ✦" variant="accent" size="lg" raised onPress={() => {}} />
      <Button label="Directions" icon="directions" variant="yellow" onPress={() => {}} />
      <View style={styles.wrap}>
        <Button label="Save" onPress={() => {}} />
        <Button label="Keep it" variant="outline" onPress={() => {}} />
        <Button label="Cancel" variant="soft" onPress={() => {}} />
      </View>
      <Button label="Delete account and data" variant="danger" onPress={() => {}} />
      <LinkButton label="Sort them →" onPress={() => {}} />
      <DashedButton label="+ Add to Saturday" onPress={() => {}} />
      <DashedButton label="Free day so far" trailing="+ Add" onPress={() => {}} />

      <Eyebrow color={palette.muted}>CHIPS</Eyebrow>
      <View style={styles.wrap}>
        {(['All', 'Food', 'See', 'Night', 'Stay'] as const).map(name => (
          <Chip key={name} size="sm" label={name} selected={filter === name} onPress={() => setFilter(name)}
            dot={{ All: undefined, Food: kindColors.food, See: kindColors.see, Night: kindColors.night, Stay: kindColors.stay }[name]} />
        ))}
      </View>
      <View style={styles.wrap}>
        <Chip look="yellow" label="✓ Manteigaria" selected onPress={() => {}} />
        <Chip label="Pastéis de Belém" onPress={() => {}} />
        <Chip label="Wed 18" disabled />
      </View>

      <Eyebrow color={palette.muted}>ROWS</Eyebrow>
      <Card style={styles.rows}>
        {[['09:45', kindColors.go, 'Land at LIS · TP 1351'], ['15:00', kindColors.stay, 'Check in, Memmo Alfama'], ['20:00', kindColors.food, 'Time Out Market']].map(([time, color, name]) => (
          <View key={name} style={styles.planRow}>
            <Body size="sm" weight="bold" color={palette.muted} style={styles.time}>{time}</Body>
            <KindDot color={color} />
            <Body style={styles.flex}>{name}</Body>
          </View>
        ))}
      </Card>

      <Button label="Open a sheet" variant="outline" onPress={() => setSheet(true)} />
      <BottomSheet visible={sheet} onClose={() => setSheet(false)} header={close => <SheetHeader title={<>Add to <Accent>Lisbon</Accent></>} onClose={close} />}>
        <View style={styles.sheetBody}>
          <Body color={palette.muted}>Sheets are cream with a drag handle and a soft close button.</Body>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.cream },
  content: { paddingHorizontal: gutter, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  upNext: { padding: 20, gap: 8 },
  pile: { padding: 18, gap: 12 },
  rows: { paddingHorizontal: 14, paddingVertical: 2 },
  planRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1.5, borderBottomColor: palette.sand },
  time: { width: 44 },
  flex: { flex: 1 },
  sheetBody: { paddingHorizontal: gutter, paddingBottom: 16 },
});
