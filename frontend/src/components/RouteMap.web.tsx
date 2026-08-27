import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, fontSize, spacing } from "@/src/theme";

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  kind?: "origin" | "dest" | "driver";
}

// Web fallback — react-native-maps does not render on web. Show a stylised
// route preview so the layout stays intact in the browser preview.
export function RouteMap({ points, style }: { points: MapPoint[]; style?: any }) {
  const origin = points.find((p) => p.kind === "origin") || points[0];
  const dest = points.find((p) => p.kind === "dest") || points[points.length - 1];
  return (
    <View style={[styles.container, style]}>
      <View style={styles.grid} />
      <View style={styles.routeRow}>
        <View style={styles.node}>
          <MaterialCommunityIcons name="map-marker" size={28} color={colors.brandPrimary} />
          <Text style={styles.nodeLabel} numberOfLines={1}>
            {origin?.label || "Origin"}
          </Text>
        </View>
        <View style={styles.line} />
        <MaterialCommunityIcons name="car" size={22} color={colors.info} />
        <View style={styles.line} />
        <View style={styles.node}>
          <MaterialCommunityIcons name="map-marker-check" size={28} color={colors.brandSecondary} />
          <Text style={styles.nodeLabel} numberOfLines={1}>
            {dest?.label || "Destination"}
          </Text>
        </View>
      </View>
      <Text style={styles.hint}>Live map view available on the mobile app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8EEE3",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: spacing.lg,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    borderColor: "#D2D8C9",
    borderWidth: 1,
    opacity: 0.5,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  node: { alignItems: "center", maxWidth: 110 },
  nodeLabel: {
    fontFamily: fonts.text,
    fontSize: fontSize.sm,
    color: colors.onSurface,
    fontWeight: "600",
    marginTop: 2,
  },
  line: { width: 28, height: 3, backgroundColor: colors.brandPrimary, borderRadius: 2 },
  hint: {
    marginTop: spacing.lg,
    fontFamily: fonts.text,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
});
