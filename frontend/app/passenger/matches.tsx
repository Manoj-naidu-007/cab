import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { Avatar, Button, Card, EmptyState } from "@/src/components/ui";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

interface Match {
  id: string;
  driver_name: string;
  driver_rating: number;
  vehicle_type: string;
  origin_name: string;
  dest_name: string;
  departure_time: string;
  seats_available: number;
  match_type: "exact" | "on_the_way";
  match_score: number;
  time_diff_min: number;
  leg_distance_km: number;
  one_way_fare: number;
  return_fare: number;
  you_save: number;
  co2_saved_kg: number;
}

export default function Matches() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    originId: string;
    destId: string;
    time: string;
    timeLabel: string;
  }>();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.post<Match[]>("/rides/match", {
        origin_village_id: params.originId,
        dest_village_id: params.destId,
        desired_time: params.time,
        seats: 1,
      });
      setMatches(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.originId, params.destId, params.time]);

  const onBook = async (m: Match) => {
    setBooking(m.id);
    try {
      const b = await api.post<{ id: string }>("/bookings", {
        ride_id: m.id,
        pickup_village_id: params.originId,
        drop_village_id: params.destId,
        seats: 1,
        payment_mode: "upi",
      });
      toast.show("Ride requested!", "success");
      router.replace({ pathname: "/ride/[id]", params: { id: b.id } });
    } catch (e: any) {
      toast.show(e.message || "Could not book", "error");
    } finally {
      setBooking(null);
    }
  };

  const timeStr = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="matches-back" onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Available return rides</Text>
          <Text style={styles.headerSub}>
            {matches.length} match{matches.length === 1 ? "" : "es"} • {params.timeLabel}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Finding return-trip matches…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <EmptyState title="Something went wrong" subtitle="Check your connection and try again." />
          <Button testID="matches-retry" label="Tap to Retry" variant="outline" onPress={load} />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title="No return rides yet"
            subtitle="No drivers are returning on this route right now. Try a different time or check back soon."
            icon={<MaterialCommunityIcons name="road-variant" size={56} color={colors.muted} />}
          />
          <Button testID="matches-back-empty" label="Change search" variant="outline" onPress={() => router.back()} />
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 40 }}
          renderItem={({ item }) => (
            <Card testID={`match-card-${item.id}`}>
              <View style={styles.cardTop}>
                <Avatar name={item.driver_name} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{item.driver_name}</Text>
                  <View style={styles.metaRow}>
                    <MaterialCommunityIcons name="star" size={14} color={colors.brandSecondary} />
                    <Text style={styles.metaText}>{item.driver_rating.toFixed(1)}</Text>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.metaText}>{item.vehicle_type}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.matchTag,
                    {
                      backgroundColor:
                        item.match_type === "exact" ? colors.success : colors.brandSecondary,
                    },
                  ]}
                >
                  <Text style={styles.matchTagText}>
                    {item.match_type === "exact" ? "Direct" : "On the way"}
                  </Text>
                </View>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.routeCol}>
                  <View style={[styles.dotMark, { backgroundColor: colors.brandPrimary }]} />
                  <Text style={styles.routeText}>{item.origin_name}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeCol}>
                  <View style={[styles.dotMark, { backgroundColor: colors.brandSecondary }]} />
                  <Text style={styles.routeText}>{item.dest_name}</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <InfoBit icon="clock-outline" label="Departs" value={timeStr(item.departure_time)} />
                <InfoBit icon="seat-passenger" label="Seats" value={`${item.seats_available} left`} />
                <InfoBit icon="map-marker-distance" label="Distance" value={`${item.leg_distance_km} km`} />
              </View>

              <View style={styles.fareRow}>
                <View>
                  <Text style={styles.strike}>₹{item.one_way_fare}</Text>
                  <Text style={styles.fare}>₹{item.return_fare}</Text>
                </View>
                <View style={styles.saveBadge}>
                  <MaterialCommunityIcons name="tag" size={14} color={colors.success} />
                  <Text style={styles.saveText}>Save ₹{item.you_save}</Text>
                </View>
                <Button
                  testID={`book-button-${item.id}`}
                  label="Book"
                  loading={booking === item.id}
                  onPress={() => onBook(item)}
                  style={{ paddingHorizontal: spacing.xl, minHeight: 46, borderRadius: radius.pill }}
                />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

function InfoBit({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoBit}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.onSurfaceSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface },
  headerSub: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  loadingText: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  driverName: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  dot: { color: colors.muted },
  matchTag: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  matchTagText: { fontFamily: fonts.text, fontSize: fontSize.sm, color: "#fff", fontWeight: "700" },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  routeCol: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  dotMark: { width: 10, height: 10, borderRadius: 5 },
  routeText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "600", color: colors.onSurface },
  routeLine: { width: 24, height: 2, backgroundColor: colors.border },
  infoGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg, gap: spacing.sm },
  infoBit: { flex: 1, alignItems: "center", gap: 2 },
  infoLabel: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.muted },
  infoValue: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface },
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  strike: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted, textDecorationLine: "line-through" },
  fare: { fontFamily: fonts.display, fontSize: fontSize["2xl"], fontWeight: "800", color: colors.brandPrimary },
  saveBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  saveText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "700", color: colors.success },
});
