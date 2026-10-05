// Logical display sizes from Apple's Human Interface Guidelines / Layout.
// The hardware drawing is illustrative except for the traced iPhone 16 shell.
const device = (id, name, width, height, cutout = 'island') => ({ id, name, width, height, cutout, safeTop: cutout === 'notch' ? 47 : 62, safeBottom: 34 });
export const phoneDevices = [
  device('iphone13mini', 'iPhone 13 mini', 375, 812, 'notch'),
  device('iphone13', 'iPhone 13', 390, 844, 'notch'),
  device('iphone13pro', 'iPhone 13 Pro', 390, 844, 'notch'),
  device('iphone13promax', 'iPhone 13 Pro Max', 428, 926, 'notch'),
  device('iphone14', 'iPhone 14', 390, 844, 'notch'),
  device('iphone14plus', 'iPhone 14 Plus', 428, 926, 'notch'),
  device('iphone14pro', 'iPhone 14 Pro', 393, 852),
  device('iphone14promax', 'iPhone 14 Pro Max', 430, 932),
  device('iphone15', 'iPhone 15', 393, 852),
  device('iphone15plus', 'iPhone 15 Plus', 430, 932),
  device('iphone15pro', 'iPhone 15 Pro', 393, 852),
  device('iphone15promax', 'iPhone 15 Pro Max', 430, 932),
  device('iphone16e', 'iPhone 16e', 390, 844, 'notch'),
  device('iphone16', 'iPhone 16', 393, 852),
  device('iphone16plus', 'iPhone 16 Plus', 430, 932),
  device('iphone16pro', 'iPhone 16 Pro', 402, 874),
  device('iphone16promax', 'iPhone 16 Pro Max', 440, 956),
  device('iphone17e', 'iPhone 17e', 390, 844, 'notch'),
  device('iphone17', 'iPhone 17', 402, 874),
  device('iphoneair', 'iPhone Air', 420, 912),
  device('iphone17pro', 'iPhone 17 Pro', 402, 874),
  device('iphone17promax', 'iPhone 17 Pro Max', 440, 956),
  // Apple: https://www.apple.com/iphone-18-pro/specs/
  // 1206 × 2622 and 1320 × 2868 display pixels at 3× scale.
  device('iphone18pro', 'iPhone 18 Pro', 402, 874),
  device('iphone18promax', 'iPhone 18 Pro Max', 440, 956),
];
export const phoneDevice = id => phoneDevices.find(device => device.id === id) || phoneDevices.find(device => device.id === 'iphone16');
export const phoneMediaQuery = '(max-width:580px), (max-width:980px) and (max-height:500px)';
export function phoneViewport({ layoutHeight, visualHeight = layoutHeight, offsetTop = 0, scale = 1, editing = false }) {
  const rise = scale === 1 && editing ? Math.max(0, layoutHeight - visualHeight - offsetTop) : 0;
  const keyboard = rise > 80;
  return { keyboard, rise: keyboard ? rise : 0, height: keyboard ? visualHeight : layoutHeight };
}
export function dropdownBounds(rect, contentHeight, { width, height, top = 0, left = 0, minimumWidth = 180 }) {
  const menuWidth = Math.min(Math.max(rect.width, minimumWidth), width - 16);
  const below = top + height - rect.bottom - 8, above = rect.top - top - 8;
  const upward = below < Math.min(contentHeight, 180) && above > below;
  const menuHeight = Math.min(contentHeight, 280, Math.max(40, upward ? above : below));
  return { width: menuWidth, height: menuHeight, left: Math.max(left + 8, Math.min(rect.left, left + width - menuWidth - 8)), top: Math.max(top + 8, Math.min(upward ? rect.top - menuHeight - 4 : rect.bottom + 4, top + height - menuHeight - 8)), upward };
}
