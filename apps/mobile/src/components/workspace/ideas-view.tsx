import { useState } from 'react';
import { ActionSheetIOS, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TIGHT_SCALE } from '@/components/text';
import { isContentIdea, removeBoardObjects, withBoardChange } from '@trippilot/core/board-model';
import { datesForTrip, makePlan } from '@trippilot/core/itinerary-model';
import { BottomSheet } from '../sheet';
import { Icon } from '../icons';
import { Accent, Button, Chip, Display, Raised, SheetHeader, Sticker } from '../ui';
import { planKind } from './plan-row';
import { formatDay } from '@/lib/format';
import { useSharedInbox, type SharedLink } from '@/lib/share-inbox';
import { PROVIDERS } from '../shared-preview';
import { gutter, kindColors, palette, radii, strokes, typefaces } from '@/lib/design';
import type { PlanItem, Trip } from '@/lib/trips';
import { haptics } from '@/lib/haptics';

export type Idea = { id: string; type: string; title?: string; image?: string; url?: string; notes?: string; location?: string; category?: string; provider?: string; source?: string; placeId?: string; latitude?: number; longitude?: number; libraryIdeaId?: string; sharedAt?: string };

export const providerLabel = (idea: { provider?: string; url?: string }) => PROVIDERS[idea.provider || ''] || (() => { try { return new URL(idea.url || '').hostname.replace(/^www\./, ''); } catch { return ''; } })();

// How to send a video in from another app (the share extension / share screen).
const SHARE_STEPS = ['Spot a place in a video', 'Tap Share, then Elsewhere', 'Pick this trip and Save'];

// The idea filters: every kind a plan can be, by its color.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Food', label: 'Food', dot: kindColors.food },
  { key: 'Activity', label: 'See & do', dot: kindColors.see },
  { key: 'Stay', label: 'Stay', dot: kindColors.stay },
] as const;
const ideaCategory = (idea: Idea) => (['Food', 'Stay'].includes(idea.category || '') ? idea.category! : 'Activity');
export const ideaKind = (idea: Idea) => planKind({ kind: ideaCategory(idea) });

// The Ideas tab: "Ideas" and how many are on a day yet, new videos from the
// share inbox, kind filters, and the trip's ideas as a grid of covers. A
// cover shows its place on the map; "+ Day" puts it on the plan.
export function IdeasView({ trip, commit, onNotice, onNeedDates, onAddIdea, onPasteLink, onShowOnMap }: {
  trip: Trip; commit(trip: Trip): void; onNotice(message: string): void; onNeedDates(): void; onAddIdea(): void; onPasteLink(): void; onShowOnMap(ideaId: string): void;
}) {
  const { unassigned, addToTrip, dismiss } = useSharedInbox();
  const [scheduling, setScheduling] = useState<Idea | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const ideas = ((trip.boardItems as Idea[] | undefined) || []).filter(item => isContentIdea(item)).slice().reverse();
  const shown = filter === 'all' ? ideas : ideas.filter(idea => ideaCategory(idea) === filter);
  const planned = ideas.filter(idea => ideaScheduled(trip, idea)).length;
  const place = trip.stops?.[0]?.name || trip.name;

  const remove = (idea: Idea) => {
    const result = removeBoardObjects(trip.boardItems || [], trip.boardLinks || [], [idea.id]);
    commit(withBoardChange(trip, result) as Trip);
    onNotice('Removed from Ideas');
  };
  // Long-press a cover: open its video or remove it.
  const more = (idea: Idea) => {
    const options = [...(idea.url ? ['Open video'] : []), 'Remove from Ideas', 'Cancel'];
    const pick = (index: number) => { const choice = options[index]; if (choice === 'Open video') Linking.openURL(idea.url!); else if (choice === 'Remove from Ideas') remove(idea); };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: options.length - 2, title: idea.title }, pick);
    else Alert.alert(idea.title || 'Idea', undefined, options.map((text, index) => ({ text, style: text === 'Cancel' ? 'cancel' as const : text.startsWith('Remove') ? 'destructive' as const : 'default' as const, onPress: () => pick(index) })));
  };
  const addAll = async () => {
    setAdding(true);
    try { for (const link of unassigned) await addToTrip(link, trip); haptics.success(); onNotice(unassigned.length === 1 ? 'Added to Ideas' : `Added ${unassigned.length} to Ideas`); }
    catch (error) { onNotice((error as Error).message || 'Could not add these.'); }
    finally { setAdding(false); }
  };

  if (!ideas.length && !unassigned.length) return <IdeasEmpty place={place} onPasteLink={onPasteLink} onSearch={onAddIdea} />;

  return (
    <View style={styles.view}>
      <View>
        <Display size="title" accessibilityRole="header">Ideas</Display>
        <Text style={styles.subtitle}>{ideas.length ? `${ideas.length} ${ideas.length === 1 ? 'maybe' : 'maybes'} for ${place}${planned ? `, ${planned} already on a day` : ''}` : `Nothing saved for ${place} yet`}</Text>
      </View>

      {unassigned.length ? (
        <View style={styles.feed}>
          <Raised offset={4} radius={radii.lg}>
            <View style={styles.feedCard}>
              <View style={styles.flex}>
                <Display size="card">{`${unassigned.length} new from your feed`}</Display>
                <Text style={styles.feedText}>Saved from other apps, not on a trip yet</Text>
              </View>
              <Button label={adding ? 'Adding…' : unassigned.length === 1 ? 'Add it' : 'Add all'} size="sm" disabled={adding} onPress={addAll} />
            </View>
          </Raised>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.feedStrip} contentContainerStyle={styles.feedStripContent}>
            {unassigned.map(link => <FeedCard key={link.id} link={link} onAdd={async () => { try { await addToTrip(link, trip); haptics.success(); onNotice('Added to Ideas'); } catch (error) { onNotice((error as Error).message); } }} onDismiss={() => dismiss(link)} />)}
          </ScrollView>
        </View>
      ) : null}

      {ideas.length ? (
        <>
          <View style={styles.filters}>
            {FILTERS.map(entry => <Chip key={entry.key} size="sm" label={entry.label} dot={'dot' in entry ? entry.dot : undefined} selected={filter === entry.key} onPress={() => setFilter(entry.key)} />)}
          </View>
          <View style={styles.grid}>
            {shown.map(idea => (
              <IdeaCover key={idea.id} idea={idea} scheduled={ideaScheduled(trip, idea)}
                onOpen={() => { if (Number.isFinite(idea.latitude)) onShowOnMap(idea.id); else if (idea.url) Linking.openURL(idea.url); else more(idea); }}
                onMore={() => more(idea)}
                onSchedule={() => { if (!datesForTrip(trip).length) { onNeedDates(); return; } setScheduling(idea); }} />
            ))}
          </View>
          {!shown.length ? <Text style={styles.none}>No ideas of this kind yet.</Text> : null}
          <Button label="Add an idea" icon="plus" variant="outline" onPress={onAddIdea} />
        </>
      ) : null}

      <DayPicker trip={trip} idea={scheduling} onClose={() => setScheduling(null)} onPick={day => {
        try { commit(ideaOnDay(trip, scheduling!, day)); onNotice(`Added to ${formatDay(day)}`); return null; }
        catch (error) { return (error as Error).message; }
      }} />
    </View>
  );
}

// No ideas yet: two tilted cards and "SAVE ME", how sharing works, and the
// two other ways in.
function IdeasEmpty({ place, onPasteLink, onSearch }: { place: string; onPasteLink(): void; onSearch(): void }) {
  return (
    <View style={styles.empty}>
      <View accessibilityElementsHidden style={styles.emptyArt}>
        <View style={[styles.emptyCard, { backgroundColor: palette.yellow, left: '18%', transform: [{ rotate: '-10deg' }] }]} />
        <View style={[styles.emptyCard, { backgroundColor: palette.mint, left: '50%', transform: [{ rotate: '9deg' }] }]} />
        <Sticker tone="ink" tilt={-8} style={styles.emptySticker}>SAVE ME ✦</Sticker>
      </View>
      <View style={styles.emptyCopy}>
        <Display size="title" style={styles.center} accessibilityRole="header">Nothing here <Accent size={46}>yet.</Accent></Display>
        <Text style={styles.emptyText}>{`Your ${place} wish list fills up from the videos you share.`}</Text>
      </View>
      <View style={styles.steps}>
        {SHARE_STEPS.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepNumber}><Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.stepNumberText}>{index + 1}</Text></View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
      <View style={styles.emptyActions}>
        <Button label="Paste a link" variant="accent" onPress={onPasteLink} style={styles.flex} />
        <Button label="Search a place" variant="outline" onPress={onSearch} style={styles.flex} />
      </View>
    </View>
  );
}

// Whether this idea is already a plan on some day.
export const ideaScheduled = (trip: Trip, idea: Idea) => (trip.items || []).some(plan => plan.ideaId === (idea.libraryIdeaId || idea.id));
const scheduledDay = (trip: Trip, idea: Idea) => (trip.items || []).find(plan => plan.ideaId === (idea.libraryIdeaId || idea.id))?.day;

// The trip with this idea added to a day as a plan, keeping its place, link
// and notes. Throws a message to show when it can't be added.
export function ideaOnDay(trip: Trip, idea: Idea, day: string): Trip {
  const ideaId = idea.libraryIdeaId || idea.id;
  if ((trip.items || []).some(plan => plan.ideaId === ideaId && plan.day === day)) throw new Error('This idea is already on that day.');
  const plan = makePlan(trip, { name: idea.title || 'Saved idea', day, kind: ['Food', 'Stay', 'Activity'].includes(idea.category || '') ? idea.category : 'Activity', address: idea.location || '', notes: [idea.notes, idea.url].filter(Boolean).join('\n\n'), ...(idea.placeId ? { placeId: idea.placeId, latitude: idea.latitude, longitude: idea.longitude } : {}) } as never) as PlanItem;
  return { ...trip, items: [...(trip.items || []), { ...plan, ideaId }] };
}

// A cover image, or a dark tile with a frame mark when there's none.
export function Cover({ image, style, badge }: { image?: string; style?: object; badge?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.cover, style]}>
      {image && !failed ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
        : <Icon name="frame" size={22} color="rgba(255,255,255,0.7)" strokeWidth={2} />}
      {badge ? <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.badge}>{badge}</Text> : null}
    </View>
  );
}

function IdeaCover({ idea, scheduled, onOpen, onMore, onSchedule }: { idea: Idea; scheduled: boolean; onOpen(): void; onMore(): void; onSchedule(): void }) {
  const source = providerLabel(idea);
  const kind = ideaKind(idea);
  return (
    <View style={styles.cell}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${idea.title || 'Saved idea'}${source ? `, from ${source}` : ''}`}
        accessibilityHint="Shows it on the map. Long press for more" onPress={onOpen} onLongPress={onMore}
        accessibilityActions={[{ name: 'longpress', label: 'More options' }]} onAccessibilityAction={onMore}
        style={({ pressed }) => pressed && styles.coverPressed}>
        <Cover image={idea.image} badge={PROVIDERS[idea.provider || ''] || (idea.url ? source : undefined)} style={styles.gridCover} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={scheduled ? 'On a day. Add to another day' : 'Add to a day'} onPress={onSchedule} hitSlop={6}
        style={({ pressed }) => [styles.dayButton, scheduled && styles.dayButtonOn, pressed && styles.coverPressed]}>
        <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.dayButtonText}>{scheduled ? '✓ Day' : '+ Day'}</Text>
      </Pressable>
      <View style={styles.cellTitle}>
        <View accessibilityElementsHidden style={[styles.dot, { backgroundColor: kind.color }]} />
        <Text style={styles.cellText} numberOfLines={2}>{idea.title || 'Saved idea'}</Text>
      </View>
    </View>
  );
}

// A video in the share inbox: its cover, add it to this trip or dismiss it.
function FeedCard({ link, onAdd, onDismiss }: { link: SharedLink; onAdd(): void; onDismiss(): void }) {
  const caption = (link.title || '').split('\n').find(line => line.trim()) || link.place?.name || providerLabel(link) || 'Shared link';
  return (
    <View style={styles.feedItem}>
      <Cover image={link.image} badge={PROVIDERS[link.provider || '']} style={styles.feedCover} />
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={8} style={styles.dismiss}>
        <Icon name="close" size={12} color={palette.ink} strokeWidth={2.6} />
      </Pressable>
      <Text style={styles.feedCaption} numberOfLines={2}>{caption}</Text>
      <Button label="+ Add" size="sm" variant="outline" onPress={onAdd} accessibilityLabel={`Add ${caption} to this trip`} />
    </View>
  );
}

// "Add to which day?": the trip's days as chips. A day that already has this
// idea is yellow.
export function DayPicker({ trip, idea, onClose, onPick }: { trip: Trip; idea: Idea | null; onClose(): void; onPick(day: string): string | null }) {
  const [error, setError] = useState('');
  return (
    <BottomSheet visible={Boolean(idea)} onClose={() => { setError(''); onClose(); }}
      header={close => <SheetHeader title={<>Add to <Accent>which day?</Accent></>} onClose={close}>
        {idea?.title ? <Text style={styles.sheetSub} numberOfLines={1}>{idea.title}</Text> : null}
      </SheetHeader>}>
      {close => (
        <View style={styles.pickerBody}>
          {idea ? <DayChips trip={trip} idea={idea} onPick={day => { const message = onPick(day); if (message) setError(message); else { haptics.success(); setError(''); close(); } }} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}
    </BottomSheet>
  );
}

// The day chips shared by the day picker and the map's place card.
export function DayChips({ trip, idea, onPick, inset = gutter }: { trip: Trip; idea: Idea; onPick(day: string): void; inset?: number }) {
  const days = datesForTrip(trip) as string[];
  const on = scheduledDay(trip, idea);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingHorizontal: inset }]} keyboardShouldPersistTaps="handled">
      {days.map(day => (
        <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}${day === on ? ', already on this day' : ''}`}
          onPress={() => onPick(day)} style={({ pressed }) => [styles.dayChip, day === on && styles.dayChipOn, pressed && styles.coverPressed]}>
          <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.dayChipDow}>{formatDay(day, { weekday: 'short' }).toUpperCase()}</Text>
          <Text maxFontSizeMultiplier={TIGHT_SCALE} style={styles.dayChipDate}>{Number(day.slice(-2))}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  view: { gap: 16 },
  subtitle: { marginTop: 2, fontFamily: typefaces.serif, fontSize: 21, lineHeight: 26, color: palette.blue },
  feed: { gap: 12 },
  feedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 16, paddingRight: 10, borderRadius: radii.lg, borderCurve: 'continuous', borderWidth: strokes.heavy, borderColor: palette.ink, backgroundColor: palette.pink },
  feedText: { fontFamily: typefaces.semibold, fontSize: 13, color: palette.ink },
  feedStrip: { marginHorizontal: -gutter },
  feedStripContent: { paddingHorizontal: gutter, gap: 12 },
  feedItem: { width: 120, gap: 6 },
  feedCover: { height: 160 },
  feedCaption: { fontFamily: typefaces.bold, fontSize: 12, lineHeight: 16, color: palette.ink },
  dismiss: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Two per row.
  cell: { flexBasis: '47%', flexGrow: 1, maxWidth: '50%', gap: 6 },
  cover: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, borderCurve: 'continuous', backgroundColor: '#2A2140' },
  gridCover: { height: 168 },
  coverPressed: { opacity: 0.85 },
  badge: { position: 'absolute', top: 8, left: 8, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill, backgroundColor: palette.paper, fontFamily: typefaces.bold, fontSize: 10, color: palette.ink },
  dayButton: { position: 'absolute', top: 128, right: 8, height: 30, paddingHorizontal: 10, justifyContent: 'center', borderRadius: radii.pill, borderWidth: strokes.thin, borderColor: palette.ink, backgroundColor: palette.paper },
  dayButtonOn: { backgroundColor: palette.yellow },
  dayButtonText: { fontFamily: typefaces.heavy, fontSize: 12, color: palette.ink },
  cellTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  dot: { width: 9, height: 9, marginTop: 4, borderRadius: 3 },
  cellText: { flex: 1, fontFamily: typefaces.bold, fontSize: 14, lineHeight: 17, color: palette.ink },
  none: { fontFamily: typefaces.semibold, fontSize: 14, color: palette.muted },
  empty: { gap: 18, paddingTop: 4 },
  emptyArt: { height: 190 },
  emptyCard: { position: 'absolute', top: 14, width: 96, height: 156, borderRadius: radii.md, borderCurve: 'continuous', borderWidth: strokes.heavy, borderColor: palette.ink },
  emptySticker: { position: 'absolute', top: 120, left: '62%' },
  emptyCopy: { alignItems: 'center', gap: 10 },
  emptyText: { maxWidth: 300, textAlign: 'center', fontFamily: typefaces.semibold, fontSize: 15, lineHeight: 21, color: palette.muted },
  steps: { gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radii.lg, borderCurve: 'continuous', borderWidth: strokes.thin, borderColor: palette.line, backgroundColor: palette.paper },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily: typefaces.heavy, fontSize: 13, color: palette.paper },
  stepText: { flex: 1, fontFamily: typefaces.semibold, fontSize: 15, lineHeight: 20, color: palette.ink },
  emptyActions: { flexDirection: 'row', gap: 10 },
  sheetSub: { fontFamily: typefaces.semibold, fontSize: 14, color: palette.muted },
  pickerBody: { paddingBottom: 16, gap: 10 },
  chips: { gap: 8 },
  dayChip: { width: 58, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous', borderWidth: strokes.thin, borderColor: palette.ink, backgroundColor: palette.paper },
  dayChipOn: { backgroundColor: palette.yellow, borderWidth: strokes.mid },
  dayChipDow: { fontFamily: typefaces.bold, fontSize: 11, color: palette.ink },
  dayChipDate: { fontFamily: typefaces.display, fontSize: 20, lineHeight: 24, color: palette.ink },
  error: { paddingHorizontal: gutter, fontFamily: typefaces.semibold, fontSize: 13, color: palette.danger },
});
