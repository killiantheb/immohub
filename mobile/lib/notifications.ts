import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// How foreground notifications appear
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("althy-urgences", {
      name:       "Alertes Althy",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#E8602C",
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? "";
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  // Register token with backend
  try {
    await api.post("/notifications/push-token", { token, plateforme: Platform.OS });
  } catch {
    // non-blocking
  }

  return token;
}

export function schedulePushNotification(title: string, body: string, seconds = 1) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { seconds },
  });
}
