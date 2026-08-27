# ReturnRide — Product Requirements Document

## Original Problem Statement
Rural mobility app: vehicles drop passengers in town and drive back empty. Match return-trip
journeys (Village A <-> Town) so drivers earn on the empty leg and passengers get cheaper rides.
Core differentiator: matching on return-route overlap, not point-to-point proximity.

## Stack / Architecture
- Frontend: React Native (Expo SDK 54, expo-router), earthy Material-You design, Plus Jakarta Sans + Figtree fonts
- Backend: FastAPI (Python) + Motor, JWT auth (phone + password)
- DB: MongoDB (uuid string ids, soft-delete via deleted_at)
- Maps: react-native-maps (native) + styled web fallback
- Payments: DEMO gateway (Razorpay to be wired later with user's keys)

## User Personas
- Passenger: rural commuter finding an affordable return ride
- Driver: auto/car/van/jeep owner filling the empty return leg
- Admin (future): transport co-op managing platform

## Core Requirements (static)
1. Return-route overlap matching (exact + on-the-way partial), time-window (±flex), scoring
2. Return-trip discounted fare (25% off empty leg) + savings + CO2 tracker
3. Ride booking lifecycle: requested → accepted → en_route → in_progress → completed (+ cancel/reject)
4. Village/landmark database (seeded Dharwad-district corridor)
5. Role-based auth (passenger/driver), profiles, ratings, SOS, demo payment

## Implemented (2026-06)
- [x] JWT auth: register/login/me, role selection, driver vehicle details
- [x] Village master DB (10 seeded villages/towns) + searchable picker
- [x] Return-trip matching engine (POST /api/rides/match) with route projection + corridor + time fit scoring
- [x] Driver publish route (fare + CO2 estimate, seats, women-only toggle)
- [x] Passenger search + match cards (discount, savings, CO2, seats, ETA)
- [x] Booking + full lifecycle status stepper with 5s polling
- [x] Demo payment (UPI/cash/wallet) + post-ride rating
- [x] Profile with stats (rating, rides, earned/saved, CO2 saved), SOS (tel:112), trips history
- [x] Real map (native) + web fallback; seeded demo drivers with live open rides
- Verified: 29/29 backend tests pass; frontend E2E flow validated

## Backlog / Remaining
### P1
- Razorpay real payment integration (needs Key ID + Secret from user)
- Google Maps API key for live tiles on Android + live driver GPS tracking
- Multi-passenger pooling + split fare on same return leg
- Scheduled/advance booking + recurring commute matching
### P2
- Firebase phone OTP option, driver KYC (license/RC upload via object storage)
- In-app chat / call-masking, trip sharing link
- Multilingual (Kannada/Hindi/Tamil), low-bandwidth text-only mode
- Admin web dashboard (users, villages, analytics, disputes, demand heatmap)
- WhatsApp/SMS fallback booking, seasonal market-day demand prediction

## Next Tasks
- Wire Razorpay once keys provided; add Google Maps key for live tiles
- Add live driver location tracking on active rides
