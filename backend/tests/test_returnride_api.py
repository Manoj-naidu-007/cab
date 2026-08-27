"""ReturnRide backend API test suite.
Covers: auth, villages, matching engine, driver publish, booking lifecycle,
payment demo, ratings, and stats.
"""
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone


BASE_URL = None  # set from fixture

# -----------------------------------------------------
# Auth
# -----------------------------------------------------
def _register(client, base_url, role="passenger", phone=None, name=None):
    phone = phone or f"9{str(uuid.uuid4().int)[:9]}"
    payload = {
        "name": name or f"TEST_{role}_{phone[-4:]}",
        "phone": phone,
        "password": "pass1234",
        "role": role,
    }
    if role == "driver":
        payload.update({"vehicle_type": "Auto", "vehicle_number": "KA00 T 0000"})
    r = client.post(f"{base_url}/api/auth/register", json=payload)
    return r, payload


class TestAuth:
    def test_register_passenger(self, api_client, base_url):
        r, payload = _register(api_client, base_url, "passenger")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and data["user"]["role"] == "passenger"
        assert data["user"]["phone"] == payload["phone"]
        pytest.passenger_token = data["access_token"]
        pytest.passenger_user = data["user"]
        pytest.passenger_phone = payload["phone"]
        pytest.passenger_password = payload["password"]

    def test_register_driver(self, api_client, base_url):
        r, payload = _register(api_client, base_url, "driver")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["role"] == "driver"
        pytest.driver_token = data["access_token"]
        pytest.driver_user = data["user"]

    def test_register_duplicate_returns_409(self, api_client, base_url):
        r, _ = _register(api_client, base_url, "passenger", phone=pytest.passenger_phone)
        assert r.status_code == 409

    def test_login_success(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                             json={"phone": pytest.passenger_phone, "password": pytest.passenger_password})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password_401(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                             json={"phone": pytest.passenger_phone, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me",
                            headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200
        assert r.json()["id"] == pytest.passenger_user["id"]

    def test_me_without_token_401(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_demo_driver_login(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                             json={"phone": "9000000001", "password": "demo1234"})
        assert r.status_code == 200, r.text
        pytest.demo_driver_token = r.json()["access_token"]
        pytest.demo_driver_user = r.json()["user"]


# -----------------------------------------------------
# Villages
# -----------------------------------------------------
class TestVillages:
    def test_list_villages_returns_seed(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/villages")
        assert r.status_code == 200
        villages = r.json()
        names = {v["name"] for v in villages}
        assert {"Hubballi", "Dharwad", "Kalghatgi"}.issubset(names)
        pytest.villages = {v["name"]: v for v in villages}


# -----------------------------------------------------
# Matching Engine
# -----------------------------------------------------
class TestMatching:
    def test_match_hubballi_kalghatgi(self, api_client, base_url):
        v = pytest.villages
        payload = {
            "origin_village_id": v["Hubballi"]["id"],
            "dest_village_id": v["Kalghatgi"]["id"],
            "desired_time": datetime.now(timezone.utc).isoformat(),
            "seats": 1,
        }
        r = api_client.post(f"{base_url}/api/rides/match", json=payload)
        assert r.status_code == 200, r.text
        matches = r.json()
        assert len(matches) >= 1, "Expected at least one match for Hubballi->Kalghatgi demo ride"
        m = matches[0]
        # validate fields
        for f in ["match_score", "match_type", "return_fare", "one_way_fare",
                  "you_save", "co2_saved_kg", "leg_distance_km"]:
            assert f in m, f"missing field {f}"
        assert m["match_type"] in ("exact", "on_the_way")
        assert m["return_fare"] < m["one_way_fare"], "return fare should be discounted"
        assert m["you_save"] >= 0
        assert m["co2_saved_kg"] > 0

    def test_match_exact_scores_highest(self, api_client, base_url):
        v = pytest.villages
        r = api_client.post(f"{base_url}/api/rides/match", json={
            "origin_village_id": v["Hubballi"]["id"],
            "dest_village_id": v["Kalghatgi"]["id"],
            "desired_time": datetime.now(timezone.utc).isoformat(),
            "seats": 1,
        })
        matches = r.json()
        # find the exact match
        exacts = [m for m in matches if m["match_type"] == "exact"]
        assert len(exacts) >= 1, "Expected an exact match for demo ride 1"
        # keep for booking test
        pytest.demo_match = exacts[0]

    def test_match_invalid_village(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/rides/match", json={
            "origin_village_id": "nope",
            "dest_village_id": "nope",
            "desired_time": datetime.now(timezone.utc).isoformat(),
            "seats": 1,
        })
        assert r.status_code == 400


# -----------------------------------------------------
# Driver publish
# -----------------------------------------------------
class TestPublishRide:
    def test_passenger_cannot_publish_403(self, api_client, base_url):
        v = pytest.villages
        payload = {
            "origin_village_id": v["Hubballi"]["id"],
            "dest_village_id": v["Dharwad"]["id"],
            "departure_time": datetime.now(timezone.utc).isoformat(),
            "time_flex_min": 60,
            "seats_total": 3,
            "vehicle_type": "Auto",
        }
        r = api_client.post(f"{base_url}/api/rides", json=payload,
                              headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 403

    def test_driver_publishes_ride(self, api_client, base_url):
        v = pytest.villages
        payload = {
            "origin_village_id": v["Hubballi"]["id"],
            "dest_village_id": v["Dharwad"]["id"],
            "departure_time": datetime.now(timezone.utc).isoformat(),
            "time_flex_min": 60,
            "seats_total": 3,
            "vehicle_type": "Auto",
        }
        r = api_client.post(f"{base_url}/api/rides", json=payload,
                              headers={"Authorization": f"Bearer {pytest.driver_token}"})
        assert r.status_code == 200, r.text
        ride = r.json()
        assert ride["status"] == "open"
        assert ride["seats_available"] == 3
        assert ride["distance_km"] > 0
        assert ride["per_seat_fare"] < ride["full_fare"], "return fare should have discount"
        pytest.published_ride = ride


# -----------------------------------------------------
# Booking lifecycle
# -----------------------------------------------------
class TestBookingLifecycle:
    def test_passenger_books_demo_ride(self, api_client, base_url):
        v = pytest.villages
        m = pytest.demo_match
        payload = {
            "ride_id": m["id"],
            "pickup_village_id": v["Hubballi"]["id"],
            "drop_village_id": v["Kalghatgi"]["id"],
            "seats": 1,
            "payment_mode": "upi",
        }
        r = api_client.post(f"{base_url}/api/bookings", json=payload,
                              headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "requested"
        assert b["fare"] > 0
        pytest.booking = b

    def test_driver_cannot_book_403(self, api_client, base_url):
        v = pytest.villages
        payload = {
            "ride_id": pytest.demo_match["id"],
            "pickup_village_id": v["Hubballi"]["id"],
            "drop_village_id": v["Kalghatgi"]["id"],
            "seats": 1,
        }
        r = api_client.post(f"{base_url}/api/bookings", json=payload,
                              headers={"Authorization": f"Bearer {pytest.driver_token}"})
        assert r.status_code == 403

    def test_bookings_mine_passenger(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/bookings/mine",
                            headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200
        assert any(b["id"] == pytest.booking["id"] for b in r.json())

    def test_bookings_mine_driver(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/bookings/mine",
                            headers={"Authorization": f"Bearer {pytest.demo_driver_token}"})
        assert r.status_code == 200
        # demo driver Ravi owns demo-ride-1
        assert any(b["id"] == pytest.booking["id"] for b in r.json())

    def test_get_booking_by_id(self, api_client, base_url):
        bid = pytest.booking["id"]
        r = api_client.get(f"{base_url}/api/bookings/{bid}",
                            headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200
        assert r.json()["id"] == bid

    def test_passenger_cannot_accept_403(self, api_client, base_url):
        bid = pytest.booking["id"]
        r = api_client.post(f"{base_url}/api/bookings/{bid}/status",
                              json={"status": "accepted"},
                              headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 403

    def test_driver_accepts_and_seat_decrements(self, api_client, base_url):
        bid = pytest.booking["id"]
        rid = pytest.booking["ride_id"]
        ride_before = requests.get(f"{base_url}/api/rides/{rid}",
                                     headers={"Authorization": f"Bearer {pytest.demo_driver_token}"}).json()
        seats_before = ride_before["seats_available"]
        r = api_client.post(f"{base_url}/api/bookings/{bid}/status",
                              json={"status": "accepted"},
                              headers={"Authorization": f"Bearer {pytest.demo_driver_token}"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "accepted"
        ride_after = requests.get(f"{base_url}/api/rides/{rid}",
                                    headers={"Authorization": f"Bearer {pytest.demo_driver_token}"}).json()
        assert ride_after["seats_available"] == seats_before - 1, \
            f"seat should decrement: {seats_before} -> {ride_after['seats_available']}"

    def test_invalid_transition_returns_400(self, api_client, base_url):
        bid = pytest.booking["id"]
        # jump accepted -> completed (invalid, should go en_route/in_progress first)
        r = api_client.post(f"{base_url}/api/bookings/{bid}/status",
                              json={"status": "completed"},
                              headers={"Authorization": f"Bearer {pytest.demo_driver_token}"})
        assert r.status_code == 400

    def test_lifecycle_progress(self, api_client, base_url):
        bid = pytest.booking["id"]
        for st in ["en_route", "in_progress", "completed"]:
            r = api_client.post(f"{base_url}/api/bookings/{bid}/status",
                                  json={"status": st},
                                  headers={"Authorization": f"Bearer {pytest.demo_driver_token}"})
            assert r.status_code == 200, f"transition to {st} failed: {r.text}"
            assert r.json()["status"] == st
        # After completion payment_status should be paid
        r = api_client.get(f"{base_url}/api/bookings/{bid}",
                            headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.json()["payment_status"] == "paid"


# -----------------------------------------------------
# Second booking to test payment/ratings/cancel
# -----------------------------------------------------
class TestSecondBookingForPayCancelRate:
    def _fresh_match(self, api_client, base_url):
        v = pytest.villages
        r = api_client.post(f"{base_url}/api/rides/match", json={
            "origin_village_id": v["Hubballi"]["id"],
            "dest_village_id": v["Kalghatgi"]["id"],
            "desired_time": datetime.now(timezone.utc).isoformat(),
            "seats": 1,
        })
        matches = [m for m in r.json() if m["match_type"] == "exact" and m["seats_available"] > 0]
        return matches[0] if matches else r.json()[0]

    def test_book_and_cancel_by_passenger(self, api_client, base_url):
        v = pytest.villages
        m = self._fresh_match(api_client, base_url)
        r = api_client.post(f"{base_url}/api/bookings", json={
            "ride_id": m["id"],
            "pickup_village_id": v["Hubballi"]["id"],
            "drop_village_id": v["Kalghatgi"]["id"],
            "seats": 1,
        }, headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200
        bid = r.json()["id"]
        r = api_client.post(f"{base_url}/api/bookings/{bid}/status",
                              json={"status": "cancelled", "reason": "test"},
                              headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"

    def test_payment_demo_marks_paid(self, api_client, base_url):
        # need a booking not yet paid: create + accept + but then pay before complete
        # Simpler: reuse the previously completed booking? payment_status already paid.
        # Instead create fresh, accept, then call demo pay
        v = pytest.villages
        m = self._fresh_match(api_client, base_url)
        r = api_client.post(f"{base_url}/api/bookings", json={
            "ride_id": m["id"],
            "pickup_village_id": v["Hubballi"]["id"],
            "drop_village_id": v["Kalghatgi"]["id"],
            "seats": 1,
        }, headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200
        bid = r.json()["id"]
        pytest.pay_booking_id = bid
        r = api_client.post(f"{base_url}/api/payments/demo",
                              json={"booking_id": bid, "mode": "upi"},
                              headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "paid"
        assert data["transaction_id"].startswith("DEMO-")
        # verify via GET
        rr = api_client.get(f"{base_url}/api/bookings/{bid}",
                             headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert rr.json()["payment_status"] == "paid"


# -----------------------------------------------------
# Ratings
# -----------------------------------------------------
class TestRatings:
    def test_rating_on_completed(self, api_client, base_url):
        bid = pytest.booking["id"]  # already completed
        r = api_client.post(f"{base_url}/api/ratings",
                              json={"booking_id": bid, "score": 5, "comment": "Great!"},
                              headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True

    def test_rating_on_incomplete_400(self, api_client, base_url):
        # pay_booking_id is only requested, not completed
        bid = pytest.pay_booking_id
        r = api_client.post(f"{base_url}/api/ratings",
                              json={"booking_id": bid, "score": 4},
                              headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 400


# -----------------------------------------------------
# Stats
# -----------------------------------------------------
class TestStats:
    def test_stats_passenger(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stats/me",
                            headers={"Authorization": f"Bearer {pytest.passenger_token}"})
        assert r.status_code == 200
        s = r.json()
        for f in ["total_rides", "co2_saved_kg", "money", "rating", "role"]:
            assert f in s
        assert s["role"] == "passenger"
        assert s["total_rides"] >= 1

    def test_stats_driver(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stats/me",
                            headers={"Authorization": f"Bearer {pytest.demo_driver_token}"})
        assert r.status_code == 200
        s = r.json()
        assert s["role"] == "driver"
