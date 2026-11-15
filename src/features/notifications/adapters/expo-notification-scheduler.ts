import { PermissionStatus } from 'expo';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import type { ScheduledNotification } from '../domain/diff';
import { isAppNotificationId } from '../domain/identifiers';
import {
  notificationDataSchema,
  toNotificationData,
  type NotificationData,
} from '../domain/payload';
import type { NotificationContent, PlannedNotification, PlannedTrigger } from '../domain/plan';
import type { NotificationPermission, NotificationScheduler } from '../domain/ports';
import { toExpoWeekday } from '../domain/to-expo-weekday';

/** Android channel that carries every reminder. */
const REMINDERS_CHANNEL_ID = 'reminders';
const MINUTES_PER_HOUR = 60;

/** Name and description of the channel, as the person sees them in the system settings. */
const REMINDERS_CHANNEL = {
  name: 'Recordatorios',
  description: 'Recordatorio semanal y resumen del mes',
  importance: AndroidImportance.DEFAULT,
} as const;

/**
 * Maps the Expo permission response to the three states the UI knows. Android never reports
 * `undetermined`: a permission that was not granted comes back as `denied`, and only
 * `canAskAgain` tells "never asked or asked once" (the system can still show its dialog) from
 * "blocked" (only the phone settings can change it).
 */
function toPermission(
  response: Notifications.NotificationPermissionsStatus,
): NotificationPermission {
  const iosStatus = response.ios?.status;
  if (
    response.granted ||
    iosStatus === IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'granted';
  }
  return response.status === PermissionStatus.DENIED && !response.canAskAgain
    ? 'denied'
    : 'undetermined';
}

/** Expo trigger for a planned one (ADR-011): `DATE` for one-offs, `WEEKLY` for the neutral repeat. */
function toExpoTrigger(trigger: PlannedTrigger): Notifications.SchedulableNotificationTriggerInput {
  if (trigger.type === 'once') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger.fireAt,
      channelId: REMINDERS_CHANNEL_ID,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: toExpoWeekday(trigger.weekday),
    hour: Math.floor(trigger.minuteOfDay / MINUTES_PER_HOUR),
    minute: trigger.minuteOfDay % MINUTES_PER_HOUR,
    channelId: REMINDERS_CHANNEL_ID,
  };
}

/** Content of a rebuilt notification, with the destination the payload carries. */
function toContent(title: string, body: string, data: NotificationData): NotificationContent {
  return data.deepLink === '/tracking/monthly'
    ? { title, body, deepLink: data.deepLink, month: data.month }
    : { title, body, deepLink: data.deepLink };
}

/**
 * Rebuilds a planned notification from what the system stored. It trusts the payload the
 * adapter wrote (`content.data`), not the native trigger, whose shape changes between
 * platforms. Anything it cannot rebuild is `unrecognized` and will be cancelled.
 */
function toScheduled(request: Notifications.NotificationRequest): ScheduledNotification {
  const { identifier, content } = request;
  const unrecognized: ScheduledNotification = { identifier, kind: 'unrecognized' };
  const parsed = notificationDataSchema.safeParse(content.data);
  if (!parsed.success || content.title === null || content.body === null) {
    return unrecognized;
  }
  const data: NotificationData = parsed.data;
  const planned = toContent(content.title, content.body, data);
  if (data.trigger.type === 'once') {
    return { identifier, kind: data.kind, trigger: data.trigger, content: planned };
  }
  if (data.kind !== 'weekly_reminder') {
    return unrecognized;
  }
  return { identifier, kind: data.kind, trigger: data.trigger, content: planned };
}

/**
 * `NotificationScheduler` on top of `expo-notifications` (ADR-011). The `reminders` channel is
 * created once per process on Android, and always before asking for the permission or
 * scheduling: on Android 13+ the permission dialog does not appear without a channel. iOS asks
 * for alert and sound, never badge or provisional authorization (D-29).
 */
export function createExpoNotificationScheduler(): NotificationScheduler {
  let channelReady: Promise<void> | null = null;

  const ensureChannel = (): Promise<void> => {
    if (Platform.OS !== 'android') {
      return Promise.resolve();
    }
    channelReady ??= Notifications.setNotificationChannelAsync(
      REMINDERS_CHANNEL_ID,
      REMINDERS_CHANNEL,
    ).then(
      () => undefined,
      (error: unknown) => {
        channelReady = null;
        throw error;
      },
    );
    return channelReady;
  };

  const scheduleOne = async (planned: PlannedNotification): Promise<void> => {
    await Notifications.scheduleNotificationAsync({
      identifier: planned.identifier,
      content: {
        title: planned.content.title,
        body: planned.content.body,
        data: toNotificationData(planned),
        sound: 'default',
      },
      trigger: toExpoTrigger(planned.trigger),
    });
  };

  return {
    getPermission: async () => toPermission(await Notifications.getPermissionsAsync()),
    requestPermission: async () => {
      await ensureChannel();
      return toPermission(
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        }),
      );
    },
    listScheduled: async () => {
      const requests = await Notifications.getAllScheduledNotificationsAsync();
      return requests.filter((request) => isAppNotificationId(request.identifier)).map(toScheduled);
    },
    cancel: async (identifiers) => {
      for (const identifier of identifiers) {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      }
    },
    schedule: async (notifications) => {
      await ensureChannel();
      for (const planned of notifications) {
        await scheduleOne(planned);
      }
    },
  };
}
