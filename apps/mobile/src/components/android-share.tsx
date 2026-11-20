import { useEffect } from 'react';
import { router } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';

// Android opens the app itself when "Elsewhere" is picked in a share sheet.
// This sends the shared link to the share screen (src/app/share.tsx).
export function AndroidShareHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (!hasShareIntent) return;
    const text = shareIntent.text || '';
    const url = shareIntent.webUrl || /https?:\/\/\S+/.exec(text)?.[0] || '';
    resetShareIntent();
    router.push({ pathname: '/share', params: { url, text } });
  }, [hasShareIntent, shareIntent, resetShareIntent]);
  return null;
}
