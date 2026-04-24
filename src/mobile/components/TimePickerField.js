import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { dateToTimeValue, formatTimeLabel, timeValueToDate } from "../date.js";

export function TimePickerField({
  label,
  note,
  value,
  palette,
  onChange,
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === "web" ? (
        <View style={styles.field}>
          <TextInput
            value={value}
            onChangeText={(text) => {
              const sanitized = text.replace(/[^\d:]/g, "").slice(0, 5);
              onChange(sanitized);
            }}
            style={styles.webInput}
            placeholder="09:00"
            placeholderTextColor={palette.muted}
            maxLength={5}
          />
          <Ionicons name="time-outline" size={18} color={palette.muted} />
        </View>
      ) : (
        <Pressable style={styles.field} onPress={() => setOpen(true)}>
          <Text style={styles.value}>{formatTimeLabel(value)}</Text>
          <Ionicons name="time-outline" size={18} color={palette.muted} />
        </Pressable>
      )}
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {open && Platform.OS !== "web" && (
        <DateTimePicker
          value={timeValueToDate(value)}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            if (Platform.OS !== "ios") {
              setOpen(false);
            }

            if (selectedDate) {
              onChange(dateToTimeValue(selectedDate));
            }
          }}
        />
      )}
      {open && Platform.OS === "ios" && (
        <Pressable style={styles.doneButton} onPress={() => setOpen(false)}>
          <Text style={styles.doneText}>완료</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    wrap: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: "500",
      color: palette.text,
    },
    field: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    value: {
      fontSize: 15,
      color: palette.text,
      fontWeight: "500",
    },
    webInput: {
      flex: 1,
      paddingVertical: 0,
      color: palette.text,
      fontSize: 15,
      fontWeight: "500",
      outlineStyle: "none",
    },
    note: {
      fontSize: 12,
      lineHeight: 18,
      color: palette.muted,
    },
    doneButton: {
      alignSelf: "flex-end",
      marginTop: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: palette.accentSoft,
    },
    doneText: {
      color: palette.accentStrong,
      fontSize: 12,
      fontWeight: "500",
    },
  });
}
