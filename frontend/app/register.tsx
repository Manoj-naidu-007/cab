import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { Button, Input } from "@/src/components/ui";
import { VillageField } from "@/src/components/VillagePicker";
import { useVillages, Village } from "@/src/hooks/useVillages";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";

type Role = "passenger" | "driver";
const VEHICLES = ["Auto", "Car", "Van", "Shared Jeep"];

export default function Register() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();
  const toast = useToast();
  const { villages } = useVillages();

  const [role, setRole] = useState<Role>("passenger");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [home, setHome] = useState<Village | null>(null);
  const [vehicleType, setVehicleType] = useState("Auto");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (!name || !phone || !password) {
      toast.show("Please fill name, phone and password", "error");
      return;
    }
    if (role === "driver" && !vehicleNumber) {
      toast.show("Enter your vehicle number", "error");
      return;
    }
    setLoading(true);
    try {
      const user = await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        role,
        home_village_id: home?.id ?? null,
        vehicle_type: role === "driver" ? vehicleType : null,
        vehicle_number: role === "driver" ? vehicleNumber.trim() : null,
      });
      toast.show("Account created!", "success");
      router.replace(user.role === "driver" ? "/driver" : "/passenger");
    } catch (e: any) {
      toast.show(e.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="register-back" onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Create account</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>I want to</Text>
        <View style={styles.roleRow}>
          <RoleCard
            testID="role-passenger"
            active={role === "passenger"}
            icon="account"
            title="Find a Ride"
            subtitle="Passenger"
            onPress={() => setRole("passenger")}
          />
          <RoleCard
            testID="role-driver"
            active={role === "driver"}
            icon="steering"
            title="Offer a Ride"
            subtitle="Driver"
            onPress={() => setRole("driver")}
          />
        </View>

        <Input testID="reg-name-input" label="Full name" placeholder="Your name" value={name} onChangeText={setName} />
        <Input
          testID="reg-phone-input"
          label="Phone number"
          placeholder="e.g. 9876543210"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Input
          testID="reg-password-input"
          label="Password"
          placeholder="Create a password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <VillageField
          testID="reg-home-village"
          label="Home village (optional)"
          placeholder="Select your village"
          value={home}
          onSelect={setHome}
          villages={villages}
        />

        {role === "driver" && (
          <>
            <Text style={styles.sectionLabel}>Vehicle type</Text>
            <View style={styles.vehicleRow}>
              {VEHICLES.map((v) => (
                <Pressable
                  key={v}
                  testID={`vehicle-${v}`}
                  onPress={() => setVehicleType(v)}
                  style={[
                    styles.vehicleChip,
                    vehicleType === v
                      ? { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse }
                      : { borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.vehicleText,
                      { color: vehicleType === v ? colors.onSurfaceInverse : colors.onSurface },
                    ]}
                  >
                    {v}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Input
              testID="reg-vehicle-number"
              label="Vehicle number"
              placeholder="e.g. KA25 AB 1234"
              autoCapitalize="characters"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
            />
          </>
        )}

        <Button
          testID="register-submit-button"
          label="Create Account"
          loading={loading}
          onPress={onRegister}
          style={{ marginTop: spacing.md }}
        />
        <View style={{ height: insets.bottom + spacing.lg }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

function RoleCard({
  active,
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  active: boolean;
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.roleCard,
        active
          ? { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }
          : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={30}
        color={active ? colors.onBrandPrimary : colors.brandPrimary}
      />
      <Text style={[styles.roleTitle, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.roleSub,
          { color: active ? "rgba(255,255,255,0.85)" : colors.muted },
        ]}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface },
  content: { padding: spacing.xl, gap: spacing.md },
  sectionLabel: {
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    marginTop: spacing.xs,
  },
  roleRow: { flexDirection: "row", gap: spacing.md },
  roleCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 110,
    justifyContent: "center",
  },
  roleTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700" },
  roleSub: { fontFamily: fonts.text, fontSize: fontSize.base },
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  vehicleChip: {
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  vehicleText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "600" },
});
