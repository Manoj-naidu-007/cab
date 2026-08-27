import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, fonts, fontSize, spacing } from "@/src/theme";
import { Card, EmptyState, StatusPill } from "@/src/components/ui";
import { api } from "@/src/api";

interface Booking {
  id: string;
  origin_name?: string;
  pickup_name: string;
  drop_name: string;
  driver_name: string;
  vehicle_type: string;
  fare: number;
  seats: number;
  status: string;
  created_at: string;
}

export default function PassengerTrips() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Booking[]>("/bookings/mine");
      setBookings(data);
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

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>My Trips</Text>
      <FlatList
        data={bookings}
        keyExtractor={(b) => b.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 40, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: "center", paddingTop: 80 }}>
            <EmptyState
              title="No trips yet"
              subtitle="Book your first return ride from the Find Ride tab."
              icon={<MaterialCommunityIcons name="map-search-outline" size={56} color={colors.muted} />}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`trip-${item.id}`}
            onPress={() => router.push({ pathname: "/ride/[id]", params: { id: item.id } })}
          >
            <Card>
              <View style={styles.row}>
                <View style={styles.routeCol}>
                  <View style={styles.routeItem}>
                    <View style={[styles.dot, { backgroundColor: colors.brandPrimary }]} />
                    <Text style={styles.place}>{item.pickup_name}</Text>
                  </View>
                  <View style={styles.vline} />
                  <View style={styles.routeItem}>
                    <View style={[styles.dot, { backgroundColor: colors.brandSecondary }]} />
                    <Text style={styles.place}>{item.drop_name}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
                  <StatusPill status={item.status} />
                  <Text style={styles.fare}>₹{item.fare}</Text>
                </View>
              </View>
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {item.driver_name} • {item.vehicle_type}
                </Text>
                <View style={styles.viewLink}>
                  <Text style={styles.viewText}>View</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brandPrimary} />
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  routeCol: { flex: 1, gap: 2 },
  routeItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  vline: { width: 2, height: 16, backgroundColor: colors.border, marginLeft: 4 },
  place: { fontFamily: fonts.text, fontSize: fontSize.lg, fontWeight: "600", color: colors.onSurface },
  fare: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  viewLink: { flexDirection: "row", alignItems: "center" },
  viewText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "700", color: colors.brandPrimary },
});
