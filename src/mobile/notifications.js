import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const REMINDER_KIND = "planner-daily-reminder";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("planner-reminder", {
    name: "할 일 알림",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 120],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function normalizePermission(settings) {
  if (settings.granted) {
    return "granted";
  }

  if (settings.canAskAgain) {
    return "undetermined";
  }

  return "denied";
}

export async function getNotificationPermissionStatus() {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") {
      return "unsupported";
    }

    if (Notification.permission === "granted") {
      return "granted";
    }

    if (Notification.permission === "denied") {
      return "denied";
    }

    return "undetermined";
  }

  const settings = await Notifications.getPermissionsAsync();
  return normalizePermission(settings);
}

export async function requestNotificationPermission() {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") {
      return "unsupported";
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      return "granted";
    }

    if (permission === "denied") {
      return "denied";
    }

    return "undetermined";
  }

  await ensureAndroidChannel();
  const settings = await Notifications.requestPermissionsAsync();
  return normalizePermission(settings);
}

export async function syncDailyReminder({ enabled, reminderTime, title, body }) {
  if (Platform.OS === "web") {
    return;
  }

  await ensureAndroidChannel();

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const reminderJobs = scheduled.filter((job) => job.content?.data?.kind === REMINDER_KIND);
  await Promise.all(
    reminderJobs.map((job) => Notifications.cancelScheduledNotificationAsync(job.identifier)),
  );

  if (!enabled) {
    return;
  }

  const [hoursText, minutesText] = String(reminderTime || "21:00").split(":");
  const hour = Number.parseInt(hoursText, 10);
  const minute = Number.parseInt(minutesText, 10);

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        kind: REMINDER_KIND,
      },
      sound: false,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}
