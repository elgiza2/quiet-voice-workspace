# Megsy Android bridge (for the Android app developer)

The website talks to the app through a WebView `JavascriptInterface` named **`MegsyAndroid`**.
When it exists, Megsy schedules real alarms/reminders on the phone and registers the phone for push.

## JS → Android (methods to implement)

| Method | Arg | What to do |
| --- | --- | --- |
| `scheduleAlarm(json)` | `{"id","title","at"(epoch ms),"path"}` | `AlarmManager.setAlarmClock` → full-screen ringing alarm activity |
| `scheduleReminder(json)` | same | `setExactAndAllowWhileIdle` → normal notification |
| `cancel(id)` | task id | cancel the PendingIntent for that id |
| `requestPushToken()` | – | get FCM token, then call back JS (below) |

Use `id.hashCode()` as the PendingIntent request code so re-scheduling replaces the old one.
Re-schedule everything on `BOOT_COMPLETED` (the site also re-sends all upcoming tasks on every open).

## Android → JS

```kotlin
webView.evaluateJavascript("window.megsyNativePushToken && window.megsyNativePushToken('$token')", null)
```
Call it after `requestPushToken()` and in `FirebaseMessagingService.onNewToken`.

## Kotlin sketch

```kotlin
class MegsyBridge(private val ctx: Context, private val web: WebView) {
  private val am = ctx.getSystemService(AlarmManager::class.java)
  private fun pi(id: String, title: String, alarm: Boolean) = PendingIntent.getBroadcast(
    ctx, id.hashCode(),
    Intent(ctx, MegsyAlarmReceiver::class.java).putExtra("id", id).putExtra("title", title).putExtra("alarm", alarm),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  @JavascriptInterface fun scheduleAlarm(json: String) { val o = JSONObject(json)
    am.setAlarmClock(AlarmManager.AlarmClockInfo(o.getLong("at"), null), pi(o.getString("id"), o.getString("title"), true)) }
  @JavascriptInterface fun scheduleReminder(json: String) { val o = JSONObject(json)
    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, o.getLong("at"), pi(o.getString("id"), o.getString("title"), false)) }
  @JavascriptInterface fun cancel(id: String) { am.cancel(pi(id, "", false)); am.cancel(pi(id, "", true)) }
  @JavascriptInterface fun requestPushToken() {
    FirebaseMessaging.getInstance().token.addOnSuccessListener { t ->
      web.post { web.evaluateJavascript("window.megsyNativePushToken&&window.megsyNativePushToken('$t')", null) } } }
}
// webView.addJavascriptInterface(MegsyBridge(this, webView), "MegsyAndroid")
```

`MegsyAlarmReceiver`: if `alarm` → start a full-screen alarm activity with sound/vibration (channel `megsy_alarms`,
IMPORTANCE_HIGH, `setFullScreenIntent`); else show a notification on channel `megsy_reminders`. Tapping opens `/tasks`.

Permissions: `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`, `POST_NOTIFICATIONS`, `USE_FULL_SCREEN_INTENT`,
`RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`. Add `google-services.json` from the same Firebase project connected to Megsy.

## Server push
The server sends FCM messages with `data.kind` (`task` | `alarm` | `morning`) and `data.path` (`/tasks`).
Push is the backup when the app wasn't opened after the task was created; local alarms stay the primary path.

## Bot phone calls (ring like a normal call)

When a bot calls the user ("رن عليا", a reminder, or a finished task), the site hands the call to the phone so it
rings over the lock screen and other apps, even when the WebView is in the background. Web side:
`src/lib/native/callBridge.ts` + `src/components/calls/CallHost.tsx`.

### JS → Android

| Method | Arg | What to do |
| --- | --- | --- |
| `scheduleCall(json)` | `{"id","botName","kind":"voice"\|"video","reason","at"(epoch ms),"path"}` | `AlarmManager.setAlarmClock` at `at`; when it fires, show the incoming-call screen below. Replaces an earlier schedule with the same `id`. |
| `showIncomingCall(json)` | same (`at` = now) | Show the incoming-call screen now. |
| `cancelCall(id)` | call id | Cancel a scheduled ring and dismiss its call screen/notification. |
| `callStarted(json)` | `{"id","botName","kind"}` | Start a foreground service (`foregroundServiceType="microphone\|phoneCall"`, + `camera` for video) with an ongoing CallStyle notification so audio keeps running in the background. |
| `callEnded(id)` | call id | Stop that foreground service. |

### Incoming-call screen

Use a self-managed `ConnectionService` (`TelecomManager.addNewIncomingCall`, `PhoneAccount.CAPABILITY_SELF_MANAGED`)
so Android treats it like a real call (Bluetooth, car, lock screen). Simpler alternative: a notification on channel
`megsy_calls` (IMPORTANCE_HIGH, ringtone + vibration) with `NotificationCompat.CallStyle.forIncomingCall(...)` and
`setFullScreenIntent(...)`. Ring for 45 s, then report `missed`.

### Android → JS

```kotlin
web.evaluateJavascript("window.megsyNativeCallAction && window.megsyNativeCallAction('$id','answer')", null) // or 'decline' / 'missed'
```

If the WebView isn't running when the user taps Answer, open the app at `path` (`/?answerCall=<id>`); the site answers
that call as soon as it loads. Decline when the app is closed can simply open nothing — the call is marked missed later.

Permissions: `MANAGE_OWN_CALLS`, `USE_FULL_SCREEN_INTENT`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`,
`FOREGROUND_SERVICE_PHONE_CALL`, `FOREGROUND_SERVICE_CAMERA`, `RECORD_AUDIO`, `CAMERA`, `POST_NOTIFICATIONS`,
`SCHEDULE_EXACT_ALARM`. In the WebView grant `onPermissionRequest` for audio/video capture and set
`mediaPlaybackRequiresUserGesture = false`.

### Still needed for a fully closed app

A call created while the app is fully closed (e.g. a background task finishing) can only reach the phone by push.
The server needs a Firebase project (service-account key) to send a high-priority FCM **data** message
`{ "kind": "call", "id", "botName", "callKind", "reason" }`; the app's `FirebaseMessagingService` then shows the
incoming-call screen. Scheduled calls already work without push once the app has been opened after scheduling.
