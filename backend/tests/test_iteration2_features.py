"""ReturnRide iteration 2 feature tests.
Covers: Razorpay config gate, pooling backend, pool roster access, advance booking
scheduled_time/recurring, and live driver location updates.
"""
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta


# -----------------------------------------------------
# helpers
# -----------------------------------------------------
def _register(api_client, base_url, role="passenger", phone=None):
    phone = phone or f"9{str(uuid.uuid4().int)[:9]}"
    payload = {
        "name": f"TEST_{role}_{phone[-4:]}",
        "phone": phone,
        "password": "pass1234",
        "role": role,
    }
    if role == "driver":
        payload.update({"vehicle_type": "Auto", "vehicle_number": "KA00 T 9999"})
    r = api_client.post(f"{base_url}/api/auth/register", json=payload)
    return r, payload


def _login_demo_driver(api_client, base_url, phone="9000000001"):
    r = api_client.post(f"{base_url}/api/auth/login",
                        json={"phone": phone, "password": "demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


def _villages(api_client, base_url):
    r = api_client.get(f"{base_url}/api/villages")
    assert r.status_code == 200
    return {v["name"]: v for v in r.json()}


def _find_exact_match(api_client, base_url, villages, origin="Hubballi", dest="Kalghatgi"):
    r = api_client.post(f"{base_url}/api/rides/match", json={
        "origin_village_id": villages[origin]["id"],
        "dest_village_id": villages[dest]["id"],
        "desired_time": datetime.now(timezone.utc).isoformat(),
        "seats": 1,
    })
    assert r.status_code == 200, r.text
    matches = [m for m in r.json() if m["match_type"] == "exact" and m["seats_available"] > 0]
    return matches[0] if matches else r.json()[0]


# -----------------------------------------------------
# 1. Payments config gate
# -----------------------------------------------------
class TestPaymentsConfig:
    def test_config_reports_demo_when_keys_absent(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/payments/config")
        assert r.status_code == 200
        data = r.json()
        assert data["provider"] == "demo"
        assert data["enabled"] is False
        assert data.get("key_id") in (None, "")

    def test_order_returns_400_when_not_configured(self, api_client, base_url):
        # need a booking to hit auth path; register + book something first
        r, _ = _register(api_client, base_url, "passenger")
        token = r.json()["access_token"]
        villages = _villages(api_client, base_url)
        m = _find_exact_match(api_client, base_url, villages)
        rb = api_client.post(f"{base_url}/api/bookings", json={
            "ride_id": m["id"],
            "pickup_village_id": villages["Hubballi"]["id"],
            "drop_village_id": villages["Kalghatgi"]["id"],
            "seats": 1,
        }, headers={"Authorization": f"Bearer {token}"})
        assert rb.status_code == 200, rb.text
        bid = rb.json()["id"]
        pytest.itr2_pay_booking = bid
        pytest.itr2_pay_token = token
        r = api_client.post(f"{base_url}/api/payments/order",
                            json={"booking_id": bid},
                            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 400, r.text

    def test_verify_returns_400_when_not_configured(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/payments/verify", json={
            "booking_id": pytest.itr2_pay_booking,
            "razorpay_order_id": "order_xxx",
            "razorpay_payment_id": "pay_xxx",
            "razorpay_signature": "sig_xxx",
        }, headers={"Authorization": f"Bearer {pytest.itr2_pay_token}"})
        assert r.status_code == 400

    def test_demo_payment_still_works(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/payments/demo",
                            json={"booking_id": pytest.itr2_pay_booking, "mode": "upi"},
                            headers={"Authorization": f"Bearer {pytest.itr2_pay_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "paid"
        assert data["transaction_id"].startswith("DEMO-")
        # verify persistence
        rr = api_client.get(f"{base_url}/api/bookings/{pytest.itr2_pay_booking}",
                            headers={"Authorization": f"Bearer {pytest.itr2_pay_token}"})
        assert rr.json()["payment_status"] == "paid"


# -----------------------------------------------------
# 2. Pooling backend + roster + advance booking + live loc
# -----------------------------------------------------
class TestPoolingAndAdvanceAndLocation:
    def test_setup_first_rider_accepted(self, api_client, base_url):
        # first passenger books + demo driver accepts to create "others" > 0
        r, _ = _register(api_client, base_url, "passenger")
        p1_token = r.json()["access_token"]
        p1_user = r.json()["user"]
        villages = _villages(api_client, base_url)
        m = _find_exact_match(api_client, base_url, villages)
        rb = api_client.post(f"{base_url}/api/bookings", json={
            "ride_id": m["id"],
            "pickup_village_id": villages["Hubballi"]["id"],
            "drop_village_id": villages["Kalghatgi"]["id"],
            "seats": 1,
            "want_pool": True,
        }, headers={"Authorization": f"Bearer {p1_token}"})
        assert rb.status_code == 200, rb.text
        b1 = rb.json()
        assert b1["want_pool"] is True
        # NOTE: earlier test runs may have left accepted bookings on the demo ride
        # (seats reset on startup but bookings persist), so pool_applied may be
        # True or False depending on state — just assert the field exists.
        assert "pool_applied" in b1

        driver_token, _ = _login_demo_driver(api_client, base_url)
        ra = api_client.post(f"{base_url}/api/bookings/{b1['id']}/status",
                             json={"status": "accepted"},
                             headers={"Authorization": f"Bearer {driver_token}"})
        assert ra.status_code == 200, ra.text
        assert ra.json()["status"] == "accepted"

        pytest.itr2_villages = villages
        pytest.itr2_ride_id = m["id"]
        pytest.itr2_p1 = {"token": p1_token, "user": p1_user, "booking_id": b1["id"]}
        pytest.itr2_driver_token = driver_token

    def test_match_shows_shared_and_pool_fare(self, api_client, base_url):
        villages = pytest.itr2_villages
        r = api_client.post(f"{base_url}/api/rides/match", json={
            "origin_village_id": villages["Hubballi"]["id"],
            "dest_village_id": villages["Kalghatgi"]["id"],
            "desired_time": datetime.now(timezone.utc).isoformat(),
            "seats": 1,
        })
        assert r.status_code == 200
        matches = [m for m in r.json() if m["id"] == pytest.itr2_ride_id]
        assert matches, "expected demo ride in matches after booking"
        m = matches[0]
        assert m["is_shared"] is True, m
        assert m["others_joined"] >= 1
        # pool fare must be round(return_fare * 0.88)
        expected_pool = round(m["return_fare"] * 0.88)
        assert m["pool_fare"] == expected_pool, (m["return_fare"], m["pool_fare"], expected_pool)
        assert m["you_save"] == m["one_way_fare"] - m["pool_fare"]

    def test_second_rider_gets_pool_discount(self, api_client, base_url):
        villages = pytest.itr2_villages
        r, _ = _register(api_client, base_url, "passenger")
        p2_token = r.json()["access_token"]
        p2_user = r.json()["user"]
        # book with want_pool=true, scheduled_time (advance booking) + recurring
        scheduled = (datetime.now(timezone.utc) + timedelta(minutes=45)).isoformat()
        rb = api_client.post(f"{base_url}/api/bookings", json={
            "ride_id": pytest.itr2_ride_id,
            "pickup_village_id": villages["Hubballi"]["id"],
            "drop_village_id": villages["Kalghatgi"]["id"],
            "seats": 1,
            "want_pool": True,
            "scheduled_time": scheduled,
            "recurring": True,
        }, headers={"Authorization": f"Bearer {p2_token}"})
        assert rb.status_code == 200, rb.text
        b2 = rb.json()
        # advance booking fields persisted
        assert b2["scheduled_time"] == scheduled
        assert b2["recurring"] is True
        # pooling applied because at least one accepted rider exists
        assert b2["pool_applied"] is True, b2
        assert b2["fare"] > 0
        pytest.itr2_p2 = {"token": p2_token, "user": p2_user, "booking_id": b2["id"]}

    def test_want_pool_false_skips_discount(self, api_client, base_url):
        villages = pytest.itr2_villages
        r, _ = _register(api_client, base_url, "passenger")
        token = r.json()["access_token"]
        rb = api_client.post(f"{base_url}/api/bookings", json={
            "ride_id": pytest.itr2_ride_id,
            "pickup_village_id": villages["Hubballi"]["id"],
            "drop_village_id": villages["Kalghatgi"]["id"],
            "seats": 1,
            "want_pool": False,
        }, headers={"Authorization": f"Bearer {token}"})
        assert rb.status_code == 200, rb.text
        b = rb.json()
        assert b["want_pool"] is False
        assert b["pool_applied"] is False

    # pool roster access
    def test_pool_roster_accessible_to_participant(self, api_client, base_url):
        bid = pytest.itr2_p1["booking_id"]
        r = api_client.get(f"{base_url}/api/bookings/{bid}/pool",
                           headers={"Authorization": f"Bearer {pytest.itr2_p1['token']}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] >= 1
        assert isinstance(data["riders"], list)
        # roster projections should NOT include _id
        assert all("_id" not in rd for rd in data["riders"])

    def test_pool_roster_accessible_to_driver(self, api_client, base_url):
        bid = pytest.itr2_p1["booking_id"]
        r = api_client.get(f"{base_url}/api/bookings/{bid}/pool",
                           headers={"Authorization": f"Bearer {pytest.itr2_driver_token}"})
        assert r.status_code == 200

    def test_pool_roster_forbidden_for_non_participant(self, api_client, base_url):
        # a random third passenger who is not on this booking
        r, _ = _register(api_client, base_url, "passenger")
        outsider_token = r.json()["access_token"]
        bid = pytest.itr2_p1["booking_id"]
        r = api_client.get(f"{base_url}/api/bookings/{bid}/pool",
                           headers={"Authorization": f"Bearer {outsider_token}"})
        assert r.status_code == 404, r.text  # server returns 404 to hide existence

    # live location
    def test_location_update_by_driver_succeeds(self, api_client, base_url):
        bid = pytest.itr2_p1["booking_id"]
        r = api_client.post(f"{base_url}/api/bookings/{bid}/location",
                            json={"lat": 15.3647, "lng": 75.1240},
                            headers={"Authorization": f"Bearer {pytest.itr2_driver_token}"})
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True
        # verify persistence
        rb = api_client.get(f"{base_url}/api/bookings/{bid}",
                            headers={"Authorization": f"Bearer {pytest.itr2_p1['token']}"})
        b = rb.json()
        assert b.get("driver_lat") == 15.3647
        assert b.get("driver_lng") == 75.1240
        assert b.get("driver_loc_at")

    def test_location_update_by_passenger_forbidden(self, api_client, base_url):
        bid = pytest.itr2_p1["booking_id"]
        r = api_client.post(f"{base_url}/api/bookings/{bid}/location",
                            json={"lat": 15.0, "lng": 75.0},
                            headers={"Authorization": f"Bearer {pytest.itr2_p1['token']}"})
        assert r.status_code == 403

    def test_advance_booking_matches_within_flex(self, api_client, base_url):
        # matching still works for a future desired_time within the ride's flex window
        villages = pytest.itr2_villages
        future = (datetime.now(timezone.utc) + timedelta(minutes=90)).isoformat()
        r = api_client.post(f"{base_url}/api/rides/match", json={
            "origin_village_id": villages["Hubballi"]["id"],
            "dest_village_id": villages["Kalghatgi"]["id"],
            "desired_time": future,
            "seats": 1,
        })
        assert r.status_code == 200
        # demo ride has flex 180 min -> should still match
        ids = [m["id"] for m in r.json()]
        assert pytest.itr2_ride_id in ids, ids
