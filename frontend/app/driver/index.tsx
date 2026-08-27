import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { Button, Card } from "@/src/components/ui";
import { VillageField } from "@/src/components/VillagePicker";
import { useVillages, Village } from "@/src/hooks/useVillages";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api";

const TIME_OPTIONS = [
  { label: "Now", mins: 0 },
  { label: "In 30 min", mins: 30 },
  { label: "In 1 hr", mins: 60 },
  { label: "In 2 hrs", mins: 120 },
];

function haversine(a: Village, b: Village) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export default function DriverPublish() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { villages } = useVillages();

  const [origin, setOrigin] = useState<Village | null>(null);
  const [dest, setDest] = useState<Village | null>(null);
  const [timeIdx, setTimeIdx] = useState(0);
  const [seats, setSeats] = useState(3);
  const [womenOnly, setWomenOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const estimate = useMemo(() => {
    if (!origin || !dest) return null;
    const km = haversine(origin, dest);
    const oneWay = Math.round(20 + 12 * km);
    const fare = Math.round(oneWay * 0.75);
    const co2 = +(km * 0.121).toFixed(2);
    return { km: km.toFixed(1), fare, co2, oneWay };
  }, [origin, dest]);

  const onPublish = async () => {
    if (!origin || !dest) {
      toast.show("Choose origin and destination", "error");
      return;
    }
    if (origin.id === dest.id) {
      toast.show("Origin and destination can't be same", "error");
      return;
    }
    setLoading(true);
    try {
      const dt = new Date(Date.now() + TIME_OPTIONS[timeIdx].mins * 60000).toISOString();
      await api.post("/rides", {
        origin_village_id: origin.id,
        dest_village_id: dest.id,
        departure_time: dt,
        time_flex_min: 30,
        seats_total: seats,
        vehicle_type: user?.vehicle_type || "Auto",
        women_only: womenOnly,
      });
      toast.show("Return route published!", "success");
      setOrigin(null);
      setDest(null);
      router.push("/driver/rides");
    } catch (e: any) {
      toast.show(e.message || "Could not publish", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Publish return route</Text>
        <Text style={styles.subtitle}>Fill your empty leg back home</Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40, gap: spacing.md }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        {estimate && (
          <Card style={styles.carbonCard}>
            <View style={styles.carbonTop}>
              <MaterialCommunityIcons name="leaf" size={22} color={colors.success} />
              <Text style={styles.carbonTitle}>You&apos;ll save {estimate.co2} kg CO₂</Text>
            </View>
            <View style={styles.estRow}>
              <Est label="Distance" value={`${estimate.km} km`} />
              <Est label="Per seat" value={`₹${estimate.fare}`} />
              <Est label="Total (×3)" value={`₹${estimate.fare * seats}`} />
            </View>
          </Card>
        )}

        <VillageField
          testID="driver-origin"
          label="Starting from (drop-off town)"
          placeholder="Where are you returning from?"
          value={origin}
          onSelect={setOrigin}
          villages={villages}
          iconColor={colors.brandPrimary}
        />
        <VillageField
          testID="driver-dest"
          label="Returning to (your village)"
          placeholder="Your destination"
          value={dest}
          onSelect={setDest}
          villages={villages}
          iconColor={colors.brandSecondary}
        />

        <Text style={styles.label}>Departure</Text>
        <View style={styles.timeRow}>
          {TIME_OPTIONS.map((t, i) => (
            <Pressable
              key={t.label}
              testID={`driver-time-${i}`}
              onPress={() => setTimeIdx(i)}
              style={[
                styles.timeChip,
                timeIdx === i
                  ? { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse }
                  : { borderColor: colors.border },
              ]}
            >
              <Text style={[styles.timeText, { color: timeIdx === i ? colors.onSurfaceInverse : colors.onSurface }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Seats available</Text>
        <View style={styles.seatRow}>
          <Pressable
            testID="seat-minus"
            onPress={() => setSeats((s) => Math.max(1, s - 1))}
            style={styles.seatBtn}
          >
            <MaterialCommunityIcons name="minus" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.seatCount}>{seats}</Text>
          <Pressable
            testID="seat-plus"
            onPress={() => setSeats((s) => Math.min(8, s + 1))}
            style={styles.seatBtn}
          >
            <MaterialCommunityIcons name="plus" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Women-only ride</Text>
            <Text style={styles.toggleSub}>Only women passengers can book</Text>
          </View>
          <Switch
            testID="women-only-toggle"
            value={womenOnly}
            onValueChange={setWomenOnly}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            thumbColor="#fff"
          />
        </View>

        <Button
          testID="publish-button"
          label="Publish Route"
          loading={loading}
          onPress={onPublish}
          style={{ marginTop: spacing.md }}
          icon={<MaterialCommunityIcons name="broadcast" size={20} color={colors.onBrandPrimary} />}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

function Est({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={styles.estLabel}>{label}</Text>
      <Text style={styles.estValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface },
  subtitle: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  carbonCard: { backgroundColor: colors.brandTertiary, gap: spacing.md },
  carbonTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  carbonTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "800", color: colors.onBrandTertiary },
  estRow: { flexDirection: "row", justifyContent: "space-between" },
  estLabel: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  estValue: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  label: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "600", color: colors.onSurfaceSecondary, marginTop: spacing.xs },
  timeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  timeChip: { paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1.5 },
  timeText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "600" },
  seatRow: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
  seatBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  seatCount: { fontFamily: fonts.display, fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface, minWidth: 30, textAlign: "center" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.xs,
  },
  toggleLabel: { fontFamily: fonts.text, fontSize: fontSize.lg, fontWeight: "600", color: colors.onSurface },
  toggleSub: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
});
