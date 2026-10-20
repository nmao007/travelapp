import { measuredPhoneHardware } from './phone-hardware-data.js';

const rounded = value => Number(value.toFixed(4));
const outlinePath = points => `M${points.map(([x, y]) => `${rounded(x)},${rounded(y)}`).join('L')}Z`;

// Reflect the measured top-left contour, preserving Apple's continuous corners
// instead of substituting a browser-dependent border radius or superellipse.
function cornerPath(corner, width, height, xScale, yScale = xScale) {
  const points = corner.map(([x, y]) => [x * xScale, y * yScale]);
  return outlinePath([
    ...points,
    ...points.slice().reverse().map(([x, y]) => [x, height - y]),
    ...points.map(([x, y]) => [width - x, height - y]),
    ...points.slice().reverse().map(([x, y]) => [width - x, y]),
  ]);
}

export function phoneHardware(device) {
  const drawing = measuredPhoneHardware[device.id];
  if (!drawing) return {
    measured: false,
    bodyWidth: device.width + 39.554, bodyHeight: device.height + 39.557,
    screenLeft: 19.777, screenTop: 19.7785,
    cutoutWidth: device.cutout === 'notch' ? 155 : 124.941,
  };
  // One physical scale for the entire device; the iframe keeps exact logical
  // display points. Small drawing-rounding differences are absorbed by its mask.
  const scale = device.width / drawing.screenMm[0];
  const bodyWidth = drawing.bodyMm[0] * scale;
  const bodyHeight = drawing.bodyMm[1] * scale;
  const screenLeft = (bodyWidth - device.width) / 2;
  const screenTop = (bodyHeight - device.height) / 2;
  const [glassLeft, glassTop] = drawing.glassInsetMm.map(value => value * scale);
  const island = drawing.islandMm;
  return {
    measured: true, source: drawing.source, scale,
    bodyWidth, bodyHeight, screenLeft, screenTop,
    glassLeft, glassTop,
    bodyPath: cornerPath(drawing.bodyCorner, bodyWidth, bodyHeight, scale),
    glassPath: cornerPath(drawing.glassCorner, bodyWidth - glassLeft * 2, bodyHeight - glassTop * 2, scale),
    screenPath: cornerPath(drawing.screenCorner, device.width, device.height, scale, device.height / drawing.screenMm[1]),
    cutoutWidth: island.width * scale, cutoutHeight: island.height * scale,
    cutoutLeft: (device.width - island.width * scale) / 2,
    cutoutTop: island.y * scale,
    cutoutPath: outlinePath(island.outline.map(([x, y]) => [x * scale, y * scale])),
    buttons: Object.fromEntries(Object.entries(drawing.buttonsMm).map(([name, [top, height, protrusion]]) => [name, {
      top: top * scale, height: height * scale, protrusion: protrusion * scale,
    }])),
  };
}

export function phonePreviewScale(device, width, height) {
  const hardware = phoneHardware(device);
  return Math.max(.2, Math.min(1, (width - 48) / hardware.bodyWidth, (height - 64) / hardware.bodyHeight));
}
