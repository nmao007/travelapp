import '@/lib/polyfills';
import { withCrashReports } from '@/lib/crash-reports';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TripsProvider } from '@/lib/trips';
import { ShareIntentProvider } from 'expo-share-intent';
import { Platform } from 'react-native';
import { SharedInboxProvider } from '@/lib/share-inbox';
import { AndroidShareHandler } from '@/components/android-share';

function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold,
    // The redesign (src/lib/design.ts).
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, InstrumentSerif_400Regular_Italic,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });
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

export default withCrashReports(RootLayout);
