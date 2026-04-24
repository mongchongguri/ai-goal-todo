import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ICONS = {
  home: "home-outline",
  calendar: "calendar-clear-outline",
  settings: "settings-outline",
};

export function BottomNavigation({ palette, tabs, activeTab, onChange }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.outer}>
      <View style={styles.inner}>
        {tabs.map((tab) => {
          const active = tab.id === activeTab;

          return (
            <Pressable
              key={tab.id}
              style={[styles.button, active && styles.buttonActive]}
              onPress={() => onChange(tab.id)}
            >
              <Ionicons
                name={active ? ICONS[tab.id].replace("-outline", "") : ICONS[tab.id]}
                size={20}
                color={active ? palette.onAccent : palette.muted}
              />
              <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    outer: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 12,
      backgroundColor: palette.background,
    },
    inner: {
      flexDirection: "row",
      gap: 6,
      padding: 6,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 18,
      backgroundColor: palette.surface,
    },
    button: {
      flex: 1,
      minHeight: 54,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      gap: 4,
    },
    buttonActive: {
      backgroundColor: palette.accent,
    },
    label: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: "500",
    },
    labelActive: {
      color: palette.onAccent,
    },
  });
}
