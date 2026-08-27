import React, { useState } from "react";
import { Image, StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, fonts, fontSize, spacing } from "@/src/theme";
import { Button, Input } from "@/src/components/ui";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";

const HERO =
  "https://images.unsplash.com/photo-1708884831398-b9b7cca1b2ba?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!phone || !password) {
      toast.show("Enter phone and password", "error");
      return;
    }
    setLoading(true);
    try {
      const user = await login(phone.trim(), password);
      toast.show(`Welcome back, ${user.name.split(" ")[0]}!`, "success");
      router.replace(user.role === "driver" ? "/driver" : "/passenger");
    } catch (e: any) {
      toast.show(e.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
          colors={["rgba(44,42,40,0.1)", "rgba(44,42,40,0.85)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="swap-horizontal" size={22} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.logoText}>ReturnRide</Text>
          </View>
          <Text style={styles.tagline}>
            Turn empty return trips into shared rides for your village.
          </Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to book or offer return rides</Text>

        <Input
          testID="login-phone-input"
          label="Phone number"
          placeholder="e.g. 9876543210"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Input
          testID="login-password-input"
          label="Password"
          placeholder="Your password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          testID="login-submit-button"
          label="Sign In"
          loading={loading}
          onPress={onLogin}
          style={{ marginTop: spacing.sm }}
        />

        <Pressable
          testID="go-to-register"
          onPress={() => router.push("/register")}
          style={styles.footerLink}
        >
          <Text style={styles.footerText}>
            New here? <Text style={styles.footerAccent}>Create an account</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceInverse },
  hero: { height: "42%", justifyContent: "flex-start" },
  heroContent: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "800", color: "#fff" },
  tagline: {
    fontFamily: fonts.display,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: "#fff",
    lineHeight: 32,
    marginBottom: spacing.xl,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetContent: { padding: spacing.xl, gap: spacing.md },
  title: { fontFamily: fonts.display, fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  footerLink: { alignItems: "center", paddingVertical: spacing.md },
  footerText: { fontFamily: fonts.text, fontSize: fontSize.lg, color: colors.onSurfaceSecondary },
  footerAccent: { color: colors.brandPrimary, fontWeight: "700" },
});
