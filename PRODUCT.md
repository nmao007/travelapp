# PRODUCT.md

# TripPilot

## Vision

TripPilot is a collaborative travel planning app focused on organizing and executing trips—not booking them.

The MVP helps groups plan trips together with a visual itinerary, drag-and-drop scheduling, and a clean overview of everything happening each day.

---

## MVP Features

### Flight / Train Manager

Users can add transportation between destinations.

Each booking includes:

- Flight/train ID
- Departure location
- Arrival location
- Local departure time
- Local arrival time

Transportation automatically appears in the trip itinerary. Show local departure time and local arrival time.

---

### Interactive Map

Every trip has a map showing:

- Planned destinations
- Hotels
- Activities
- Suggested nearby attractions for open days

The map helps users discover things to do while planning.

---

### Trip Itinerary

The main planning view.

Features:

- List or calendar view
- Multiple destinations per trip
- Flights/trains displayed between destinations
- Days organized chronologically
- Each day contains its scheduled events

---

### Single Day View

Dedicated page for one day of the trip.

Displays:

- Timeline of events
- Transportation
- Reservations
- Custom activities

Designed for easy viewing while traveling.

---

### Collaboration

Trips can have multiple members.

Features:

- Shared editing
- Multiple collaborators
- User roles and permissions

---

### Drag-and-Drop Planning

Core interaction of the app.

Users can:

- Drag custom events between days
- Reorder events within a day
- Rearrange the trip itinerary visually

Transportation bookings (flights/trains) are fixed and cannot be dragged.

Temporary events can be moved freely until they become confirmed reservations.

---

### Transportation & Booking Cards

Flights, trains, hotels, and reservations are displayed as standardized cards throughout the itinerary and day views.

Each card contains relevant booking information and integrates into the trip timeline.

---

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Vercel

---

## Design Principles

- Mobile-first
- Responsive
- Minimal UI
- Fast interactions
- Drag-and-drop everywhere appropriate
- Beautiful, polished experience
- Collaboration-first

---

## Coding Rules

- Use strict TypeScript
- Build reusable components
- Keep code modular
- Minimize dependencies
- Preserve project architecture
- Do not modify unrelated files
- Explain implementation plan before coding

---

## Out of Scope (MVP)

Do **not** implement:

- AI features
- Email/Gmail import
- Automatic itinerary generation
- Payments
- Booking services
- Budget tracking
- Packing lists
- Social feed
- Reviews