import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/text';
import { BottomSheet } from '../sheet';
import { Icon } from '../icons';
import { SharedLinkPreview } from '../shared-preview';
import { fetchSharedPreview, useSharedInbox, type SharedPlace, type SharedPreview } from '@/lib/share-inbox';
import { colors, fonts, sq } from '@/lib/theme';
import type { Trip } from '@/lib/trips';

// The first web address in what was pasted, always https: /api/social-preview
// only looks up HTTPS links. A bare "tiktok.com/…" gets https too.
export function linkFrom(text: string) {
  const value = text.trim();
  const candidate = /https?:\/\/\S+/i.exec(value)?.[0] || (/^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(value) ? `https://${value}` : '');
  try {
    const url = new URL(candidate.replace(/^http:/i, 'https:'));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

const newId = () => `${Date.now()}`;

// The same page whether pasted with or without www, http or a trailing slash.
function linkKey(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, '').toLowerCase()}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch { return value; }
}

// Paste link on the Ideas tab: the same preview and place chips as sharing a
// video into the app, saved straight to this trip's Ideas.
export function PasteLinkSheet({ visible, trip, onClose, onSaved }: { visible: boolean; trip: Trip; onClose(): void; onSaved(): void }) {
  const { addToTrip } = useSharedInbox();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<{ url: string; value: SharedPreview | null; failed: boolean } | null>(null);
  const [place, setPlace] = useState<SharedPlace | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const url = linkFrom(text);

  // Closing starts the next paste from an empty field.
  const closed = () => { setText(''); setPreview(null); setPlace(null); setError(''); setSaving(false); onClose(); };

  // Look the link up once typing pauses; a newer link cancels the older lookup.
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPreview({ url, value: null, failed: false }); setPlace(null);
      fetchSharedPreview(url, controller.signal)
        .then(value => { setPreview({ url, value, failed: false }); setPlace(value.places[0] ?? null); })
        .catch(() => { if (!controller.signal.aborted) setPreview({ url, value: null, failed: true }); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url]);

  const current = preview?.url === url ? preview : null;
  const save = async (close: () => void) => {
    if (!url || saving) return;
    const value = current?.value;
    const pasted = new Set([url, value?.url].filter(Boolean).map(link => linkKey(link!)));
    if (((trip.boardItems as { url?: string }[] | undefined) || []).some(item => item.url && pasted.has(linkKey(item.url)))) { setError('This link is already in Ideas.'); return; }
    setSaving(true); setError('');
    try {
      await addToTrip({
        id: newId(), url: value?.url || url, savedAt: new Date().toISOString(), tripId: trip.id,
        ...(value ? { provider: value.provider, title: value.title, author: value.author, handle: value.handle, image: value.image, places: value.places } : {}),
        place,
      }, trip);
      onSaved();
      close();
    } catch (failure) {
      setError((failure as Error).message || 'Could not add this link.');
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={closed}
      header={close => (
        <View style={styles.heading}>
          <Text style={styles.title}>Paste link</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.closePressed]}><Icon name="close" size={18} color="#555555" /></Pressable>
        </View>
      )}
      footer={close => (
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" disabled={!url || saving} onPress={() => save(close)} style={({ pressed }) => [styles.save, (!url || saving) && styles.disabled, pressed && styles.savePressed]}>
            {saving ? <ActivityIndicator color={colors.white} /> : null}
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save idea'}</Text>
          </Pressable>
        </View>
      )}>
      <ScrollView keyboardDismissMode="interactive" style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Link</Text>
          <TextInput style={styles.input} value={text} onChangeText={value => { setText(value); setError(''); }} placeholder="Paste a website or saved video" placeholderTextColor={colors.inputPlaceholder}
            autoFocus autoCapitalize="none" autoCorrect={false} keyboardType="url" textContentType="URL" returnKeyType="done" accessibilityLabel="Link" />
        </View>
        {url && current ? <SharedLinkPreview url={url} preview={current.value} failed={current.failed} place={place} onPlace={setPlace} />
          : text.trim() && !url ? <Text style={styles.hint}>Paste a full web address, like a TikTok, Reel or website link.</Text> : null}
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  heading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 16, paddingHorizontal: 16 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.5, color: '#252525' },
  close: { width: 44, height: 44, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  closePressed: { backgroundColor: '#ebecef' },
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 18 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  input: { minHeight: 48, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.inputLine, borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.white, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: '#333333' },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
  footer: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 },
  save: { minHeight: 48, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: sq(22), borderCurve: 'continuous', backgroundColor: colors.accent },
  savePressed: { backgroundColor: colors.accentPressed },
  saveText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
  disabled: { opacity: 0.5 },
});
