import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

function buildBadges(task) {
  const badges = [];

  if (task.source === "carryover") {
    badges.push({ kind: "carry", label: "이월 반영" });
  } else if (task.manual) {
    badges.push({ kind: "manual", label: "직접 추가" });
  } else {
    badges.push({ kind: "ai", label: "AI 추천" });
  }

  if (task.carryoverCount > 0) {
    badges.push({ kind: "carry", label: `${task.carryoverCount}일 누적` });
  }

  return badges;
}

function badgeStyle(kind, palette) {
  if (kind === "manual") {
    return {
      backgroundColor: palette.okSoft,
      color: palette.ok,
    };
  }

  if (kind === "carry") {
    return {
      backgroundColor: palette.pendingSoft,
      color: palette.pending,
    };
  }

  return {
    backgroundColor: palette.accentSoft,
    color: palette.accentStrong,
  };
}

export function TaskCard({
  task,
  palette,
  onToggleDone,
  onDelete,
  onUpdateTitle,
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const translateX = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const actionWidth = task.manual ? 124 : 60;

  useEffect(() => {
    setDraftTitle(task.title);
  }, [task.title]);

  const closeSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
    setOpen(false);
  };

  const openSwipe = () => {
    Animated.spring(translateX, {
      toValue: -actionWidth,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
    setOpen(true);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => (
        Math.abs(gestureState.dx) > 16
        && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        && !editing
      ),
      onPanResponderMove: (_, gestureState) => {
        const base = open ? -actionWidth : 0;
        const next = Math.max(-actionWidth, Math.min(0, base + gestureState.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gestureState) => {
        const base = open ? -actionWidth : 0;
        const moved = base + gestureState.dx;

        if (moved < (-actionWidth / 2)) {
          openSwipe();
          return;
        }

        closeSwipe();
      },
      onPanResponderTerminate: closeSwipe,
    }),
  ).current;

  const handleToggle = () => {
    closeSwipe();
    onToggleDone(task.id, task.status === "done" ? "pending" : "done");
  };

  const handleDelete = () => {
    closeSwipe();
    Alert.alert("할 일 삭제", "정말로 삭제하시겠습니까?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => onDelete(task.id),
      },
    ]);
  };

  const handleSubmitEdit = () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      return;
    }

    onUpdateTitle(task.id, nextTitle);
    setEditing(false);
  };

  return (
    <View style={styles.shell}>
      <View style={[styles.actions, { width: actionWidth }]}>
        {task.manual && (
          <Pressable style={[styles.actionButton, styles.editButton]} onPress={() => {
            closeSwipe();
            setEditing(true);
          }}>
            <Ionicons name="create-outline" size={18} color={palette.onAccent} />
          </Pressable>
        )}
        <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={palette.onAccent} />
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.card,
          task.status === "done" && styles.cardDone,
          task.status === "failed" && styles.cardFailed,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable style={styles.checkboxWrap} onPress={handleToggle}>
          <View style={[styles.checkbox, task.status === "done" && styles.checkboxActive]}>
            {task.status === "done" && <Ionicons name="checkmark" size={14} color={palette.onAccent} />}
          </View>
        </Pressable>

        <Pressable style={styles.content} onPress={editing ? undefined : handleToggle}>
          <View style={styles.metaRow}>
            {buildBadges(task).map((badge) => {
              const currentBadge = badgeStyle(badge.kind, palette);

              return (
                <View
                  key={`${task.id}-${badge.label}`}
                  style={[styles.badge, { backgroundColor: currentBadge.backgroundColor }]}
                >
                  <Text style={[styles.badgeText, { color: currentBadge.color }]}>{badge.label}</Text>
                </View>
              );
            })}
            <Text style={styles.note} numberOfLines={1}>
              {task.note || "오늘 계획 반영"}
            </Text>
          </View>

          {editing ? (
            <View style={styles.editWrap}>
              <TextInput
                autoFocus
                value={draftTitle}
                onChangeText={setDraftTitle}
                style={styles.editInput}
                placeholder="할 일 제목 수정"
                placeholderTextColor={palette.muted}
                maxLength={120}
              />
              <View style={styles.editActions}>
                <Pressable style={[styles.smallButton, styles.saveButton]} onPress={handleSubmitEdit}>
                  <Text style={styles.smallButtonText}>저장</Text>
                </Pressable>
                <Pressable style={[styles.smallButton, styles.cancelButton]} onPress={() => {
                  setDraftTitle(task.title);
                  setEditing(false);
                }}>
                  <Text style={[styles.smallButtonText, { color: palette.muted }]}>취소</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={[styles.title, task.status === "done" && styles.titleDone]}>{task.title}</Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    shell: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 12,
    },
    actions: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "flex-end",
      gap: 8,
      paddingLeft: 8,
    },
    actionButton: {
      width: 54,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    editButton: {
      backgroundColor: palette.pending,
    },
    deleteButton: {
      backgroundColor: palette.fail,
    },
    card: {
      minHeight: 88,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: 12,
      backgroundColor: palette.card,
    },
    cardDone: {
      backgroundColor: palette.accentSoft,
      borderColor: palette.accent,
    },
    cardFailed: {
      backgroundColor: palette.failSoft,
    },
    checkboxWrap: {
      alignSelf: "stretch",
      justifyContent: "center",
      paddingVertical: 4,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: palette.lineStrong,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accent,
    },
    content: {
      flex: 1,
      gap: 6,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "500",
    },
    note: {
      flex: 1,
      fontSize: 11,
      color: palette.muted,
    },
    title: {
      fontSize: 17,
      lineHeight: 23,
      color: palette.text,
      fontWeight: "500",
    },
    titleDone: {
      color: palette.muted,
      textDecorationLine: "line-through",
    },
    editWrap: {
      gap: 8,
    },
    editInput: {
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.cardMuted,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: palette.text,
      fontSize: 15,
    },
    editActions: {
      flexDirection: "row",
      gap: 8,
    },
    smallButton: {
      minWidth: 68,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButton: {
      backgroundColor: palette.accent,
    },
    cancelButton: {
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.card,
    },
    smallButtonText: {
      color: palette.onAccent,
      fontSize: 13,
      fontWeight: "500",
    },
  });
}
