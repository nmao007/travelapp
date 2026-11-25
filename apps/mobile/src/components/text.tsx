import { forwardRef, type ComponentRef } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from 'react-native';

// Text follows the phone's text size setting, up to 1.4× (about the largest
// standard size, "XXXL"). The accessibility sizes above that reach 3× and
// would break every layout. Brand marks and tab labels pass a lower cap.
export const TEXT_SCALE = 1.4;
export const TIGHT_SCALE = 1.15;

export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(function Text(props, ref) {
  return <NativeText maxFontSizeMultiplier={TEXT_SCALE} {...props} ref={ref} />;
});

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(function TextInput(props, ref) {
  return <NativeTextInput maxFontSizeMultiplier={TEXT_SCALE} {...props} ref={ref} />;
});
