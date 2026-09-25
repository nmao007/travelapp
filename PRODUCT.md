# PRODUCT.md

# TripPilot

## Vision

TripPilot is a travel logistics app, not a booking platform.

Its purpose is to organize every part of a trip into one place and eventually become an AI travel assistant that helps users before and during travel.

---

## MVP

Build only these features:

- Authentication
- Create/Edit/Delete Trips
- Trip Dashboard
- Timeline
- Activities
- Budget
- Packing List

No AI.
No booking.
No Gmail integration.
No payments.

---

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Vercel

Future:
- Google Maps
- OpenAI
- Expo

---

## Data Model

User
- id

Trip
- id
- userId
- title
- destination
- startDate
- endDate

Activity
- id
- tripId
- title
- category
- location
- date
- time
- notes

Expense
- id
- tripId
- amount
- category
- notes

PackingItem
- id
- tripId
- name
- packed
- category

---

## Pages

/

Dashboard

Trip

Timeline

Budget

Packing

Login

Signup

---

## UI

Requirements:

- Mobile first
- Responsive
- Dark mode
- Clean typography
- Rounded cards
- Minimal
- Fast
- Apple-quality polish

---

## Coding Rules

- Production-quality code
- Strict TypeScript
- Reuse existing components
- Keep components modular
- Minimize dependencies
- Do not rewrite unrelated files
- Keep commits focused
- Explain plan before implementation
- Preserve project architecture

---

## Goal

Ship a polished MVP as quickly as possible.

Every feature should support one question:

> Does this make organizing and managing a trip easier?

If not, don't build it yet.