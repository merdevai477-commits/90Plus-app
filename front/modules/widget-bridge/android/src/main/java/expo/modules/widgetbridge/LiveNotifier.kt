package expo.modules.widgetbridge

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Ongoing score notification while a followed team plays. On Android 16 it is requested as a
 * promoted "Live Update" (status-bar chip, Samsung Now Bar and similar OEM surfaces), which is why it
 * sticks to a standard style instead of a custom layout.
 */
internal object LiveNotifier {
  private const val CHANNEL_ID = "ninetyplus_live_scores"
  private const val TAG = "ninetyplus_live"
  private const val MAX_LIVE = 2
  private const val FINAL_TIMEOUT_MS = 20 * 60_000L

  @SuppressLint("MissingPermission")
  fun update(context: Context, feed: WidgetFeed?, config: WidgetConfig?) {
    val manager = NotificationManagerCompat.from(context)
    val shown = WidgetStore.liveNotified(context)
    val matches = feed?.teams?.mapNotNull { it.match }?.distinctBy { it.fixtureId }.orEmpty()
    val live = matches.filter { it.isLive }.take(MAX_LIVE)
    val liveIds = live.map { it.fixtureId }.toSet()

    if (!canNotify(context, manager)) {
      shown.forEach { manager.cancel(TAG, it) }
      WidgetStore.setLiveNotified(context, emptySet())
      return
    }
    val labels = config?.labels ?: WidgetLabels.DEFAULT
    ensureChannel(manager, labels)

    for (id in shown - liveIds) {
      val final = matches.firstOrNull { it.fixtureId == id && it.status == "ft" }
      if (final != null) manager.notify(TAG, id, build(context, final, labels, ongoing = false))
      else manager.cancel(TAG, id)
    }
    for (match in live) manager.notify(TAG, match.fixtureId, build(context, match, labels, ongoing = true))
    WidgetStore.setLiveNotified(context, liveIds)
  }

  private fun canNotify(context: Context, manager: NotificationManagerCompat): Boolean {
    if (!manager.areNotificationsEnabled()) return false
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED
  }

  private fun ensureChannel(manager: NotificationManagerCompat, labels: WidgetLabels) {
    // LOW keeps minute-by-minute updates silent; MIN would disqualify the Live Update promotion.
    val channel = NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
      .setName("90PLUS · ${labels.live}")
      .setShowBadge(false)
      .build()
    manager.createNotificationChannel(channel)
  }

  private fun build(context: Context, match: FeedMatch, labels: WidgetLabels, ongoing: Boolean): Notification {
    val home = match.homeScore ?: 0
    val away = match.awayScore ?: 0
    val status = when {
      match.status == "ht" -> labels.halftime
      match.status == "ft" -> labels.finished
      match.elapsed != null -> "${match.elapsed + (match.extra ?: 0)}'"
      else -> labels.live
    }
    val detail = listOf(status, match.leagueName).filter { it.isNotBlank() }.joinToString(" · ")

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setContentTitle("${match.home.name}  $home - $away  ${match.away.name}")
      .setContentText(detail)
      .setStyle(NotificationCompat.BigTextStyle().bigText(detail))
      .setLargeIcon(WidgetImages.load(context, match.home.logo, allowNetwork = true))
      .setContentIntent(WidgetRenderer.openIntent(context, WidgetRenderer.matchUri(match)))
      .setCategory(NotificationCompat.CATEGORY_EVENT)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setOngoing(ongoing)
      .setShortCriticalText("$home-$away")
      .setRequestPromotedOngoing(ongoing)
    if (!ongoing) builder.setAutoCancel(true).setTimeoutAfter(FINAL_TIMEOUT_MS)
    return builder.build()
  }

  private fun smallIcon(context: Context): Int =
    context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      .takeIf { it != 0 } ?: context.applicationInfo.icon
}
