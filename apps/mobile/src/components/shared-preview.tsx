import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Art, Icon } from '@/components/icons';
import type { SharedPlace, SharedPreview } from '@/lib/share-inbox';
import { colors, fonts, sq } from '@/lib/theme';

export const PROVIDERS: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };

export function sourceLabel(provider: string, url: string) {
  return PROVIDERS[provider] || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Link'; } })();
}

// A shared link's preview and the places named in it, as the share extension
// shows them (targets/share/ShareViewController.swift). Used by Android's
// share screen and the Ideas tab's Paste link sheet.
export function SharedLinkPreview({ url, preview, failed, place, onPlace }: { url: string; preview: SharedPreview | null; failed: boolean; place: SharedPlace | null; onPlace(place: SharedPlace | null): void }) {
  const source = sourceLabel(preview?.provider || '', url);
  const caption = (preview?.title || '').split('\n').map(line => line.replace(/#[\p{L}\p{N}_]+/gu, '').trim()).find(Boolean)
    || (preview || failed ? `${source} link` : 'Loading preview…');
  return (
    <>
      <View style={styles.preview}>
        <View style={styles.thumb}>
          {preview?.image ? <Image source={{ uri: preview.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : !preview && !failed ? <ActivityIndicator color={colors.action} /> : <Art name="ideas" size={34} />}
          <View style={styles.badge}><Text style={styles.badgeText}>{source}</Text></View>
        </View>
        <View style={styles.previewCopy}>
          <Text style={styles.caption} numberOfLines={3}>{caption}</Text>
          {preview && (preview.author || preview.handle) ? <Text style={styles.meta} numberOfLines={1}>{[preview.author, preview.handle].filter(Boolean).join(' · ')}</Text> : null}
          {failed ? <Text style={styles.muted}>No preview right now. The link is saved as it is.</Text> : null}
        </View>
      </View>
      {preview?.places.length ? (
        <View style={styles.group}>
          <Text style={styles.label}>Place</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
            {preview.places.map(option => {
              const selected = place?.placeId === option.placeId;
              return (
                <Pressable key={option.placeId} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onPlace(selected ? null : option)} style={[styles.chip, selected && styles.chipSelected]}>
                  <Icon name="pin" size={15} color={selected ? colors.action : colors.ink} />
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{option.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', gap: 12 },
  thumb: { width: 84, height: 112, borderRadius: sq(16), borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#fff2eb', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: sq(8), borderCurve: 'continuous', backgroundColor: 'rgba(32, 32, 31, 0.72)' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.white },
  previewCopy: { flex: 1, minWidth: 0, gap: 4 },
  caption: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: colors.tripTitle },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.tripMeta },
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  group: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.sectionLabel },
  chips: { gap: 8 },
  chip: { minHeight: 40, maxWidth: 240, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: sq(20), borderCurve: 'continuous', backgroundColor: colors.white },
  chipSelected: { borderColor: '#ffd9be', backgroundColor: '#fff2eb' },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, flexShrink: 1 },
  chipTextSelected: { color: colors.action },
});
