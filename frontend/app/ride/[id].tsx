import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter, Redirect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";
import { Avatar, Button, Card } from "@/src/components/ui";
import { RouteMap } from "@/src/components/RouteMap";
import { RazorpayCheckout, RazorpayOrder } from "@/src/components/RazorpayCheckout";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import { useVillages } from "@/src/hooks/useVillages";
import { useToast } from "@/src/components/Toast";

interface Booking {
  id: string;
  ride_id: string;
  passenger_id: string;
  passenger_name: string;
  passenger_phone: string;
  driver_id: string;
  driver_name: string;
  vehicle_type: string;
  pickup_village_id: string;
  pickup_name: string;
  drop_village_id: string;
  drop_name: string;
  seats: number;
  distance_km: number;
  fare: number;
  co2_saved_kg: number;
  payment_mode: string;
  payment_status: string;
  status: string;
  rated: boolean;
  driver_lat?: number;
  driver_lng?: number;
  scheduled_time?: string;
  recurring?: boolean;
  pool_applied?: boolean;
}

const STEPS = ["requested", "accepted", "en_route", "in_progress", "completed"];
const STEP_LABELS: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted",
  en_route: "On the way",
  in_progress: "On trip",
  completed: "Completed",
};

export default function RideTracking() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { byId } = useVillages();
  const toast = useToast();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [rateScore, setRateScore] = useState(5);
  const [rateComment, setRateComment] = useState("");
  const [payProvider, setPayProvider] = useState<"demo" | "razorpay">("demo");
  const [order, setOrder] = useState<RazorpayOrder | null>(null);
  const [rzpVisible, setRzpVisible] = useState(false);
  const [poolInfo, setPoolInfo] = useState<{ count: number; riders: any[] } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const isDriver = user?.role === "driver";

  const load = useCallback(async () => {
    try {
      const b = await api.get<Booking>(`/bookings/${id}`);
      setBooking(b);
      try {
        setPoolInfo(await api.get(`/bookings/${id}/pool`));
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    api
      .get<{ provider: "demo" | "razorpay" }>("/payments/config", false)
      .then((c) => setPayProvider(c.provider))
      .catch(() => setPayProvider("demo"));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      pollRef.current = setInterval(load, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load]),
  );

  // Driver shares live location while the ride is active.
  const bookingStatus = booking?.status;
  useEffect(() => {
    let active = true;
    const active_states = ["en_route", "in_progress"];
    async function start() {
      if (!isDriver || !bookingStatus || !active_states.includes(bookingStatus)) return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || !active) return;
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 30, timeInterval: 8000 },
        (loc) => {
          api
            .post(`/bookings/${id}/location`, { lat: loc.coords.latitude, lng: loc.coords.longitude })
            .catch(() => {});
        },
      );
    }
    start();
    return () => {
      active = false;
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [isDriver, bookingStatus, id]);

  const act = async (status: string, reason?: string) => {
    setActing(true);
    try {
      const updated = await api.post<Booking>(`/bookings/${id}/status`, { status, reason });
      setBooking(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.show(`Ride ${STEP_LABELS[status] || status}`, "success");
    } catch (e: any) {
      toast.show(e.message || "Action failed", "error");
    } finally {
      setActing(false);
    }
  };

  // Demo payment (fallback when Razorpay keys are not configured).
  const payDemo = async (mode: string) => {
    setActing(true);
    try {
      await api.post("/payments/demo", { booking_id: id, mode });
      setShowPay(false);
      await load();
      toast.show("Payment successful (demo)", "success");
    } catch (e: any) {
      toast.show(e.message || "Payment failed", "error");
    } finally {
      setActing(false);
    }
  };

  // Real Razorpay payment.
  const startRazorpay = async () => {
    setActing(true);
    try {
      const o = await api.post<RazorpayOrder>("/payments/order", { booking_id: id });
      setOrder(o);
      setShowPay(false);
      setRzpVisible(true);
    } catch (e: any) {
      toast.show(e.message || "Could not start payment", "error");
    } finally {
      setActing(false);
    }
  };

  const onRazorpaySuccess = async (resp: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    setRzpVisible(false);
    try {
      await api.post("/payments/verify", { booking_id: id, ...resp });
      await load();
      toast.show("Payment successful", "success");
    } catch (e: any) {
      toast.show(e.message || "Payment verification failed", "error");
    }
  };

  const submitRating = async () => {
    setActing(true);
    try {
      await api.post("/ratings", { booking_id: id, score: rateScore, comment: rateComment });
      setShowRate(false);
      await load();
      toast.show("Thanks for your feedback!", "success");
    } catch (e: any) {
      toast.show(e.message || "Could not submit", "error");
    } finally {
      setActing(false);
    }
  };

  if (!authLoading && !user) {
    return <Redirect href="/login" />;
  }

  if (loading || !booking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  const pickup = byId(booking.pickup_village_id);
  const drop = byId(booking.drop_village_id);
  const isActive = ["accepted", "en_route", "in_progress"].includes(booking.status);
  const showDriverLoc =
    !isDriver && isActive && typeof booking.driver_lat === "number" && typeof booking.driver_lng === "number";
  const points = [
    pickup && { lat: pickup.lat, lng: pickup.lng, label: booking.pickup_name, kind: "origin" as const },
    showDriverLoc && { lat: booking.driver_lat!, lng: booking.driver_lng!, label: "Driver", kind: "driver" as const },
    drop && { lat: drop.lat, lng: drop.lng, label: booking.drop_name, kind: "dest" as const },
  ].filter(Boolean) as any[];

  const stepIdx = STEPS.indexOf(booking.status);
  const otherName = isDriver ? booking.passenger_name : booking.driver_name;
  const otherPhone = booking.passenger_phone;

  const renderActions = () => {
    if (booking.status === "cancelled" || booking.status === "rejected") {
      return <Text style={styles.terminal}>This ride was {booking.status}.</Text>;
    }
    if (booking.status === "completed") {
      return (
        <View style={{ gap: spacing.md }}>
          {!isDriver && booking.payment_status !== "paid" && (
            <Button
              testID="pay-button"
              label={`Pay ₹${booking.fare}${payProvider === "razorpay" ? " with UPI / Card" : ""}`}
              loading={acting}
              onPress={() => (payProvider === "razorpay" ? startRazorpay() : setShowPay(true))}
            />
          )}
          {booking.payment_status === "paid" && (
            <View style={styles.paidRow}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
              <Text style={styles.paidText}>Payment complete • {booking.payment_mode.toUpperCase()}</Text>
            </View>
          )}
          {!booking.rated && (
            <Button
              testID="rate-button"
              label="Rate this ride"
              variant="outline"
              onPress={() => setShowRate(true)}
            />
          )}
        </View>
      );
    }
    if (isDriver) {
      if (booking.status === "requested") {
        return (
          <View style={{ gap: spacing.sm }}>
            <Button testID="accept-button" label="Accept Request" loading={acting} onPress={() => act("accepted")} />
            <Button testID="reject-button" label="Decline" variant="ghost" onPress={() => act("rejected")} />
          </View>
        );
      }
      if (booking.status === "accepted")
        return <Button testID="enroute-button" label="Start — I'm on the way" loading={acting} onPress={() => act("en_route")} />;
      if (booking.status === "en_route")
        return <Button testID="arrived-button" label="Passenger picked up" loading={acting} onPress={() => act("in_progress")} />;
      if (booking.status === "in_progress")
        return <Button testID="complete-button" label="Complete Ride" loading={acting} onPress={() => act("completed")} />;
    } else {
      if (["requested", "accepted"].includes(booking.status))
        return (
          <Button
            testID="cancel-button"
            label="Cancel Ride"
            variant="danger"
            loading={acting}
            onPress={() => act("cancelled", "Cancelled by passenger")}
          />
        );
      return <Text style={styles.waitText}>Your driver will update the ride status.</Text>;
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <RouteMap points={points} />
        <Pressable
          testID="ride-back"
          onPress={() => router.back()}
          style={[styles.backBtn, { top: insets.top + spacing.sm }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        {isActive && (
          <Pressable
            testID="sos-button"
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              Linking.openURL("tel:112").catch(() => toast.show("Could not open dialer", "error"));
            }}
            style={[styles.sosBtn, { top: insets.top + spacing.sm }]}
          >
            <MaterialCommunityIcons name="shield-alert" size={18} color={colors.onError} />
            <Text style={styles.sosText}>SOS</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
      >
        <View style={styles.handle} />

        {/* Stepper */}
        <View style={styles.stepper}>
          {STEPS.map((s, i) => {
            const done = i <= stepIdx;
            return (
              <React.Fragment key={s}>
                <View style={styles.stepCol}>
                  <View style={[styles.stepDot, done && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    {done && <MaterialCommunityIcons name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.stepLabel, done && { color: colors.onSurface, fontWeight: "700" }]}>
                    {STEP_LABELS[s]}
                  </Text>
                </View>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, i < stepIdx && { backgroundColor: colors.brandPrimary }]} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Person card */}
        <Card style={styles.personCard}>
          <Avatar name={otherName} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>{otherName}</Text>
            <Text style={styles.personSub}>
              {isDriver ? "Passenger" : booking.vehicle_type} • {booking.seats} seat{booking.seats > 1 ? "s" : ""}
            </Text>
          </View>
          {isDriver && (
            <Pressable
              testID="call-button"
              onPress={() => Linking.openURL(`tel:${otherPhone}`).catch(() => {})}
              style={styles.callBtn}
            >
              <MaterialCommunityIcons name="phone" size={22} color={colors.onSuccess} />
            </Pressable>
          )}
        </Card>

        {/* Route + fare */}
        <Card>
          <View style={styles.routeItem}>
            <View style={[styles.dot, { backgroundColor: colors.brandPrimary }]} />
            <Text style={styles.place}>{booking.pickup_name}</Text>
          </View>
          <View style={styles.vline} />
          <View style={styles.routeItem}>
            <View style={[styles.dot, { backgroundColor: colors.brandSecondary }]} />
            <Text style={styles.place}>{booking.drop_name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.fareRow}>
            <View style={styles.fareBit}>
              <Text style={styles.fareLabel}>Distance</Text>
              <Text style={styles.fareValue}>{booking.distance_km} km</Text>
            </View>
            <View style={styles.fareBit}>
              <Text style={styles.fareLabel}>CO₂ saved</Text>
              <Text style={[styles.fareValue, { color: colors.success }]}>{booking.co2_saved_kg} kg</Text>
            </View>
            <View style={styles.fareBit}>
              <Text style={styles.fareLabel}>Fare</Text>
              <Text style={[styles.fareValue, { color: colors.brandPrimary }]}>₹{booking.fare}</Text>
            </View>
          </View>
        </Card>

        {(booking.recurring || booking.pool_applied) && (
          <View style={styles.badgeRow}>
            {booking.recurring && (
              <View style={styles.miniBadge}>
                <MaterialCommunityIcons name="repeat" size={14} color={colors.brandSecondary} />
                <Text style={styles.miniBadgeText}>Daily commute</Text>
              </View>
            )}
            {booking.pool_applied && (
              <View style={styles.miniBadge}>
                <MaterialCommunityIcons name="tag-heart" size={14} color={colors.success} />
                <Text style={styles.miniBadgeText}>Pool discount applied</Text>
              </View>
            )}
          </View>
        )}

        {poolInfo && poolInfo.count > 1 && (
          <Card style={{ gap: spacing.sm }}>
            <View style={styles.poolHeader}>
              <MaterialCommunityIcons name="account-group" size={20} color={colors.brandPrimary} />
              <Text style={styles.poolTitle}>Shared with {poolInfo.count} riders</Text>
            </View>
            {poolInfo.riders.map((r: any, i: number) => (
              <View key={i} style={styles.poolRider}>
                <Avatar name={r.passenger_name} size={32} />
                <Text style={styles.poolRiderText} numberOfLines={1}>
                  {r.passenger_name} • {r.pickup_name} → {r.drop_name}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {renderActions()}
      </ScrollView>

      {order && (
        <RazorpayCheckout
          visible={rzpVisible}
          order={order}
          name={booking.passenger_name}
          contact={booking.passenger_phone}
          onSuccess={onRazorpaySuccess}
          onClose={() => setRzpVisible(false)}
        />
      )}

      {/* Payment modal */}
      <Modal visible={showPay} transparent animationType="fade" onRequestClose={() => setShowPay(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pay ₹{booking.fare}</Text>
            <Text style={styles.modalSub}>Choose a payment method (demo)</Text>
            {[
              { key: "upi", label: "UPI", icon: "cellphone" },
              { key: "cash", label: "Cash to driver", icon: "cash" },
              { key: "wallet", label: "ReturnRide Wallet", icon: "wallet" },
            ].map((m) => (
              <Pressable
                key={m.key}
                testID={`pay-${m.key}`}
                style={styles.payOption}
                onPress={() => payDemo(m.key)}
              >
                <MaterialCommunityIcons name={m.icon as any} size={24} color={colors.brandPrimary} />
                <Text style={styles.payOptionText}>{m.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
              </Pressable>
            ))}
            <Button label="Cancel" variant="ghost" onPress={() => setShowPay(false)} />
          </View>
        </View>
      </Modal>

      {/* Rating modal */}
      <Modal visible={showRate} transparent animationType="fade" onRequestClose={() => setShowRate(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rate your ride</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} testID={`star-${n}`} onPress={() => setRateScore(n)} hitSlop={6}>
                  <MaterialCommunityIcons
                    name={n <= rateScore ? "star" : "star-outline"}
                    size={40}
                    color={colors.brandSecondary}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              testID="rate-comment"
              placeholder="Add a comment (optional)"
              placeholderTextColor={colors.muted}
              value={rateComment}
              onChangeText={setRateComment}
              style={styles.commentInput}
              multiline
            />
            <Button testID="submit-rating" label="Submit" loading={acting} onPress={submitRating} />
            <Button label="Skip" variant="ghost" onPress={() => setShowRate(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  mapWrap: { height: "36%" },
  backBtn: {
    position: "absolute",
    left: spacing.lg,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(253,251,247,0.95)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  sosBtn: {
    position: "absolute",
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: 21,
    ...shadow,
  },
  sosText: { color: colors.onError, fontFamily: fonts.display, fontWeight: "800", fontSize: fontSize.base },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center" },
  stepper: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  stepCol: { alignItems: "center", width: 58 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, marginTop: 4, textAlign: "center" },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginTop: 10 },
  personCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  personName: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface },
  personSub: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  routeItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  vline: { width: 2, height: 18, backgroundColor: colors.border, marginLeft: 4 },
  place: { fontFamily: fonts.text, fontSize: fontSize.lg, fontWeight: "600", color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  fareRow: { flexDirection: "row", justifyContent: "space-between" },
  fareBit: { alignItems: "center", flex: 1 },
  fareLabel: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.muted },
  fareValue: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  terminal: { fontFamily: fonts.text, fontSize: fontSize.lg, color: colors.error, textAlign: "center" },
  waitText: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted, textAlign: "center" },
  paidRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  paidText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "600", color: colors.success },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  miniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  miniBadgeText: { fontFamily: fonts.text, fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurface },
  poolHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  poolTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface },
  poolRider: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  poolRiderText: { flex: 1, fontFamily: fonts.text, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  modalBg: { flex: 1, backgroundColor: "rgba(44,42,40,0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
  modalSub: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  payOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  payOptionText: { flex: 1, fontFamily: fonts.text, fontSize: fontSize.lg, fontWeight: "600", color: colors.onSurface },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginVertical: spacing.sm },
  commentInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 70,
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
});
