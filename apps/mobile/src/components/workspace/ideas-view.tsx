import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isContentIdea, removeBoardObjects, withBoardChange } from '@trippilot/core/board-model';
import { datesForTrip, makePlan } from '@trippilot/core/itinerary-model';
import { BottomSheet } from '../sheet';
import { Art, Icon } from '../icons';
import { formatDay } from '@/lib/format';
import { useSharedInbox, type SharedLink } from '@/lib/share-inbox';
import { PROVIDERS } from '../shared-preview';
import { colors, fonts, sq } from '@/lib/theme';
import type { PlanItem, Trip } from '@/lib/trips';

type Idea = { id: string; type: string; title?: string; image?: string; url?: string; notes?: string; location?: string; category?: string; provider?: string; source?: string; placeId?: string; latitude?: number; longitude?: number; libraryIdeaId?: string; sharedAt?: string };

const providerLabel = (idea: { provider?: string; url?: string }) => PROVIDERS[idea.provider || ''] || (() => { try { return new URL(idea.url || '').hostname.replace(/^www\./, ''); } catch { return ''; } })();

// The Ideas tab as cards: videos and links shared into the app, and the
// trip's other board ideas. Each can be added to a day of the plan.
export function IdeasView({ trip, commit, onNotice, onNeedDates, onPaste }: { trip: Trip; commit(trip: Trip): void; onNotice(message: string): void; onNeedDates(): void; onPaste(): void }) {
  const { unassigned, addToTrip, dismiss } = useSharedInbox();
  const [scheduling, setScheduling] = useState<Idea | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const ideas = ((trip.boardItems as Idea[] | undefined) || []).filter(item => isContentIdea(item)).slice().reverse();

  const remove = (idea: Idea) => {
    const result = removeBoardObjects(trip.boardItems || [], trip.boardLinks || [], [idea.id]);
    commit(withBoardChange(trip, result) as Trip);
    onNotice('Removed from Ideas');
  };

  return (
    <View style={styles.view}>
      <Pressable accessibilityRole="button" onPress={onPaste} style={({ pressed }) => [styles.add, styles.paste, pressed && styles.addPressed]}>
        <Icon name="link" size={17} color={colors.action} />
        <Text style={styles.addText}>Paste link</Text>
      </Pressable>
      {unassigned.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Saved from other apps</Text>
          {unassigned.map(link => (
            <SharedCard key={link.id} link={link} busy={adding === link.id}
              onAdd={async () => { setAdding(link.id); try { await addToTrip(link, trip); onNotice('Added to Ideas'); } catch (error) { onNotice((error as Error).message || 'Could not add this link.'); } finally { setAdding(null); } }}
              onDismiss={() => dismiss(link)} />
          ))}
        </View>
      ) : null}
      <View style={styles.section}>
        {unassigned.length ? <Text style={styles.sectionLabel}>In this trip</Text> : null}
        {ideas.length ? ideas.map(idea => (
          <IdeaCard key={idea.id} idea={idea} scheduled={(trip.items || []).some(plan => plan.ideaId === (idea.libraryIdeaId || idea.id))}
            onSchedule={() => { if (!datesForTrip(trip).length) { onNeedDates(); return; } setScheduling(idea); }}
            onRemove={() => remove(idea)} />
        )) : (
          <View style={styles.empty}>
            <Art name="ideas" size={44} />
            <Text style={styles.emptyTitle}>Save ideas from anywhere</Text>
            <Text style={styles.emptyText}>Share a TikTok, Reel or link to Elsewhere and choose this trip, or paste a link. It lands here, ready to add to a day.</Text>
          </View>
        )}
      </View>
      <DayPicker trip={trip} idea={scheduling} onClose={() => setScheduling(null)} onPick={day => {
        const idea = scheduling!;
        const ideaId = idea.libraryIdeaId || idea.id;
        if ((trip.items || []).some(plan => plan.ideaId === ideaId && plan.day === day)) return 'This idea is already on that day.';
        try {
          const plan = makePlan(trip, { name: idea.title || 'Saved idea', day, kind: ['Food', 'Stay', 'Activity'].includes(idea.category || '') ? idea.category : 'Activity', address: idea.location || '', notes: [idea.notes, idea.url].filter(Boolean).join('\n\n'), ...(idea.placeId ? { placeId: idea.placeId, latitude: idea.latitude, longitude: idea.longitude } : {}) } as never) as PlanItem;
          commit({ ...trip, items: [...(trip.items || []), { ...plan, ideaId }] });
          onNotice(`Added to ${formatDay(day)}`);
          return null;
        } catch (error) { return (error as Error).message; }
      }} />
    </View>
  );
}

function Thumbnail({ image, provider }: { image?: string; provider?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.thumb}>
      {image && !failed ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
        : <Art name="ideas" size={34} />}
      {provider && PROVIDERS[provider] ? <View style={styles.badge}><Text style={styles.badgeText}>{PROVIDERS[provider]}</Text></View> : null}
    </View>
  );
}

function IdeaCard({ idea, scheduled, onSchedule, onRemove }: { idea: Idea; scheduled: boolean; onSchedule(): void; onRemove(): void }) {
  const source = providerLabel(idea);
  return (
    <View style={styles.card}>
      <Thumbnail image={idea.image} provider={idea.provider} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{idea.title || 'Saved idea'}</Text>
        {idea.location ? <View style={styles.metaRow}><Icon name="pin" size={14} color={colors.action} /><Text style={styles.location} numberOfLines={1}>{idea.location}</Text></View> : null}
        {source ? <Text style={styles.meta} numberOfLines={1}>{source}</Text> : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onSchedule} style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
            <Icon name={scheduled ? 'check' : 'plus'} size={16} color={colors.action} />
            <Text style={styles.addText}>{scheduled ? 'In plan' : 'Add to day'}</Text>
          </Pressable>
          {idea.url ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Open ${source || 'link'}`} onPress={() => Linking.openURL(idea.url!)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Icon name="external" size={18} color="#555555" />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${idea.title || 'idea'}`} onPress={onRemove} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Icon name="trash" size={18} color="#555555" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SharedCard({ link, busy, onAdd, onDismiss }: { link: SharedLink; busy: boolean; onAdd(): void; onDismiss(): void }) {
  const caption = (link.title || '').split('\n').find(line => line.trim()) || '';
  return (
    <View style={[styles.card, styles.sharedCard]}>
      <Thumbnail image={link.image} provider={link.provider} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{caption || link.place?.name || providerLabel(link) || 'Shared link'}</Text>
        {link.place ? <View style={styles.metaRow}><Icon name="pin" size={14} color={colors.action} /><Text style={styles.location} numberOfLines={1}>{link.place.name}</Text></View> : null}
        <Text style={styles.meta} numberOfLines={1}>{[providerLabel(link), link.handle].filter(Boolean).join(' · ')}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onAdd} style={({ pressed }) => [styles.add, styles.addPrimary, pressed && styles.addPrimaryPressed, busy && styles.disabled]}>
            <Icon name="plus" size={16} color={colors.white} />
            <Text style={[styles.addText, styles.addPrimaryText]}>{busy ? 'Adding…' : 'Add to this trip'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Icon name="close" size={18} color="#555555" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// #ib-schedule-dialog: choose the day to add an idea to.
function DayPicker({ trip, idea, onClose, onPick }: { trip: Trip; idea: Idea | null; onClose(): void; onPick(day: string): string | null }) {
  const [error, setError] = useState('');
  const days = datesForTrip(trip) as string[];
  return (
    <BottomSheet visible={Boolean(idea)} onClose={() => { setError(''); onClose(); }}
      header={close => (
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={styles.sheetTitle}>Add to a day</Text>
            <Text style={styles.sheetSub} numberOfLines={1}>{idea?.title}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressedDark]}><Icon name="close" size={18} color="#555555" /></Pressable>
        </View>
      )}>
      {close => (
        <ScrollView style={styles.dayList} contentContainerStyle={styles.dayListContent}>
          {days.map(day => (
            <Pressable key={day} accessibilityRole="button" onPress={() => { const message = onPick(day); if (message) setError(message); else { setError(''); close(); } }}
              style={({ pressed }) => [styles.dayRow, pressed && styles.pressed]}>
              <Icon name="calendar" size={18} color={colors.action} />
              <Text style={styles.dayText}>{formatDay(day)}</Text>
              <Icon name="arrow" size={16} color={colors.tripArrow} />
            </Pressable>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  view: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 18 },
  section: { gap: 10 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.sectionLabel },
  card: { flexDirection: 'row', gap: 12, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.white },
  sharedCard: { borderColor: '#ffd9be', backgroundColor: '#fffaf6' },
  thumb: { width: 84, height: 112, borderRadius: sq(16), borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#fff2eb', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: sq(8), borderCurve: 'continuous', backgroundColor: 'rgba(32, 32, 31, 0.72)' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.white },
  copy: { flex: 1, minWidth: 0, gap: 4, paddingTop: 2 },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: colors.tripTitle },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.action },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.tripMeta },
  actions: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  add: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: sq(20), borderCurve: 'continuous', backgroundColor: '#fff2eb' },
  addPressed: { backgroundColor: '#ffe6d6' },
  paste: { minHeight: 44, justifyContent: 'center', borderRadius: sq(22) },
  addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.action },
  addPrimary: { backgroundColor: colors.accent },
  addPrimaryPressed: { backgroundColor: colors.accentPressed },
  addPrimaryText: { color: colors.white },
  iconButton: { width: 40, height: 40, borderRadius: sq(20), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.pressed },
  pressedDark: { backgroundColor: '#ebecef' },
  disabled: { opacity: 0.5 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e5cfc5', borderRadius: sq(22), borderCurve: 'continuous' },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.tripTitle },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  heading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 16, paddingHorizontal: 16 },
  headingCopy: { flex: 1, minWidth: 0 },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.5, color: '#252525' },
  sheetSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  close: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  dayList: { flexGrow: 0 },
  dayListContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 4 },
  dayRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: sq(18), borderCurve: 'continuous' },
  dayText: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger, paddingHorizontal: 12 },
});
