import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// A few named taps, so the feel stays consistent across screens. They never
// throw: a phone without a haptic engine (or the web) just stays still.
const quiet = (run: () => Promise<void>) => { if (Platform.OS !== 'web') run().catch(() => {}); };

export const haptics = {
  // Switching tabs, picking a day or an option.
  select: () => quiet(() => Haptics.selectionAsync()),
  // Lifting a plan to drag it.
  lift: () => quiet(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  // Dropping a plan, or a small change landing.
  drop: () => quiet(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // Something saved where it was going: an idea added to a day or trip.
  success: () => quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  // About to do something that can't be undone.
  warning: () => quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
