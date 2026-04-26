import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function SectionCard({ palette, children, style }) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export function SectionHeader({ palette, label, title, action }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeadText}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function Chip({ palette, children, kind = "default" }) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const variants = {
    default: {
      backgroundColor: palette.cardMuted,
      color: palette.muted,
    },
    accent: {
      backgroundColor: palette.accentSoft,
      color: palette.accentStrong,
    },
    ok: {
      backgroundColor: palette.okSoft,
      color: palette.ok,
    },
    fail: {
      backgroundColor: palette.failSoft,
      color: palette.fail,
    },
    holiday: {
      backgroundColor: palette.holidaySoft,
      color: palette.holiday,
    },
  };
  const current = variants[kind] || variants.default;

  return (
    <View style={[styles.chip, { backgroundColor: current.backgroundColor }]}>
      <Text style={[styles.chipText, { color: current.color }]}>{children}</Text>
    </View>
  );
}

export function StatusBanner({ palette, title, description, type = "default" }) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const backgroundMap = {
    default: palette.cardMuted,
    ok: palette.okSoft,
    warning: palette.accentSoft,
    error: palette.failSoft,
    loading: palette.statusLoading,
  };

  return (
    <View style={[styles.banner, { backgroundColor: backgroundMap[type] || backgroundMap.default }]}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.bannerDescription}>{description}</Text>
    </View>
  );
}

export function EmptyStateCard({ palette, title, description }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.emptyCard}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.bannerDescription}>{description}</Text>
    </View>
  );
}

export function StatCard({ palette, value, label, style }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={[styles.statCard, style]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function SummaryLinkCard({ palette, title, description, onPress }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable style={styles.summaryLinkCard} onPress={onPress}>
      <View style={styles.summaryTextWrap}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summaryDescription}>{description}</Text>
      </View>
      <View style={styles.summaryCue}>
        <Text style={styles.summaryCueText}>이동</Text>
        <Ionicons name="chevron-forward" size={12} color={palette.accentStrong} />
      </View>
    </Pressable>
  );
}

export function ToggleRow({ palette, title, description, active, onPress }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable style={styles.toggleRow} onPress={onPress}>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summaryDescription}>{description}</Text>
      </View>
      <View style={[styles.toggleTrack, active && styles.toggleTrackActive]}>
        <View style={[styles.toggleThumb, active && styles.toggleThumbActive]} />
      </View>
    </Pressable>
  );
}

export function OutlineButton({ palette, label, onPress, compact = false, disabled = false }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      style={[styles.outlineButton, compact && styles.compactButton, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.outlineButtonText}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({ palette, label, onPress, compact = false, disabled = false }) {
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      style={[styles.primaryButton, compact && styles.compactButton, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    sectionCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 20,
      backgroundColor: palette.surface,
      padding: 14,
      gap: 12,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    sectionHeadText: {
      flex: 1,
      gap: 4,
    },
    sectionLabel: {
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.8,
      textTransform: "uppercase",
      color: palette.accentStrong,
      fontWeight: "500",
    },
    sectionTitle: {
      fontSize: 26,
      lineHeight: 32,
      color: palette.text,
      fontWeight: "500",
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      alignSelf: "flex-start",
    },
    chipText: {
      fontSize: 11,
      fontWeight: "500",
    },
    banner: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      gap: 4,
    },
    emptyCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      gap: 4,
    },
    bannerTitle: {
      fontSize: 13,
      fontWeight: "500",
      color: palette.text,
    },
    bannerDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: palette.muted,
    },
    statCard: {
      flex: 1,
      minHeight: 90,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 12,
      backgroundColor: palette.card,
      padding: 12,
      justifyContent: "space-between",
    },
    statValue: {
      fontSize: 26,
      lineHeight: 28,
      color: palette.text,
      fontWeight: "500",
    },
    statLabel: {
      fontSize: 12,
      color: palette.muted,
    },
    summaryLinkCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 12,
      backgroundColor: palette.card,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    summaryTextWrap: {
      flex: 1,
      gap: 4,
    },
    summaryTitle: {
      fontSize: 15,
      color: palette.text,
      fontWeight: "500",
    },
    summaryDescription: {
      fontSize: 12,
      lineHeight: 17,
      color: palette.muted,
    },
    summaryCue: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: palette.cardMuted,
    },
    summaryCueText: {
      fontSize: 11,
      color: palette.accentStrong,
      fontWeight: "500",
    },
    toggleRow: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 12,
      backgroundColor: palette.card,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    toggleTextWrap: {
      flex: 1,
      gap: 4,
    },
    toggleTrack: {
      width: 50,
      height: 30,
      borderRadius: 999,
      backgroundColor: palette.cardMuted,
      padding: 4,
      justifyContent: "center",
    },
    toggleTrackActive: {
      backgroundColor: palette.accent,
    },
    toggleThumb: {
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: palette.surface,
    },
    toggleThumbActive: {
      alignSelf: "flex-end",
      backgroundColor: "#ffffff",
    },
    outlineButton: {
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
    },
    compactButton: {
      minHeight: 32,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    outlineButtonText: {
      color: palette.accentStrong,
      fontSize: 12,
      fontWeight: "500",
    },
    primaryButton: {
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: {
      color: palette.onAccent,
      fontSize: 12,
      fontWeight: "500",
    },
    disabledButton: {
      opacity: 0.45,
    },
  });
}
