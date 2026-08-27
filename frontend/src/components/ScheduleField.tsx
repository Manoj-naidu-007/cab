import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

export interface ScheduleValue {
  iso: string;
  isNow: boolean;
  recurring: boolean;
  label: string;
}

const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

function fmtTime(h: number) {
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${suffix}`;
}

export function ScheduleField({
  label = "Departure time",
  value,
  onChange,
  showRecurring = true,
}: {
  label?: string;
  value: ScheduleValue;
  onChange: (v: ScheduleValue) => void;
  showRecurring?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"now" | "schedule">(value.isNow ? "now" : "schedule");
  const [dayOffset, setDayOffset] = useState(0);
  const [hour, setHour] = useState(new Date().getHours() + 1);
  const [recurring, setRecurring] = useState(value.recurring);

  const days = useMemo(() => {
    return [0, 1, 2].map((o) => {
      const d = new Date();
      d.setDate(d.getDate() + o);
      return {
        offset: o,
        label: o === 0 ? "Today" : o === 1 ? "Tomorrow" : d.toLocaleDateString([], { weekday: "short" }),
        sub: d.toLocaleDateString([], { day: "numeric", month: "short" }),
      };
    });
  }, []);

  const availableHours = useMemo(() => {
    if (dayOffset > 0) return HOURS;
    const nowH = new Date().getHours();
    return HOURS.filter((h) => h > nowH);
  }, [dayOffset]);

  const confirm = () => {
    if (mode === "now") {
      onChange({ iso: new Date().toISOString(), isNow: true, recurring: false, label: "Now" });
    } else {
      const d = new Date();
      d.setDate(d.getDate() + dayOffset);
      d.setHours(hour, 0, 0, 0);
      const dayLabel = days.find((x) => x.offset === dayOffset)?.label || "Today";
      onChange({
        iso: d.toISOString(),
        isNow: false,
        recurring,
        label: `${dayLabel}, ${fmtTime(hour)}${recurring ? " • Daily" : ""}`,
      });
    }
    setOpen(false);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable testID="schedule-field" style={styles.field} onPress={() => setOpen(true)}>
        <MaterialCommunityIcons name="clock-outline" size={22} color={colors.brandPrimary} />
        <Text style={styles.fieldText}>{value.label}</Text>
        {value.recurring && <MaterialCommunityIcons name="repeat" size={18} color={colors.brandSecondary} />}
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>When do you want to travel?</Text>

            <View style={styles.segment}>
              {(["now", "schedule"] as const).map((m) => (
                <Pressable
                  key={m}
                  testID={`schedule-mode-${m}`}
                  onPress={() => setMode(m)}
                  style={[styles.segBtn, mode === m && styles.segActive]}
                >
                  <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                    {m === "now" ? "Leave now" : "Schedule"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === "schedule" && (
              <>
                <Text style={styles.subLabel}>Day</Text>
                <View style={styles.dayRow}>
                  {days.map((d) => (
                    <Pressable
                      key={d.offset}
                      testID={`schedule-day-${d.offset}`}
                      onPress={() => setDayOffset(d.offset)}
                      style={[styles.dayChip, dayOffset === d.offset && styles.dayActive]}
                    >
                      <Text style={[styles.dayLabel, dayOffset === d.offset && styles.dayLabelActive]}>{d.label}</Text>
                      <Text style={[styles.daySub, dayOffset === d.offset && styles.dayLabelActive]}>{d.sub}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.subLabel}>Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
                  {availableHours.map((h) => (
                    <Pressable
                      key={h}
                      testID={`schedule-hour-${h}`}
                      onPress={() => setHour(h)}
                      style={[styles.timeChip, hour === h && styles.timeActive]}
                    >
                      <Text style={[styles.timeText, hour === h && styles.timeTextActive]}>{fmtTime(h)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {showRecurring && (
                  <View style={styles.recurRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recurLabel}>Daily commute</Text>
                      <Text style={styles.recurSub}>Repeat this trip every day</Text>
                    </View>
                    <Switch
                      testID="recurring-toggle"
                      value={recurring}
                      onValueChange={setRecurring}
                      trackColor={{ true: colors.brandPrimary, false: colors.border }}
                      thumbColor="#fff"
                    />
                  </View>
                )}
              </>
            )}

            <Pressable testID="schedule-confirm" style={styles.doneBtn} onPress={confirm}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export const NOW_SCHEDULE: ScheduleValue = {
  iso: new Date().toISOString(),
  isNow: true,
  recurring: false,
  label: "Now",
};

const styles = StyleSheet.create({
  label: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.onSurfaceSecondary, fontWeight: "600" },
  field: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  fieldText: { flex: 1, fontFamily: fonts.text, fontSize: fontSize.lg, color: colors.onSurface },
  backdrop: { flex: 1, backgroundColor: "rgba(44,42,40,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, gap: spacing.md },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center" },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4 },
  segBtn: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: colors.surfaceInverse },
  segText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface },
  segTextActive: { color: colors.onSurfaceInverse },
  subLabel: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "600", color: colors.onSurfaceSecondary },
  dayRow: { flexDirection: "row", gap: spacing.sm },
  dayChip: { flex: 1, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, alignItems: "center" },
  dayActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  dayLabel: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface },
  daySub: { fontFamily: fonts.text, fontSize: fontSize.sm, color: colors.muted },
  dayLabelActive: { color: colors.onSurfaceInverse },
  timeChip: { paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  timeActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  timeText: { fontFamily: fonts.text, fontSize: fontSize.base, fontWeight: "600", color: colors.onSurface },
  timeTextActive: { color: colors.onBrandPrimary },
  recurRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg },
  recurLabel: { fontFamily: fonts.text, fontSize: fontSize.lg, fontWeight: "600", color: colors.onSurface },
  recurSub: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted },
  doneBtn: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  doneText: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "700", color: colors.onBrandPrimary },
});
