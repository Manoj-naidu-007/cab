import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, fontSize, radius, shadow, spacing } from "@/src/theme";

type ToastType = "success" | "error" | "info";
interface ToastState {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastState>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("info");
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string, t: ToastType = "info") => {
      setMessage(msg);
      setType(t);
      setVisible(true);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(
          () => setVisible(false),
        );
      }, 2800);
    },
    [opacity],
  );

  const bg = {
    success: colors.success,
    error: colors.error,
    info: colors.surfaceInverse,
  }[type];

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {visible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrap,
            { top: insets.top + spacing.md, opacity },
          ]}
        >
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={styles.toastText}>{message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    ...shadow,
    maxWidth: "100%",
  },
  toastText: {
    color: "#FFFFFF",
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    fontWeight: "600",
    textAlign: "center",
  },
});
