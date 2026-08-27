import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, fonts, fontSize, radius, spacing, shadowSoft } from "@/src/theme";
import { Button, Card } from "@/src/components/ui";
import { RouteMap } from "@/src/components/RouteMap";
import { VillageField } from "@/src/components/VillagePicker";
import { useVillages, Village } from "@/src/hooks/useVillages";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";

const TIME_OPTIONS = [
  { label: "Now", mins: 0 },
  { label: "In 30 min", mins: 30 },
  { label: "In 1 hr", mins: 60 },
  { label: "In 2 hrs", mins: 120 },
];

export default function PassengerHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { villages } = useVillages();

  const [origin, setOrigin] = useState<Village | null>(null);
  const [dest, setDest] = useState<Village | null>(null);
  const [timeIdx, setTimeIdx] = useState(0);

  const points = useMemo(() => {
    const pts: any[] = [];
    if (origin) pts.push({ lat: origin.lat, lng: origin.lng, label: origin.name, kind: "origin" });
    if (dest) pts.push({ lat: dest.lat, lng: dest.lng, label: dest.name, kind: "dest" });
    return pts;
  }, [origin, dest]);

  const onFind = () => {
    if (!origin || !dest) {
      toast.show("Choose pickup and destination", "error");
      return;
    }
    if (origin.id === dest.id) {
      toast.show("Pickup and destination can't be same", "error");
      return;
    }
    const dt = new Date(Date.now() + TIME_OPTIONS[timeIdx].mins * 60000).toISOString();
    router.push({
      pathname: "/passenger/matches",
      params: { originId: origin.id, destId: dest.id, time: dt, timeLabel: TIME_OPTIONS[timeIdx].label },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <RouteMap points={points} />
        <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
          <Text style={styles.greeting}>
            Namaste, {user?.name?.split(" ")[0] || "traveller"} 👋
          </Text>
          <Text style={styles.greetingSub}>Find an affordable return ride</Text>
        </View>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>Where to?</Text>

        <VillageField
          testID="pickup-field"
          label="Pickup"
          placeholder="Your village / town"
          value={origin}
          onSelect={setOrigin}
          villages={villages}
          iconColor={colors.brandPrimary}
        />
        <VillageField
          testID="dropoff-field"
          label="Destination"
          placeholder="Where are you going?"
          value={dest}
          onSelect={setDest}
          villages={villages}
          iconColor={colors.brandSecondary}
        />

        <Text style={styles.label}>Departure time</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
        >
          {TIME_OPTIONS.map((t, i) => (
            <Text
              key={t.label}
              testID={`time-option-${i}`}
              onPress={() => setTimeIdx(i)}
              style={[
                styles.timeChip,
                timeIdx === i
                  ? { backgroundColor: colors.surfaceInverse, color: colors.onSurfaceInverse }
                  : { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.border, borderWidth: 1.5 },
              ]}
            >
              {t.label}
            </Text>
          ))}
        </ScrollView>

        <Button
          testID="find-rides-button"
          label="Find Return Rides"
          onPress={onFind}
          icon={<MaterialCommunityIcons name="magnify" size={20} color={colors.onBrandPrimary} />}
          style={{ marginTop: spacing.sm }}
        />

        <Card style={styles.infoCard}>
          <MaterialCommunityIcons name="leaf" size={22} color={colors.success} />
          <Text style={styles.infoText}>
            Return rides use a driver&apos;s empty trip back — cheaper for you and greener for the planet.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  mapWrap: { height: "34%" },
  topBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: "rgba(253,251,247,0.94)",
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadowSoft,
  },
  greeting: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface },
  greetingSub: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  sheetTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
  label: {
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    marginTop: spacing.xs,
  },
  timeChip: {
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    fontWeight: "600",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    marginTop: spacing.sm,
  },
  infoText: { flex: 1, fontFamily: fonts.text, fontSize: fontSize.base, color: colors.onBrandTertiary, lineHeight: 20 },
});
