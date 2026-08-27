import React from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { colors } from "@/src/theme";

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  kind?: "origin" | "dest" | "driver";
}

export function RouteMap({
  points,
  style,
  showRoute = true,
}: {
  points: MapPoint[];
  style?: any;
  showRoute?: boolean;
}) {
  const valid = points.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
  const region =
    valid.length > 0
      ? {
          latitude: valid.reduce((s, p) => s + p.lat, 0) / valid.length,
          longitude: valid.reduce((s, p) => s + p.lng, 0) / valid.length,
          latitudeDelta: 0.6,
          longitudeDelta: 0.6,
        }
      : {
          latitude: 15.36,
          longitude: 75.12,
          latitudeDelta: 0.8,
          longitudeDelta: 0.8,
        };

  const pinColor = (kind?: string) =>
    kind === "origin" ? colors.brandPrimary : kind === "driver" ? colors.info : colors.brandSecondary;

  return (
    <View style={[styles.container, style]}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {valid.map((p, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.label}
            pinColor={pinColor(p.kind)}
          />
        ))}
        {showRoute && valid.length >= 2 && (
          <Polyline
            coordinates={valid.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={colors.brandPrimary}
            strokeWidth={4}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
});
