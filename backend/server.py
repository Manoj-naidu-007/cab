from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import math
import logging
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import jwt
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'returnride-dev-secret-change-me')
JWT_ALG = 'HS256'
ACCESS_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

# Fare / carbon constants
BASE_FARE = 20.0          # flat pickup charge (INR)
RATE_PER_KM = 12.0        # INR per km one-way
RETURN_DISCOUNT = 0.25    # 25% off on the empty return leg
CO2_PER_KM = 0.121        # kg CO2 saved per km of filled empty leg

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("returnride")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def one_way_fare(distance_km: float) -> float:
    return round(BASE_FARE + RATE_PER_KM * distance_km)


def return_fare(distance_km: float) -> float:
    return round(one_way_fare(distance_km) * (1 - RETURN_DISCOUNT))


def normalize_phone(phone: str) -> str:
    v = (phone or "").strip().replace(" ", "").replace("-", "")
    digits = v[1:] if v.startswith("+") else v
    if not digits.isdigit() or not (7 <= len(digits) <= 15):
        raise HTTPException(400, "Enter a valid phone number")
    return v


def hash_password(p: str) -> str:
    return pwd_context.hash(p)


def verify_password(p: str, h: str) -> bool:
    try:
        return pwd_context.verify(p, h)
    except Exception:
        return False


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "iat": now_utc(),
        "exp": now_utc() + timedelta(days=ACCESS_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload["sub"]
    except (InvalidTokenError, KeyError):
        raise HTTPException(401, "Invalid or expired session")
    user = await db.users.find_one({"id": uid, "deleted_at": None}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User no longer exists")
    return user


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u.get("name", ""),
        "phone": u["phone"],
        "role": u["role"],
        "home_village_id": u.get("home_village_id"),
        "rating": u.get("rating", 5.0),
        "rides_count": u.get("rides_count", 0),
        "verified": u.get("verified", False),
        "vehicle_type": u.get("vehicle_type"),
        "vehicle_number": u.get("vehicle_number"),
    }


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    phone: str
    password: str = Field(min_length=4, max_length=128)
    role: Literal["passenger", "driver"]
    home_village_id: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None


class LoginIn(BaseModel):
    phone: str
    password: str


class PublishRideIn(BaseModel):
    origin_village_id: str
    dest_village_id: str
    departure_time: str          # ISO string
    time_flex_min: int = 30
    seats_total: int = Field(ge=1, le=8, default=3)
    vehicle_type: str = "Auto"
    notes: Optional[str] = None
    women_only: bool = False


class MatchIn(BaseModel):
    origin_village_id: str
    dest_village_id: str
    desired_time: str            # ISO string
    seats: int = 1


class BookIn(BaseModel):
    ride_id: str
    pickup_village_id: str
    drop_village_id: str
    seats: int = 1
    payment_mode: Literal["upi", "cash", "wallet"] = "upi"


class StatusIn(BaseModel):
    status: Literal["accepted", "rejected", "en_route", "in_progress", "completed", "cancelled"]
    reason: Optional[str] = None


class RatingIn(BaseModel):
    booking_id: str
    score: int = Field(ge=1, le=5)
    comment: Optional[str] = None


# ---------------------------------------------------------------------------
# Village seed data (rural corridor, Dharwad district Karnataka)
# ---------------------------------------------------------------------------
SEED_VILLAGES = [
    {"name": "Hubballi", "district": "Dharwad", "type": "town", "lat": 15.3647, "lng": 75.1240,
     "landmarks": ["Old Bus Stand", "Chennamma Circle", "Market"]},
    {"name": "Dharwad", "district": "Dharwad", "type": "town", "lat": 15.4589, "lng": 75.0078,
     "landmarks": ["Jubilee Circle", "University", "Court"]},
    {"name": "Kalghatgi", "district": "Dharwad", "type": "village", "lat": 15.1861, "lng": 74.9700,
     "landmarks": ["Bus Stand", "Hanuman Temple", "Weekly Market"]},
    {"name": "Alnavar", "district": "Dharwad", "type": "village", "lat": 15.4258, "lng": 74.7500,
     "landmarks": ["Railway Station", "Main Road", "Panchayat Office"]},
    {"name": "Kundgol", "district": "Dharwad", "type": "village", "lat": 15.2536, "lng": 75.2469,
     "landmarks": ["Bus Stand", "Shiroor Math", "Market"]},
    {"name": "Navalgund", "district": "Dharwad", "type": "village", "lat": 15.5606, "lng": 75.3600,
     "landmarks": ["Bus Stand", "Durgadevi Temple", "Cotton Market"]},
    {"name": "Annigeri", "district": "Dharwad", "type": "village", "lat": 15.4258, "lng": 75.4331,
     "landmarks": ["Amruteshwara Temple", "Bus Stand", "Main Chowk"]},
    {"name": "Uppinbetageri", "district": "Dharwad", "type": "village", "lat": 15.2833, "lng": 75.0500,
     "landmarks": ["Village Chowk", "School", "Temple"]},
    {"name": "Mugad", "district": "Dharwad", "type": "village", "lat": 15.4167, "lng": 74.9000,
     "landmarks": ["Forest Check Post", "Bus Stop", "Lake"]},
    {"name": "Tabakadhonni", "district": "Dharwad", "type": "village", "lat": 15.3200, "lng": 75.0800,
     "landmarks": ["Bus Stop", "Farm Road", "Temple"]},
]


async def seed_data():
    await db.users.create_index("phone", unique=True)
    if await db.villages.count_documents({}) == 0:
        docs = []
        for v in SEED_VILLAGES:
            docs.append({"id": new_id(), **v})
        await db.villages.insert_many(docs)
        logger.info("Seeded %d villages", len(docs))
    await seed_demo_rides()


DEMO_DRIVERS = [
    {"id": "demo-driver-ravi", "name": "Ravi Kumar", "phone": "9000000001",
     "vehicle_type": "Auto", "vehicle_number": "KA25 A 1122", "rating": 4.8},
    {"id": "demo-driver-suresh", "name": "Suresh Naik", "phone": "9000000002",
     "vehicle_type": "Car", "vehicle_number": "KA25 C 7788", "rating": 4.6},
    {"id": "demo-driver-mahesh", "name": "Mahesh Gowda", "phone": "9000000003",
     "vehicle_type": "Shared Jeep", "vehicle_number": "KA25 J 3344", "rating": 4.9},
]

# (origin_name, dest_name, driver_id, offset_minutes)
DEMO_RIDE_PLAN = [
    ("demo-ride-1", "Hubballi", "Kalghatgi", "demo-driver-ravi", 10, "Auto", 3),
    ("demo-ride-2", "Hubballi", "Kundgol", "demo-driver-suresh", 40, "Car", 3),
    ("demo-ride-3", "Dharwad", "Alnavar", "demo-driver-mahesh", 20, "Shared Jeep", 6),
    ("demo-ride-4", "Hubballi", "Navalgund", "demo-driver-suresh", 60, "Car", 3),
    ("demo-ride-5", "Dharwad", "Mugad", "demo-driver-ravi", 15, "Auto", 3),
]


async def seed_demo_rides():
    # Ensure demo driver accounts exist (idempotent).
    for d in DEMO_DRIVERS:
        await db.users.update_one(
            {"id": d["id"]},
            {"$setOnInsert": {
                "id": d["id"], "name": d["name"], "phone": d["phone"],
                "password_hash": hash_password("demo1234"), "role": "driver",
                "home_village_id": None, "vehicle_type": d["vehicle_type"],
                "vehicle_number": d["vehicle_number"], "rating": d["rating"],
                "rating_sum": d["rating"] * 10, "rating_count": 10, "rides_count": 42,
                "verified": True, "deleted_at": None, "created_at": now_utc().isoformat(),
            }},
            upsert=True,
        )

    villages = await db.villages.find({}, {"_id": 0}).to_list(200)
    by_name = {v["name"]: v for v in villages}
    drv = {d["id"]: d for d in DEMO_DRIVERS}

    for rid, oname, dname, did, offset, vtype, seats in DEMO_RIDE_PLAN:
        o, d = by_name.get(oname), by_name.get(dname)
        if not o or not d:
            continue
        dist = haversine_km(o["lat"], o["lng"], d["lat"], d["lng"])
        dep = (now_utc() + timedelta(minutes=offset)).isoformat()
        driver = drv[did]
        # Refresh demo rides on each boot so they stay bookable (no hard delete).
        await db.rides.update_one(
            {"id": rid},
            {"$set": {
                "id": rid, "driver_id": did, "driver_name": driver["name"],
                "driver_rating": driver["rating"], "vehicle_type": vtype,
                "vehicle_number": driver["vehicle_number"],
                "origin_village_id": o["id"], "origin_name": o["name"],
                "dest_village_id": d["id"], "dest_name": d["name"],
                "origin_lat": o["lat"], "origin_lng": o["lng"],
                "dest_lat": d["lat"], "dest_lng": d["lng"],
                "departure_time": dep, "time_flex_min": 180,
                "seats_total": seats, "seats_available": seats,
                "distance_km": round(dist, 1), "full_fare": one_way_fare(dist),
                "per_seat_fare": return_fare(dist), "women_only": False,
                "notes": "Returning after drop-off", "status": "open",
                "deleted_at": None, "created_at": now_utc().isoformat(),
            }},
            upsert=True,
        )
    logger.info("Seeded/refreshed %d demo rides", len(DEMO_RIDE_PLAN))


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(data: RegisterIn):
    phone = normalize_phone(data.phone)
    if await db.users.find_one({"phone": phone}):
        raise HTTPException(409, "Phone number already registered")
    user = {
        "id": new_id(),
        "name": data.name.strip(),
        "phone": phone,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "home_village_id": data.home_village_id,
        "vehicle_type": data.vehicle_type,
        "vehicle_number": data.vehicle_number,
        "rating": 5.0,
        "rating_sum": 5.0,
        "rating_count": 1,
        "rides_count": 0,
        "verified": data.role == "driver",
        "deleted_at": None,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    token = create_token(user)
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@api_router.post("/auth/login")
async def login(data: LoginIn):
    phone = normalize_phone(data.phone)
    user = await db.users.find_one({"phone": phone, "deleted_at": None})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid phone or password")
    token = create_token(user)
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)


@api_router.put("/auth/profile")
async def update_profile(body: dict, user=Depends(get_current_user)):
    allowed = {"name", "home_village_id", "vehicle_type", "vehicle_number"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(fresh)


# ---------------------------------------------------------------------------
# Villages
# ---------------------------------------------------------------------------
@api_router.get("/villages")
async def list_villages(q: Optional[str] = None):
    query = {}
    if q:
        query = {"name": {"$regex": q, "$options": "i"}}
    villages = await db.villages.find(query, {"_id": 0}).to_list(200)
    villages.sort(key=lambda v: (v["type"] != "town", v["name"]))
    return villages


async def get_village(vid: str) -> Optional[dict]:
    return await db.villages.find_one({"id": vid}, {"_id": 0})


# ---------------------------------------------------------------------------
# Rides (driver publishes empty return leg)
# ---------------------------------------------------------------------------
@api_router.post("/rides")
async def publish_ride(data: PublishRideIn, user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(403, "Only drivers can publish routes")
    origin = await get_village(data.origin_village_id)
    dest = await get_village(data.dest_village_id)
    if not origin or not dest:
        raise HTTPException(400, "Invalid villages")
    dist = haversine_km(origin["lat"], origin["lng"], dest["lat"], dest["lng"])
    ride = {
        "id": new_id(),
        "driver_id": user["id"],
        "driver_name": user.get("name"),
        "driver_rating": user.get("rating", 5.0),
        "vehicle_type": data.vehicle_type,
        "vehicle_number": user.get("vehicle_number"),
        "origin_village_id": origin["id"],
        "origin_name": origin["name"],
        "dest_village_id": dest["id"],
        "dest_name": dest["name"],
        "origin_lat": origin["lat"], "origin_lng": origin["lng"],
        "dest_lat": dest["lat"], "dest_lng": dest["lng"],
        "departure_time": data.departure_time,
        "time_flex_min": data.time_flex_min,
        "seats_total": data.seats_total,
        "seats_available": data.seats_total,
        "distance_km": round(dist, 1),
        "full_fare": one_way_fare(dist),
        "per_seat_fare": return_fare(dist),
        "women_only": data.women_only,
        "notes": data.notes,
        "status": "open",
        "deleted_at": None,
        "created_at": now_utc().isoformat(),
    }
    await db.rides.insert_one(ride)
    ride.pop("_id", None)
    return ride


@api_router.get("/rides/mine")
async def my_rides(user=Depends(get_current_user)):
    rides = await db.rides.find(
        {"driver_id": user["id"], "deleted_at": None}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return rides


@api_router.get("/rides/{ride_id}")
async def get_ride(ride_id: str, user=Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id, "deleted_at": None}, {"_id": 0})
    if not ride:
        raise HTTPException(404, "Ride not found")
    return ride


def project_on_route(ax, ay, bx, by, px, py):
    """Return (t, perp_km) where t is 0..1 projection fraction along A->B."""
    # use simple planar approx with lat/lng scaled
    dx, dy = (bx - ax), (by - ay)
    seg2 = dx * dx + dy * dy
    if seg2 == 0:
        return 0.0, haversine_km(ay, ax, py, px)
    t = ((px - ax) * dx + (py - ay) * dy) / seg2
    t_clamped = max(0.0, min(1.0, t))
    projx = ax + t_clamped * dx
    projy = ay + t_clamped * dy
    perp = haversine_km(py, px, projy, projx)
    return t, perp


CORRIDOR_KM = 6.0  # how far off-route a pickup can be to still be "on the way"


@api_router.post("/rides/match")
async def match_rides(data: MatchIn):
    px_o = await get_village(data.origin_village_id)
    px_d = await get_village(data.dest_village_id)
    if not px_o or not px_d:
        raise HTTPException(400, "Invalid villages")
    try:
        desired = datetime.fromisoformat(data.desired_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "Invalid time")

    rides = await db.rides.find(
        {"status": "open", "deleted_at": None, "seats_available": {"$gte": data.seats}},
        {"_id": 0},
    ).to_list(300)

    results = []
    for r in rides:
        ax, ay = r["origin_lng"], r["origin_lat"]
        bx, by = r["dest_lng"], r["dest_lat"]
        # passenger pickup/drop points
        ox, oy = px_o["lng"], px_o["lat"]
        dx, dy = px_d["lng"], px_d["lat"]

        exact = (r["origin_village_id"] == data.origin_village_id and
                 r["dest_village_id"] == data.dest_village_id)

        t_o, perp_o = project_on_route(ax, ay, bx, by, ox, oy)
        t_d, perp_d = project_on_route(ax, ay, bx, by, dx, dy)

        # must be roughly on the corridor and in correct direction (pickup before drop)
        on_route = perp_o <= CORRIDOR_KM and perp_d <= CORRIDOR_KM and (t_d - t_o) > 0.05
        if not (exact or on_route):
            continue

        # time fit
        try:
            dep = datetime.fromisoformat(r["departure_time"].replace("Z", "+00:00"))
        except ValueError:
            continue
        diff_min = abs((dep - desired).total_seconds()) / 60.0
        flex = max(r.get("time_flex_min", 30), 30)
        if diff_min > flex:
            continue
        time_score = 1.0 - (diff_min / flex)

        # route overlap score
        overlap = min(1.0, max(0.0, t_d - t_o)) if not exact else 1.0
        corridor_penalty = 1.0 - (max(perp_o, perp_d) / CORRIDOR_KM) * 0.4
        route_score = (1.0 if exact else 0.7) * overlap * corridor_penalty

        rating_score = r.get("driver_rating", 5.0) / 5.0

        # passenger leg distance & fare
        leg_km = haversine_km(oy, ox, dy, dx)
        seat_fare = return_fare(leg_km) if leg_km > 0.3 else r["per_seat_fare"]

        score = round(0.45 * route_score + 0.30 * time_score + 0.15 * rating_score + 0.10, 3)

        results.append({
            **r,
            "match_score": score,
            "match_type": "exact" if exact else "on_the_way",
            "time_diff_min": int(diff_min),
            "leg_distance_km": round(leg_km, 1),
            "one_way_fare": one_way_fare(leg_km),
            "return_fare": seat_fare,
            "you_save": one_way_fare(leg_km) - seat_fare,
            "co2_saved_kg": round(leg_km * CO2_PER_KM, 2),
            "pickup_name": px_o["name"],
            "drop_name": px_d["name"],
        })

    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Bookings (ride requests + lifecycle)
# ---------------------------------------------------------------------------
async def booking_view(b: dict) -> dict:
    b.pop("_id", None)
    return b


@api_router.post("/bookings")
async def create_booking(data: BookIn, user=Depends(get_current_user)):
    if user["role"] != "passenger":
        raise HTTPException(403, "Only passengers can book rides")
    ride = await db.rides.find_one({"id": data.ride_id, "deleted_at": None})
    if not ride or ride["status"] != "open":
        raise HTTPException(400, "Ride not available")
    if ride["seats_available"] < data.seats:
        raise HTTPException(400, "Not enough seats")

    pickup = await get_village(data.pickup_village_id)
    drop = await get_village(data.drop_village_id)
    leg_km = haversine_km(pickup["lat"], pickup["lng"], drop["lat"], drop["lng"])
    fare = (return_fare(leg_km) if leg_km > 0.3 else ride["per_seat_fare"]) * data.seats

    booking = {
        "id": new_id(),
        "ride_id": ride["id"],
        "passenger_id": user["id"],
        "passenger_name": user.get("name"),
        "passenger_phone": user.get("phone"),
        "driver_id": ride["driver_id"],
        "driver_name": ride.get("driver_name"),
        "vehicle_type": ride.get("vehicle_type"),
        "pickup_village_id": pickup["id"],
        "pickup_name": pickup["name"],
        "drop_village_id": drop["id"],
        "drop_name": drop["name"],
        "seats": data.seats,
        "distance_km": round(leg_km, 1),
        "fare": round(fare),
        "co2_saved_kg": round(leg_km * CO2_PER_KM * data.seats, 2),
        "payment_mode": data.payment_mode,
        "payment_status": "pending",
        "status": "requested",
        "rated": False,
        "cancel_reason": None,
        "deleted_at": None,
        "created_at": now_utc().isoformat(),
    }
    await db.bookings.insert_one(booking)
    return await booking_view(booking)


@api_router.get("/bookings/mine")
async def my_bookings(user=Depends(get_current_user)):
    field = "passenger_id" if user["role"] == "passenger" else "driver_id"
    bookings = await db.bookings.find(
        {field: user["id"], "deleted_at": None}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return bookings


@api_router.get("/rides/{ride_id}/requests")
async def ride_requests(ride_id: str, user=Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride or ride["driver_id"] != user["id"]:
        raise HTTPException(403, "Not your ride")
    reqs = await db.bookings.find(
        {"ride_id": ride_id, "deleted_at": None}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return reqs


@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id, "deleted_at": None}, {"_id": 0})
    if not b or user["id"] not in (b["passenger_id"], b["driver_id"]):
        raise HTTPException(404, "Booking not found")
    return b


VALID_TRANSITIONS = {
    "requested": {"accepted", "rejected", "cancelled"},
    "accepted": {"en_route", "cancelled"},
    "en_route": {"in_progress", "cancelled"},
    "in_progress": {"completed"},
}


@api_router.post("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, body: StatusIn, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id, "deleted_at": None})
    if not b or user["id"] not in (b["passenger_id"], b["driver_id"]):
        raise HTTPException(404, "Booking not found")

    new_status = body.status
    cur = b["status"]
    if new_status not in VALID_TRANSITIONS.get(cur, set()):
        raise HTTPException(400, f"Cannot move from {cur} to {new_status}")

    # authorization per action
    if new_status in {"accepted", "rejected", "en_route", "in_progress", "completed"}:
        if user["role"] != "driver" or user["id"] != b["driver_id"]:
            raise HTTPException(403, "Only the driver can do this")

    updates = {"status": new_status}
    if body.reason:
        updates["cancel_reason"] = body.reason

    # seat management
    ride = await db.rides.find_one({"id": b["ride_id"]})
    if new_status == "accepted" and ride:
        new_avail = max(0, ride["seats_available"] - b["seats"])
        ride_status = "full" if new_avail == 0 else "open"
        await db.rides.update_one({"id": ride["id"]},
                                  {"$set": {"seats_available": new_avail, "status": ride_status}})
    if new_status in {"rejected", "cancelled"} and cur == "accepted" and ride:
        await db.rides.update_one({"id": ride["id"]},
                                  {"$inc": {"seats_available": b["seats"]},
                                   "$set": {"status": "open"}})
    if new_status == "completed":
        updates["payment_status"] = "paid"
        await db.users.update_one({"id": b["driver_id"]}, {"$inc": {"rides_count": 1}})
        await db.users.update_one({"id": b["passenger_id"]}, {"$inc": {"rides_count": 1}})

    await db.bookings.update_one({"id": booking_id}, {"$set": updates})
    fresh = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return fresh


@api_router.post("/payments/demo")
async def demo_payment(body: dict, user=Depends(get_current_user)):
    booking_id = body.get("booking_id")
    b = await db.bookings.find_one({"id": booking_id, "deleted_at": None})
    if not b or b["passenger_id"] != user["id"]:
        raise HTTPException(404, "Booking not found")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"payment_status": "paid", "payment_mode": body.get("mode", b["payment_mode"])}},
    )
    return {"success": True, "transaction_id": f"DEMO-{new_id()[:8].upper()}",
            "amount": b["fare"], "status": "paid"}


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------
@api_router.post("/ratings")
async def rate(data: RatingIn, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": data.booking_id, "deleted_at": None})
    if not b or user["id"] not in (b["passenger_id"], b["driver_id"]):
        raise HTTPException(404, "Booking not found")
    if b["status"] != "completed":
        raise HTTPException(400, "Can only rate completed rides")

    rated_user_id = b["driver_id"] if user["id"] == b["passenger_id"] else b["passenger_id"]
    await db.ratings.insert_one({
        "id": new_id(), "booking_id": data.booking_id, "rated_by": user["id"],
        "rated_user": rated_user_id, "score": data.score, "comment": data.comment,
        "created_at": now_utc().isoformat(),
    })
    await db.bookings.update_one({"id": data.booking_id}, {"$set": {"rated": True}})

    ru = await db.users.find_one({"id": rated_user_id})
    new_sum = ru.get("rating_sum", 5.0) + data.score
    new_count = ru.get("rating_count", 1) + 1
    await db.users.update_one({"id": rated_user_id}, {"$set": {
        "rating_sum": new_sum, "rating_count": new_count,
        "rating": round(new_sum / new_count, 2)}})
    return {"success": True}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------
@api_router.get("/stats/me")
async def my_stats(user=Depends(get_current_user)):
    field = "passenger_id" if user["role"] == "passenger" else "driver_id"
    bookings = await db.bookings.find(
        {field: user["id"], "status": "completed", "deleted_at": None}, {"_id": 0}
    ).to_list(1000)
    total_rides = len(bookings)
    co2 = round(sum(b.get("co2_saved_kg", 0) for b in bookings), 1)
    if user["role"] == "driver":
        money = sum(b.get("fare", 0) for b in bookings)
    else:
        # savings for passenger
        money = 0
        for b in bookings:
            money += round(one_way_fare(b.get("distance_km", 0)) - b.get("fare", 0))
    return {
        "total_rides": total_rides,
        "co2_saved_kg": co2,
        "money": round(money),
        "rating": user.get("rating", 5.0),
        "role": user["role"],
    }


# ---------------------------------------------------------------------------
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed_data()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
