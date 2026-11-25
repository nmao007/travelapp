import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { addSharedIdea, unplacedIdea } from '@trippilot/core/board-model';
import { Icon } from '../icons';
import { BottomSheet } from '../sheet';
import { PlaceSearch, kindFor } from './add-sheet';
import type { Idea } from './ideas-view';
import { haptics } from '@/lib/haptics';
import type { Place } from '@/lib/places';
import { colors, fonts, sq } from '@/lib/theme';
import type { Trip } from '@/lib/trips';

// "Add an idea" on the Ideas tab: save a real place (searched around the trip's
// destination), paste a link, or jot a note. None of these go on a day yet.
export function IdeaSheet({ visible, trip, near, onClose, commit, onPaste, onSaved }: {
  visible: boolean; trip: Trip; near: { name: string; latitude: number; longitude: number }; onClose(): void;
  commit(trip: Trip): void; onPaste(): void; onSaved(message: string): void;
}) {
  return visible ? <IdeaSheetBody trip={trip} near={near} onClose={onClose} commit={commit} onPaste={onPaste} onSaved={onSaved} /> : null;
}

function IdeaSheetBody({ trip, near, onClose, commit, onPaste, onSaved }: {
  trip: Trip; near: { name: string; latitude: number; longitude: number }; onClose(): void;
  commit(trip: Trip): void; onPaste(): void; onSaved(message: string): void;
}) {
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const ideas = (trip.boardItems as Idea[] | undefined) || [];

  function save(idea: Idea, close: () => void) {
    commit(addSharedIdea(trip, idea) as Trip);
    haptics.success(); close(); onSaved(`Added ${idea.title || 'note'} to Ideas`);
  }

  function savePlace(place: Place, close: () => void) {
    if (ideas.some(item => item.placeId === place.placeId)) { setError(`${place.name} is already in Ideas.`); return; }
    save(unplacedIdea('card', {
      title: place.name, location: place.address, placeId: place.placeId, latitude: place.latitude, longitude: place.longitude, category: kindFor(place), source: 'search',
    }, ideas.length) as Idea, close);
  }

  function saveNote(close: () => void) {
    if (!title.trim()) { setError('Give the note a title.'); return; }
    save(unplacedIdea('note', { title: title.trim(), notes: notes.trim() }, ideas.length) as Idea, close);
  }

  return (
    <BottomSheet visible onClose={onClose}
      header={close => (
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header">{writing ? 'Write a note' : 'Add an idea'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Icon name="close" size={18} color="#555555" />
          </Pressable>
        </View>
      )}
      footer={writing ? close => (
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={() => { setWriting(false); setError(''); }} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => saveNote(close)} style={({ pressed }) => [styles.save, pressed && styles.savePressed]}>
            <Text style={styles.saveText}>Save note</Text>
          </Pressable>
        </View>
      ) : undefined}>
      {close => (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {writing ? (
            <>
              <TextInput style={styles.input} value={title} onChangeText={value => { setTitle(value); setError(''); }} autoFocus maxLength={160}
                placeholder="What is it? e.g. Night market" placeholderTextColor={colors.inputPlaceholder} accessibilityLabel="Note title" returnKeyType="next" />
              <TextInput style={[styles.input, styles.notes]} value={notes} onChangeText={setNotes} multiline maxLength={4000} textAlignVertical="top"
                placeholder="Details, a tip from a friend, opening hours…" placeholderTextColor={colors.inputPlaceholder} accessibilityLabel="Note details" />
            </>
          ) : (
            <PlaceSearch near={near} placeholder={`Search places in ${near.name}`} autoFocus onPick={place => savePlace(place, close)} onError={setError}
              extra={query => <Option icon="edit" label={`Save “${query}” as a note`} detail="Keep it without a place" onPress={() => { setTitle(query); setWriting(true); setError(''); }} />}>
              <View style={styles.options}>
                <Option icon="link" label="Paste a link" detail="A video, article or website" onPress={() => { close(); onPaste(); }} />
                <Option icon="edit" label="Write a note" detail="Something without a place yet" onPress={() => { setWriting(true); setError(''); }} />
              </View>
            </PlaceSearch>
          )}
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function Option({ icon, label, detail, onPress }: { icon: 'link' | 'edit'; label: string; detail: string; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityHint={detail} onPress={onPress} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      <View style={styles.optionIcon}><Icon name={icon} size={19} color="#555555" /></View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionDetail}>{detail}</Text>
      </View>
      <Icon name="chevron" size={16} color="#969ca9" style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.pressed },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 12, paddingLeft: 20, paddingRight: 16, borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 25, lineHeight: 31, letterSpacing: -0.7, color: '#30343b' },
  close: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyContent: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  options: { gap: 8 },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#eeeeee', borderRadius: sq(22), borderCurve: 'continuous' },
  optionIcon: { width: 40, height: 40, borderRadius: sq(14), borderCurve: 'continuous', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, minWidth: 0, gap: 2 },
  optionLabel: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  optionDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  chevron: { transform: [{ rotate: '-90deg' }] },
  input: { minHeight: 50, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.inputLine, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.white, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  notes: { height: 120 },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.danger },
  footer: { flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#eeeeee' },
  back: { minHeight: 48, paddingHorizontal: 18, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, justifyContent: 'center' },
  backText: { fontFamily: fonts.medium, fontSize: 15, color: '#555555' },
  save: { flex: 1, minHeight: 48, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  savePressed: { backgroundColor: colors.accentPressed },
  saveText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
});
