import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { Avatar, Button, Card } from "@/src/components/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";

interface Stats {
  total_rides: number;
  co2_saved_kg: number;
  money: number;
  rating: number;
  role: string;
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    try {
      setStats(await api.get<Stats>("/stats/me"));
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isDriver = user?.role === "driver";
  const moneyLabel = isDriver ? "Earned" : "Saved";

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.headerCard}>
        <Avatar name={user?.name} size={72} />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.roleBadge}>
          <MaterialCommunityIcons
            name={isDriver ? "steering" : "account"}
            size={16}
            color={colors.onBrandPrimary}
          />
          <Text style={styles.roleText}>{isDriver ? "Driver" : "Passenger"}</Text>
          {user?.verified && (
            <MaterialCommunityIcons name="check-decagram" size={16} color={colors.onBrandPrimary} />
          )}
        </View>
        {isDriver && user?.vehicle_number ? (
          <Text style={styles.vehicle}>
            {user.vehicle_type} • {user.vehicle_number}
          </Text>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <StatCard
          icon="star"
          value={(stats?.rating ?? user?.rating ?? 5).toFixed(1)}
          label="Rating"
          color={colors.brandSecondary}
        />
        <StatCard
          icon="car-multiple"
          value={String(stats?.total_rides ?? 0)}
          label="Rides"
          color={colors.info}
        />
        <StatCard
          icon="currency-inr"
          value={`₹${stats?.money ?? 0}`}
          label={moneyLabel}
          color={colors.brandPrimary}
        />
      </View>

      <Card style={styles.carbonCard}>
        <View style={styles.carbonIcon}>
          <MaterialCommunityIcons name="leaf" size={28} color={colors.onSuccess} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.carbonValue}>{stats?.co2_saved_kg ?? 0} kg CO₂ saved</Text>
          <Text style={styles.carbonSub}>
            By sharing empty return trips instead of driving empty.
          </Text>
        </View>
      </Card>

      <View style={styles.menu}>
        <MenuItem icon="shield-check-outline" label="Safety & SOS" />
        <MenuItem icon="translate" label="Language: English" />
        <MenuItem icon="help-circle-outline" label="Help & Support" />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <Button
          testID="logout-button"
          label="Log Out"
          variant="outline"
          onPress={onLogout}
          icon={<MaterialCommunityIcons name="logout" size={20} color={colors.brandPrimary} />}
        />
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  return (
    <Card style={styles.statCard}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function MenuItem({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.menuItem}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.onSurfaceSecondary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerCard: { alignItems: "center", gap: spacing.xs, paddingBottom: spacing.lg },
  name: { fontFamily: fonts.display, fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm },
  phone: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  roleText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "700", color: colors.onBrandPrimary },
  vehicle: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  statCard: { flex: 1, alignItems: "center", gap: 4, padding: spacing.md },
  statValue: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
  statLabel: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.muted },
  carbonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.brandTertiary,
  },
  carbonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  carbonValue: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "800", color: colors.onBrandTertiary },
  carbonSub: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.onSurfaceTertiary, marginTop: 2, lineHeight: 18 },
  menu: { marginTop: spacing.xl, marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLabel: { flex: 1, fontFamily: fonts.text, fontSize: fontSize.lg, color: colors.onSurface },
});
