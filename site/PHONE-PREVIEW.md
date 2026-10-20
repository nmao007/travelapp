# Phone preview geometry

The iPhone 18 Pro and Pro Max front projections use Apple's dimensional
drawings dated September 9, 2026, sheet 1:

- https://developer.apple.com/download/files/accessories/dimensional-drawings/iphone-18-pro.pdf
- https://developer.apple.com/download/files/accessories/dimensional-drawings/iphone-18-pro-max.pdf
- Display resolution: https://www.apple.com/iphone-18-pro/specs/

| Measurement (mm) | 18 Pro | 18 Pro Max |
| --- | ---: | ---: |
| Housing width | 71.85 | 77.98 |
| Housing height | 150.01 | 163.43 |
| Active display rectangle | 66.57 × 144.73 | 72.86 × 158.31 |
| Housing edge to active display | 2.64 | 2.56 |
| Cover glass inset | 1.20 | 1.20 |
| Resting island width | 15.66 | 15.68 |
| Resting island height | 6.07 | 6.07 |
| Island center below housing top | 7.99 | 7.91 |
| Logical display (points) | 402 × 874 | 440 × 956 |

The housing-to-display measurement includes both the housing rim and the black
border. It must not be described as the bare OLED bezel thickness.

`dist/phone-hardware-data.js` records these dimensions, button positions, and
contour samples. `dist/phone-hardware.js` converts mm using the active display
width, keeps the iframe at its native logical size, and reflects the measured
continuous corner profile. The height discrepancy from rounded drawing
dimensions is below 0.02 mm. CSS path masks avoid browser-specific superellipse
rendering and clipped seams. The stage uniformly scales the complete device to
fit the available space; it does not stretch individual hardware parts.

These are front projections, not interactive iOS simulators. Software status
icons, home-indicator behavior, finishes, and expanded Live Activities remain
illustrative. Other models retain their existing illustrative hardware frames;
their logical display sizes are independent of these iPhone 18 measurements.
