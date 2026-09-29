> Superseded draft. The authoritative new proposal is [MASTER_PLAN.md](MASTER_PLAN.md). Implementation is paused until the user approves that plan.

# Experience and layout specification

## Design principles applied

- Hierarchy: the next meaningful action leads, supporting details follow. Give one primary action per task context.
- Progressive disclosure: expose useful defaults; show optional notes, advanced reservation fields, and secondary tools on demand.
- Consistency: stable navigation, uniform icons/controls, one date/money vocabulary, predictable save/edit feedback.
- Contrast: legible text and controls; use accent color for purpose, not decoration. Danger actions are distinct and separated.
- Accessibility: semantic controls, explicit names, keyboard operation, visible focus, dialog focus management, large targets, reduced motion, and tested small-screen layouts.
- Proximity/alignment: related details sit together on an 8px spacing scale; grids organize planning rather than scattering cards.

## Visual system

Warm off-white canvas, white surfaces, charcoal text, deep green primary controls, subtle slate/green borders, and restrained amber attention states. Typography uses a familiar sans-serif stack. Titles are 24–32px; body text 14–16px; labels remain legible. Corners are 12px for controls and 20px for panels. Icons use one consistent outline set. No gradients or promotional hero imagery on operational screens.

## Layout

Desktop (>=1100px): 224px sidebar; top search/context/action bar; a max-width content canvas; optional 300px context pane. Tablet: compact rail or top navigation and responsive main canvas. Phone (<768px): compact header, five labeled bottom destinations, one main column, and floating quick-add where appropriate. Safe-area and keyboard behavior are required.

## Screen specifications

### Today

Compact trip name/date context, lifecycle greeting, next actionable travel card, one preparation/arrival/return priority, and today's itinerary. Shortcuts to reservations, adding a cost, and saved places. Preparation mode leads with readiness and deadlines; traveling mode leads with the next leg/stop; returned mode leads with wrap-up costs and outstanding tasks.

### Plan

A horizontal day selector and secondary sections: Itinerary / Bookings / Before you go. Day plans show times, travel category, location, reservation linkage, and flexible stops. Desktop pairs the itinerary with planning context; phone uses collapsible capture/edit controls. Date changes and unscheduled ideas remain explicit.

### Explore

Search and a small filter row, saved state, place cards with purpose/location and an Add to day action. Map/list switch comes with actual map integration. Show the basis for recommendations and relevant accessibility/dietary suitability only when supported by evidence. Local prototype places are sample content, not live opening-hour or availability claims.

### Wallet

Secondary sections: Expenses / Reservations / Documents. Summary balances precede details. Fast expense capture, budget/over-budget states, booking reference lookup, and in-app details. The initial prototype never asks for real passport or payment information; secure document infrastructure follows later.

### Tools

Preparation, packing, phrasebook, currency calculator, and Help & safety. Tools have concrete actions rather than a grid of unexplained app icons. Weather, arbitrary translation, connectivity purchases, and emergency assistance are provider-backed work, not fabricated widgets.

## Core flows

1. Create a trip with destination and flexible dates; optional profile/budget details follow later.
2. Save a place from Explore; assign it to a day with optional time; see it in Plan and Today.
3. Capture a reservation; see its reference in Wallet and add the relevant arrival/departure/check-in to Plan.
4. Tap quick add, enter only necessary expense fields, save, see total and feedback; retain context.
5. Complete a preparation or packing task; progress changes immediately and survives reload.
6. Search a reference/place/activity; navigate to the relevant section or detail rather than a dead-end results page.
7. Open Help & safety from any screen; see useful offline contacts and provider status, with no invented emergency guidance.

## State handling

Every working feature needs empty, loading, success, validation-error, unavailable/offline, and destructive-confirmation behavior. Service dependencies must be explicitly unavailable until connected. Sample data is labeled at the workspace boundary. Feedback never says a booking is confirmed unless a trusted source confirms it.

## References

- Figma: https://www.figma.com/resource-library/ui-design-principles/
- Apple: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Android: https://developer.android.com/develop/ui/compose/components/navigation-bar
