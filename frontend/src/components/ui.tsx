import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fonts, fontSize, radius, shadowSoft, spacing } from "@/src/theme";

/* ----------------------------- Button ----------------------------- */
type BtnVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
}) {
  const bg = {
    primary: colors.brandPrimary,
    secondary: colors.brandSecondary,
    outline: "transparent",
    danger: colors.error,
    ghost: "transparent",
  }[variant];
  const fg = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandSecondary,
    outline: colors.brandPrimary,
    danger: colors.onError,
    ghost: colors.onSurface,
  }[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.();
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.88 : 1 },
        variant === "outline" && { borderWidth: 1.5, borderColor: colors.brandPrimary },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon}
          <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ----------------------------- Input ----------------------------- */
export function Input({
  label,
  error,
  containerStyle,
  ...props
}: TextInputProps & { label?: string; error?: string; containerStyle?: ViewStyle }) {
  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? { borderColor: colors.error } : null]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/* ----------------------------- Card ----------------------------- */
export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

/* ----------------------------- Avatar ----------------------------- */
export function Avatar({ name, size = 44 }: { name?: string; size?: number }) {
  const initials =
    (name || "?")
      .trim()
      .split(" ")
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

/* ----------------------------- Chip ----------------------------- */
export function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? colors.onSurfaceInverse : colors.onSurface },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ----------------------------- StatusPill ----------------------------- */
const STATUS_MAP: Record<string, { label: string; bg: string; fg: string }> = {
  requested: { label: "Requested", bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
  accepted: { label: "Accepted", bg: "#DCE6DC", fg: colors.success },
  en_route: { label: "Driver on the way", bg: "#F6E7C8", fg: "#8A6416" },
  in_progress: { label: "On trip", bg: "#F6E7C8", fg: "#8A6416" },
  completed: { label: "Completed", bg: "#DCE6DC", fg: colors.success },
  cancelled: { label: "Cancelled", bg: "#F2D9D9", fg: colors.error },
  rejected: { label: "Rejected", bg: "#F2D9D9", fg: colors.error },
  open: { label: "Open", bg: "#DCE6DC", fg: colors.success },
  full: { label: "Full", bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
};
export function StatusPill({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, bg: colors.surfaceTertiary, fg: colors.onSurface };
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

/* ----------------------------- Empty State ----------------------------- */
export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnLabel: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700" },
  inputLabel: {
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
  },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.text,
    fontSize: fontSize.lg,
    color: colors.onSurface,
  },
  errorText: { color: colors.error, fontSize: fontSize.base, fontFamily: fonts.text },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadowSoft,
  },
  avatar: {
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontWeight: "700", color: colors.onBrandTertiary },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "600" },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  statusText: { fontFamily: fonts.text, fontSize: fontSize.sm, fontWeight: "700" },
  empty: { alignItems: "center", justifyContent: "center", padding: spacing["2xl"], gap: spacing.sm },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.onSurface,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  },
});
