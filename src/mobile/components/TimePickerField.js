import { useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dateToTimeValue, formatTimeLabel, timeValueToDate } from "../date.js";

export function TimePickerField({
  label,
  note,
  value,
  palette,
  onChange,
  modalTitle,
  modalDescription,
  quickTimes = ["06:00", "09:00", "12:00", "18:00", "21:00"],
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef(null);
  const [draftValue, setDraftValue] = useState(value);
  const [showCustomPickerPopup, setShowCustomPickerPopup] = useState(false);
  const snapPoints = useMemo(() => (Platform.OS === "ios" ? ["74%"] : ["66%"]), []);
  const { hourValue, minuteValue } = splitTimeValue(draftValue);
  const minuteOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0")),
    [],
  );
  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")),
    [],
  );

  const openPicker = () => {
    setDraftValue(value);
    setShowCustomPickerPopup(false);
    bottomSheetRef.current?.present();
  };

  const closeSheet = () => {
    setShowCustomPickerPopup(false);
    bottomSheetRef.current?.dismiss();
  };

  const renderBackdrop = (props) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
      opacity={0.28}
    />
  );

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
        <Pressable style={styles.field} onPress={openPicker}>
          <View style={styles.valueWrap}>
            <Text style={styles.value}>{formatTimeLabel(value)}</Text>
            <Text style={styles.caption}>{value}</Text>
          </View>
          <View style={styles.triggerIconWrap}>
            <Ionicons name="time-outline" size={18} color={palette.accentStrong} />
          </View>
        </Pressable>
      )}

      {note ? <Text style={styles.note}>{note}</Text> : null}

      {Platform.OS !== "web" ? (
        <BottomSheetModal
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.handleIndicator}
          backgroundStyle={styles.sheetBackground}
          onDismiss={() => setShowCustomPickerPopup(false)}
        >
          <BottomSheetView style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleWrap}>
                <Text style={styles.sheetEyebrow}>Time Setting</Text>
                <Text style={styles.sheetTitle}>{modalTitle || label}</Text>
                <Text style={styles.sheetBody}>
                  {modalDescription || "선택한 시간이 지나면 이 기준으로 일정이 반영됩니다."}
                </Text>
              </View>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroClockWrap}>
                <View style={styles.heroClock}>
                  <Ionicons name="time-outline" size={20} color={palette.accentStrong} />
                </View>
                <View style={styles.heroOrbit} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroValue}>{formatTimeLabel(draftValue)}</Text>
                <Text style={styles.heroRawValue}>{draftValue}</Text>
                <Text style={styles.heroCaption}>
                  {Platform.OS === "ios"
                    ? "드래그해서 더 세밀하게 조정할 수 있어요."
                    : "빠른 선택 또는 직접 선택 팝업으로 조정할 수 있어요."}
                </Text>
              </View>
            </View>

            <View style={styles.quickRow}>
              {quickTimes.map((quickTime) => {
                const active = draftValue === quickTime;

                return (
                  <Pressable
                    key={quickTime}
                    style={[
                      styles.quickButton,
                      active && { borderColor: palette.accent, backgroundColor: palette.accentSoft },
                    ]}
                    onPress={() => setDraftValue(quickTime)}
                  >
                    <Text style={[styles.quickButtonText, active && { color: palette.accentStrong }]}>
                      {quickTime}
                    </Text>
                    <Text style={[styles.quickButtonSubtext, active && { color: palette.accentStrong }]}>
                      {formatTimeLabel(quickTime)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {Platform.OS === "ios" ? (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={timeValueToDate(draftValue)}
                  mode="time"
                  display="spinner"
                  onChange={(_, selectedDate) => {
                    if (selectedDate) {
                      setDraftValue(dateToTimeValue(selectedDate));
                    }
                  }}
                />
              </View>
            ) : (
              <Pressable
                style={styles.manualPickerButton}
                onPress={() => setShowCustomPickerPopup(true)}
              >
                <View style={styles.manualPickerCopy}>
                  <Text style={styles.manualPickerTitle}>직접 시간 선택</Text>
                  <Text style={styles.manualPickerBody}>작은 팝업에서 시와 분을 직접 고를 수 있어요.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.muted} />
              </Pressable>
            )}

            <View style={styles.sheetActions}>
              <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={closeSheet}>
                <Text style={[styles.actionText, styles.cancelText]}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.applyButton]}
                onPress={() => {
                  onChange(draftValue);
                  closeSheet();
                }}
              >
                <Text style={[styles.actionText, styles.applyText]}>적용</Text>
              </Pressable>
            </View>

            {showCustomPickerPopup ? (
              <View style={styles.popupBackdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCustomPickerPopup(false)} />
                <View style={[styles.popupCard, { marginBottom: Math.max(0, insets.bottom / 2) }]}>
                  <View style={styles.popupHeader}>
                    <View style={styles.popupTitleWrap}>
                      <Text style={styles.popupTitle}>직접 시간 선택</Text>
                      <Text style={styles.popupBody}>시와 분을 눌러 원하는 시간으로 맞추세요.</Text>
                    </View>
                    <Pressable style={styles.popupCloseButton} onPress={() => setShowCustomPickerPopup(false)}>
                      <Ionicons name="close" size={18} color={palette.muted} />
                    </Pressable>
                  </View>

                  <View style={styles.customPickerGrid}>
                    <View style={styles.customPickerColumn}>
                      <Text style={styles.customPickerLabel}>시</Text>
                      <ScrollView
                        style={styles.optionScroll}
                        contentContainerStyle={styles.optionScrollContent}
                        showsVerticalScrollIndicator={false}
                      >
                        {hourOptions.map((hour) => {
                          const active = hour === hourValue;

                          return (
                            <Pressable
                              key={hour}
                              style={[
                                styles.optionChip,
                                active && { borderColor: palette.accent, backgroundColor: palette.accentSoft },
                              ]}
                              onPress={() => setDraftValue(`${hour}:${minuteValue}`)}
                            >
                              <Text style={[styles.optionChipText, active && { color: palette.accentStrong }]}>
                                {hour}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <View style={styles.customPickerDivider}>
                      <Text style={styles.customPickerDividerText}>:</Text>
                    </View>

                    <View style={styles.customPickerColumn}>
                      <Text style={styles.customPickerLabel}>분</Text>
                      <ScrollView
                        style={styles.optionScroll}
                        contentContainerStyle={styles.optionScrollContent}
                        showsVerticalScrollIndicator={false}
                      >
                        {minuteOptions.map((minute) => {
                          const active = minute === minuteValue;

                          return (
                            <Pressable
                              key={minute}
                              style={[
                                styles.optionChip,
                                active && { borderColor: palette.accent, backgroundColor: palette.accentSoft },
                              ]}
                              onPress={() => setDraftValue(`${hourValue}:${minute}`)}
                            >
                              <Text style={[styles.optionChipText, active && { color: palette.accentStrong }]}>
                                {minute}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>

                  <View style={styles.popupActions}>
                    <Pressable style={[styles.popupButton, styles.cancelButton]} onPress={() => setShowCustomPickerPopup(false)}>
                      <Text style={[styles.actionText, styles.cancelText]}>닫기</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}
          </BottomSheetView>
        </BottomSheetModal>
      ) : null}
    </View>
  );
}

function splitTimeValue(timeValue) {
  const [hoursText = "09", minutesText = "00"] = String(timeValue || "09:00").split(":");
  return {
    hourValue: String(hoursText).padStart(2, "0").slice(0, 2),
    minuteValue: String(minutesText).padStart(2, "0").slice(0, 2),
  };
}

function createStyles(palette) {
  return StyleSheet.create({
    wrap: {
      gap: 8,
    },
    label: {
      fontSize: 13,
      fontWeight: "500",
      color: palette.text,
    },
    field: {
      minHeight: 54,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    valueWrap: {
      gap: 2,
    },
    value: {
      fontSize: 15,
      color: palette.text,
      fontWeight: "600",
    },
    caption: {
      fontSize: 11,
      color: palette.muted,
    },
    triggerIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accentSoft,
    },
    webInput: {
      flex: 1,
      paddingVertical: 0,
      color: palette.text,
      fontSize: 14,
      fontWeight: "500",
      outlineStyle: "none",
    },
    note: {
      fontSize: 11,
      lineHeight: 17,
      color: palette.muted,
    },
    handleIndicator: {
      backgroundColor: palette.lineStrong,
      width: 44,
      height: 5,
      opacity: 0.6,
    },
    sheetBackground: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: palette.line,
    },
    sheet: {
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 16,
    },
    sheetHeader: {
      gap: 6,
    },
    sheetTitleWrap: {
      gap: 5,
    },
    sheetEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      color: palette.accentStrong,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: palette.text,
    },
    sheetBody: {
      fontSize: 12,
      lineHeight: 17,
      color: palette.muted,
    },
    heroCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 16,
      borderRadius: 20,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.line,
      overflow: "hidden",
    },
    heroClockWrap: {
      width: 54,
      height: 54,
      alignItems: "center",
      justifyContent: "center",
    },
    heroClock: {
      width: 46,
      height: 46,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    heroOrbit: {
      position: "absolute",
      width: 54,
      height: 54,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.line,
      opacity: 0.7,
    },
    heroCopy: {
      flex: 1,
      gap: 3,
    },
    heroValue: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "700",
      color: palette.text,
    },
    heroRawValue: {
      fontSize: 11,
      fontWeight: "600",
      color: palette.accentStrong,
    },
    heroCaption: {
      fontSize: 11,
      lineHeight: 16,
      color: palette.muted,
    },
    quickRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    quickButton: {
      flex: 1,
      minWidth: "30%",
      minHeight: 52,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    quickButtonText: {
      fontSize: 12,
      fontWeight: "700",
      color: palette.text,
    },
    quickButtonSubtext: {
      fontSize: 10,
      color: palette.muted,
    },
    customPickerGrid: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 10,
      minHeight: 220,
    },
    customPickerColumn: {
      flex: 1,
      gap: 8,
    },
    customPickerLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: palette.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    customPickerDivider: {
      width: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    customPickerDividerText: {
      fontSize: 22,
      fontWeight: "700",
      color: palette.lineStrong,
    },
    optionScroll: {
      flex: 1,
    },
    optionScrollContent: {
      gap: 8,
      paddingRight: 2,
    },
    optionChip: {
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    optionChipText: {
      fontSize: 14,
      fontWeight: "700",
      color: palette.text,
    },
    pickerWrap: {
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.line,
      paddingVertical: 8,
      alignItems: "center",
    },
    manualPickerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.cardMuted,
      gap: 12,
    },
    manualPickerCopy: {
      flex: 1,
      gap: 3,
    },
    manualPickerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: palette.text,
    },
    manualPickerBody: {
      fontSize: 11,
      lineHeight: 16,
      color: palette.muted,
    },
    popupBackdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(15, 23, 42, 0.18)",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: "hidden",
      zIndex: 10,
      elevation: 10,
    },
    popupCard: {
      width: "92%",
      maxWidth: 360,
      maxHeight: 420,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.surface,
      padding: 16,
      gap: 14,
      shadowColor: "#000000",
      shadowOpacity: 0.14,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
      zIndex: 11,
    },
    popupHeader: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    popupTitleWrap: {
      flex: 1,
      gap: 4,
    },
    popupTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: palette.text,
    },
    popupBody: {
      fontSize: 11,
      lineHeight: 16,
      color: palette.muted,
    },
    popupCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.cardMuted,
      borderWidth: 1,
      borderColor: palette.line,
    },
    sheetActions: {
      flexDirection: "row",
      gap: 10,
      paddingTop: 2,
    },
    actionButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    cancelButton: {
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
    },
    applyButton: {
      backgroundColor: palette.accent,
    },
    actionText: {
      fontSize: 13,
      fontWeight: "600",
    },
    cancelText: {
      color: palette.text,
    },
    applyText: {
      color: palette.onAccent,
    },
    popupActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    popupButton: {
      minWidth: 88,
      minHeight: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
  });
}
