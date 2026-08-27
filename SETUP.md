# ReturnRide — Full Setup Guide

Smart rural **return-trip** ride matching app. Drivers fill their empty return leg; passengers get cheaper rides. Matching is based on **return-route overlap** (Village A ↔ Town), not just point-to-point proximity.

- **Frontend:** React Native + Expo (SDK 54, expo-router) — Android / iOS / Web
- **Backend:** FastAPI (Python) + Motor (async MongoDB)
- **Database:** MongoDB
- **Auth:** Custom JWT (phone + password)
- **Maps:** react-native-maps (native) with a web fallback
- **Payments:** Razorpay (config-gated) with a demo fallback

---

## 1. Repository layout

```
/app
├── backend/                 # FastAPI service
│   ├── server.py            # All API routes, matching engine, seeding
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Backend secrets (NOT committed)
├── frontend/                # Expo app
│   ├── app/                 # expo-router screens (file = route)
│   │   ├── _layout.tsx      # Root providers + fonts
│   │   ├── index.tsx        # Auth redirect
│   │   ├── login.tsx, register.tsx
│   │   ├── passenger/       # Passenger tabs (index/matches/trips/profile)
│   │   ├── driver/          # Driver tabs (index/rides/profile)
│   │   └── ride/[id].tsx    # Shared live ride-tracking screen
│   ├── src/                 # Non-route code
│   │   ├── theme.ts         # Design tokens (colors/spacing/fonts)
│   │   ├── api.ts           # Fetch client + token handling
│   │   ├── auth/AuthContext.tsx
│   │   ├── components/      # UI, Map, VillagePicker, ScheduleField, Razorpay
│   │   └── hooks/useVillages.ts
│   ├── assets/fonts/        # Plus Jakarta Sans + Figtree
│   ├── app.json             # Expo config (permissions, plugins)
│   ├── package.json
│   └── .env                 # Frontend public config (NOT committed)
└── memory/                  # PRD + test credentials (internal notes)
```

---

## 2. Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18+ (LTS) |
| Yarn | 1.22.x (repo uses yarn classic) |
| Python | 3.11+ |
| MongoDB | 6+ (local) or MongoDB Atlas |
| Expo Go app | Latest (on your phone, for device testing) |

---

## 3. Backend setup

```bash
cd backend

# create + activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# install dependencies
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="returnride_database"
JWT_SECRET="<run: openssl rand -hex 32>"

# Optional — leave EMPTY to use demo payments; fill to enable real Razorpay
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
```

Run the API (port **8001**):

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

On first boot it auto-seeds 10 villages/towns and 3 demo drivers with live return rides.

**Important:** every route is prefixed with `/api` (e.g. `GET /api/villages`). This matches the ingress rule that routes `/api/*` to the backend.

---

## 4. Frontend setup

```bash
cd frontend
yarn install
```

Create `frontend/.env`:

```env
# Point this at your backend's public base URL (no /api suffix, no trailing slash)
EXPO_PUBLIC_BACKEND_URL="http://localhost:8001"
```

> On a physical phone, `localhost` is the phone itself. Use your computer's LAN IP
> (e.g. `http://192.168.1.5:8001`) or a tunnel so the device can reach the backend.

Start the app:

```bash
yarn start          # then press: a=Android, i=iOS, w=Web
# or
yarn web            # browser preview
```

Scan the QR code with **Expo Go** to run on a real device.

---

## 5. Environment variables reference

**backend/.env**
| Key | Required | Purpose |
|---|---|---|
| `MONGO_URL` | ✅ | MongoDB connection string |
| `DB_NAME` | ✅ | Database name |
| `JWT_SECRET` | ✅ | Signing secret for JWT access tokens |
| `RAZORPAY_KEY_ID` | ⭕ | Razorpay Key ID — enables real payments when set |
| `RAZORPAY_KEY_SECRET` | ⭕ | Razorpay Key Secret — backend only, never in the app |

**frontend/.env**
| Key | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | ✅ | Base URL the app calls (`/api` is appended in code) |

Never put the Razorpay secret, JWT secret, or Mongo URL in the frontend.

---

## 6. Test / demo accounts

Seeded demo drivers (own live return rides so matching works instantly):

| Name | Phone | Password | Vehicle |
|---|---|---|---|
| Ravi Kumar | `9000000001` | `demo1234` | Auto |
| Suresh Naik | `9000000002` | `demo1234` | Car |
| Mahesh Gowda | `9000000003` | `demo1234` | Shared Jeep |

**End-to-end flow**
1. Register a passenger (any phone, password ≥ 4 chars).
2. Find Ride → **Hubballi → Kalghatgi**, "Leave now" → see matches.
3. Book → lands on the live ride screen (status: Requested).
4. In another session, log in as **Ravi (9000000001)** → My Rides → Requests → open booking → Accept → Start → Picked up → Complete.
5. Back as passenger: pay (demo) + rate. Status auto-refreshes every 5s.

---

## 7. Enabling the integrations

### Razorpay (real UPI / card payments)
1. Razorpay Dashboard → **Test Mode** → Account & Settings → API Keys → **Generate Key**.
2. Put `Key ID` and `Key Secret` into `backend/.env` (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`), restart backend.
3. `GET /api/payments/config` will now return `provider: "razorpay"` and the app switches from demo to real checkout automatically.
4. Test cards/UPI: use Razorpay's Test Mode values; UPI success = `success@razorpay`.
5. Go live later by generating **Live** keys and using HTTPS.

### Google Maps (live road tiles on Android)
- iOS uses Apple Maps by default (no key needed).
- For Android tiles, add your Maps API key to `frontend/app.json`:
  ```json
  "android": { "config": { "googleMaps": { "apiKey": "YOUR_KEY" } } },
  "ios":     { "config": { "googleMapsApiKey": "YOUR_KEY" } }
  ```
  Enable "Maps SDK for Android/iOS" in Google Cloud Console, then rebuild.

---

## 8. Key API endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` `/api/auth/login` | Returns `access_token` + user |
| GET | `/api/auth/me` | Current user (Bearer token) |
| GET | `/api/villages` | Seeded village/town list |
| POST | `/api/rides` | Driver publishes a return leg |
| POST | `/api/rides/match` | **Core:** return-trip matching + fares + pooling |
| POST | `/api/bookings` | Passenger books (supports `want_pool`, `scheduled_time`, `recurring`) |
| POST | `/api/bookings/{id}/status` | Lifecycle transitions (driver-driven) |
| POST | `/api/bookings/{id}/location` | Driver shares live GPS |
| GET | `/api/bookings/{id}/pool` | Co-riders roster |
| GET | `/api/payments/config` | demo vs razorpay |
| POST | `/api/payments/order` `/api/payments/verify` | Razorpay (when configured) |
| POST | `/api/payments/demo` | Demo payment fallback |
| POST | `/api/ratings` | Rate a completed ride |
| GET | `/api/stats/me` | Rides, CO₂ saved, money saved/earned |

---

## 9. Testing

```bash
# Backend tests
cd backend
pytest -n 0 tests/            # -n 0 required (chained-state test file)

# Frontend lint / type
cd frontend
yarn lint
```

---

## 10. Deploy & mobile builds (Emergent)

- Click **Publish** (top-right) → **Deploy your app** → generate **iOS / Android** builds.
- New `.env` keys are copied to the deployment Secrets store on first deploy; edit them later in the Deployment panel → Secrets, then re-deploy.
- Native-only features (live GPS, real Razorpay checkout, camera) are best verified on a real device build.

---

## 11. Common issues

| Symptom | Fix |
|---|---|
| App shows blank / can't reach API | Check `EXPO_PUBLIC_BACKEND_URL`; on device use LAN IP, not `localhost` |
| 401 on protected calls | Token missing/expired — log out and back in |
| No ride matches | Ensure demo rides seeded (restart backend) and time window is reasonable |
| Map blank on Android | Add a Google Maps API key (section 7) |
| Payments stuck in demo | Razorpay keys not set in `backend/.env` |
