import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { Village } from "@/src/hooks/useVillages";

export function VillageField({
  label,
  value,
  placeholder,
  onSelect,
  villages,
  testID,
  iconColor = colors.brandPrimary,
}: {
  label: string;
  value?: Village | null;
  placeholder: string;
  onSelect: (v: Village) => void;
  villages: Village[];
  testID?: string;
  iconColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const list = q
      ? villages.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()))
      : villages;
    return list;
  }, [q, villages]);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        style={styles.field}
        onPress={() => setOpen(true)}
      >
        <MaterialCommunityIcons name="map-marker" size={22} color={iconColor} />
        <Text
          style={[styles.fieldText, { color: value ? colors.onSurface : colors.muted }]}
          numberOfLines={1}
        >
          {value ? `${value.name}` : placeholder}
        </Text>
        {value ? (
          <Text style={styles.tag}>{value.type === "town" ? "Town" : "Village"}</Text>
        ) : (
          <MaterialCommunityIcons name="chevron-down" size={22} color={colors.muted} />
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable testID="village-picker-close" onPress={() => setOpen(false)} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={26} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={22} color={colors.muted} />
            <TextInput
              testID="village-search-input"
              placeholder="Search village or town..."
              placeholderTextColor={colors.muted}
              value={q}
              onChangeText={setQ}
              style={styles.searchInput}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(v) => v.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
            renderItem={({ item }) => (
              <Pressable
                testID={`village-option-${item.name}`}
                style={styles.row}
                onPress={() => {
                  onSelect(item);
                  setQ("");
                  setOpen(false);
                }}
              >
                <View
                  style={[
                    styles.rowIcon,
                    {
                      backgroundColor:
                        item.type === "town" ? colors.brandSecondary : colors.brandTertiary,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={item.type === "town" ? "city-variant" : "home-group"}
                    size={20}
                    color={item.type === "town" ? colors.onBrandSecondary : colors.onBrandTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {item.landmarks.slice(0, 2).join(" • ")}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.text,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
  },
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
  fieldText: { flex: 1, fontFamily: fonts.text, fontSize: fontSize.lg },
  tag: {
    fontFamily: fonts.text,
    fontSize: fontSize.sm,
    color: colors.muted,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  modal: { flex: 1, backgroundColor: colors.surface },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  searchInput: { flex: 1, fontFamily: fonts.text, fontSize: fontSize.lg, color: colors.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "600", color: colors.onSurface },
  rowSub: { fontFamily: fonts.text, fontSize: fontSize.base, color: colors.muted, marginTop: 1 },
});
