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
