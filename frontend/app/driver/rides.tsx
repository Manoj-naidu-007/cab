import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { Avatar, Card, EmptyState, StatusPill } from "@/src/components/ui";
import { api } from "@/src/api";

interface Booking {
  id: string;
  passenger_name: string;
  pickup_name: string;
  drop_name: string;
  fare: number;
  seats: number;
  status: string;
}
interface Ride {
  id: string;
  origin_name: string;
  dest_name: string;
  departure_time: string;
  seats_available: number;
  seats_total: number;
  per_seat_fare: number;
  status: string;
}

export default function DriverRides() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<"bookings" | "routes">("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([
        api.get<Booking[]>("/bookings/mine"),
        api.get<Ride[]>("/rides/mine"),
      ]);
      setBookings(b);
      setRides(r);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pendingCount = bookings.filter((b) => b.status === "requested").length;
  const timeStr = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>My Rides</Text>

      <View style={styles.tabs}>
        <Pressable
          testID="tab-bookings"
          onPress={() => setTab("bookings")}
          style={[styles.tab, tab === "bookings" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "bookings" && styles.tabTextActive]}>
            Requests {pendingCount > 0 ? `(${pendingCount})` : ""}
          </Text>
        </Pressable>
        <Pressable
          testID="tab-routes"
          onPress={() => setTab("routes")}
          style={[styles.tab, tab === "routes" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "routes" && styles.tabTextActive]}>My Routes</Text>
        </Pressable>
      </View>

      {tab === "bookings" ? (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                title="No ride requests yet"
                subtitle="Publish a return route and passenger requests will appear here."
                icon={<MaterialCommunityIcons name="account-clock-outline" size={56} color={colors.muted} />}
              />
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`booking-${item.id}`}
              onPress={() => router.push({ pathname: "/ride/[id]", params: { id: item.id } })}
            >
              <Card>
                <View style={styles.rowTop}>
                  <Avatar name={item.passenger_name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.passenger_name}</Text>
                    <Text style={styles.sub}>
                      {item.seats} seat{item.seats > 1 ? "s" : ""} • ₹{item.fare}
                    </Text>
                  </View>
                  <StatusPill status={item.status} />
                </View>
                <View style={styles.routeInline}>
                  <MaterialCommunityIcons name="map-marker" size={16} color={colors.brandPrimary} />
                  <Text style={styles.routeText}>{item.pickup_name}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={14} color={colors.muted} />
                  <MaterialCommunityIcons name="map-marker-check" size={16} color={colors.brandSecondary} />
                  <Text style={styles.routeText}>{item.drop_name}</Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(r) => r.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                title="No routes published"
                subtitle="Go to Publish tab to offer your empty return trip."
                icon={<MaterialCommunityIcons name="road-variant" size={56} color={colors.muted} />}
              />
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowTop}>
                <View style={styles.routeInline}>
                  <Text style={styles.name}>{item.origin_name}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={colors.muted} />
                  <Text style={styles.name}>{item.dest_name}</Text>
                </View>
                <StatusPill status={item.status} />
              </View>
              <View style={styles.routeFooter}>
                <Footer icon="clock-outline" text={timeStr(item.departure_time)} />
                <Footer icon="seat-passenger" text={`${item.seats_available}/${item.seats_total} left`} />
                <Footer icon="currency-inr" text={`${item.per_seat_fare}/seat`} />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

function Footer({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.footerBit}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.onSurfaceSecondary} />
      <Text style={styles.footerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { fontFamily: fonts.display, fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg },
  tabs: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  tabText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface },
  tabTextActive: { color: colors.onSurfaceInverse },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 40, flexGrow: 1 },
  emptyWrap: { flex: 1, justifyContent: "center", paddingTop: 60 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface },
  sub: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  routeInline: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, flexWrap: "wrap" },
  routeText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "600", color: colors.onSurface },
  routeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBit: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
});
