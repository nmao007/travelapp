import '@/lib/polyfills';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TripsProvider } from '@/lib/trips';
import { ShareIntentProvider } from 'expo-share-intent';
import { Platform } from 'react-native';
import { SharedInboxProvider } from '@/lib/share-inbox';
import { AndroidShareHandler } from '@/components/android-share';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  if (!fontsLoaded) return null;
  return (
    // Android delivers shares to the app itself (expo-share-intent); iOS uses
    // the share extension in targets/share instead.
    <ShareIntentProvider options={{ disabled: Platform.OS !== 'android' }}>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <TripsProvider>
        <SharedInboxProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }} />
          <AndroidShareHandler />
        </SharedInboxProvider>
      </TripsProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}
