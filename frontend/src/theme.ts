import { Platform } from "react-native";

// ReturnRide — earthy, accessible, rural-focused palette (Material You / Expressive light)
export const colors = {
  surface: "#FDFBF7",
  onSurface: "#2C2A28",
  surfaceSecondary: "#F2EBE1",
  onSurfaceSecondary: "#3E3B38",
  surfaceTertiary: "#E5DAC9",
  onSurfaceTertiary: "#4A4743",
  surfaceInverse: "#2C2A28",
  onSurfaceInverse: "#FDFBF7",

  brand: "#C1513A",
  brandPrimary: "#C1513A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#D49A36",
  onBrandSecondary: "#2C2A28",
  brandTertiary: "#D2D8C9",
  onBrandTertiary: "#2C2A28",

  success: "#477A47",
  onSuccess: "#FFFFFF",
  warning: "#D49A36",
  onWarning: "#2C2A28",
  error: "#B23A3A",
  onError: "#FFFFFF",
  info: "#6B8E6B",
  onInfo: "#FFFFFF",

  border: "#E5DAC9",
  borderStrong: "#C1513A",
  divider: "#E5DAC9",

  muted: "#8A857E",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
};

export const fonts = {
  display: "PlusJakartaSans",
  displayBold: "PlusJakartaSans",
  text: "Figtree",
};

export const shadow = Platform.select({
  ios: {
    shadowColor: "#2C2A28",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
  default: {},
}) as object;

export const shadowSoft = Platform.select({
  ios: {
    shadowColor: "#2C2A28",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  android: { elevation: 2 },
  default: {},
}) as object;
