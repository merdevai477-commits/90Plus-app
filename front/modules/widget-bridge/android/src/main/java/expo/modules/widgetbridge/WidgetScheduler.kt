package expo.modules.widgetbridge

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

internal object WidgetScheduler {
  private const val PERIODIC = "ninetyplus_widget_periodic"
  private const val NOW = "ninetyplus_widget_now"
  private const val LIVE = "ninetyplus_widget_live"
  const val LIVE_TAG = "ninetyplus_widget_live_tick"
  private const val LIVE_TICK_MINUTES = 1L
  private const val KICKOFF_PREFIX = "ninetyplus_widget_kickoff_"
  private const val KICKOFF_TAG = "ninetyplus_widget_kickoff"
  private const val KICKOFF_GRACE_MS = 60_000L
  private const val KICKOFF_HORIZON_MS = 48 * 60 * 60_000L

  private val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

  /**
   * Also keeps WorkManager's internal receiver enabled; without a pending request it toggles
   * that component, which re-broadcasts APPWIDGET_UPDATE and loops onUpdate -> refreshNow.
   */
  fun ensurePeriodic(context: Context) {
    val request = PeriodicWorkRequestBuilder<WidgetUpdateWorker>(15, TimeUnit.MINUTES)
      .setConstraints(network)
      .build()
    WorkManager.getInstance(context)
      .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
  }

  fun refreshNow(context: Context) {
    val request = OneTimeWorkRequestBuilder<WidgetUpdateWorker>().setConstraints(network).build()
    WorkManager.getInstance(context).enqueueUniqueWork(NOW, ExistingWorkPolicy.REPLACE, request)
  }

  /**
   * Faster refresh while a followed team is playing; stops as soon as the feed has no live match.
   * A running tick chains its successor (REPLACE would cancel the tick itself); any other worker
   * keeps the tick that is already pending so the cadence never doubles up.
   */
  fun scheduleLiveTick(context: Context, fromLiveTick: Boolean) {
    val request = OneTimeWorkRequestBuilder<WidgetUpdateWorker>()
      .setConstraints(network)
      .setInitialDelay(LIVE_TICK_MINUTES, TimeUnit.MINUTES)
      .addTag(LIVE_TAG)
      .build()
    val policy = if (fromLiveTick) ExistingWorkPolicy.APPEND_OR_REPLACE else ExistingWorkPolicy.KEEP
    WorkManager.getInstance(context).enqueueUniqueWork(LIVE, policy, request)
  }

  /** Wakes up just after kick-off so the live notification does not wait for the 15-minute cycle. */
  fun scheduleKickoff(context: Context, match: FeedMatch) {
    val delayMs = match.kickoffTs * 1000 + KICKOFF_GRACE_MS - System.currentTimeMillis()
    if (match.status != "upcoming" || delayMs <= 0 || delayMs > KICKOFF_HORIZON_MS) return
    val request = OneTimeWorkRequestBuilder<WidgetUpdateWorker>()
      .setConstraints(network)
      .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
      .addTag(KICKOFF_TAG)
      .build()
    WorkManager.getInstance(context)
      .enqueueUniqueWork("$KICKOFF_PREFIX${match.fixtureId}", ExistingWorkPolicy.KEEP, request)
  }

  fun cancelAll(context: Context) {
    val wm = WorkManager.getInstance(context)
    wm.cancelUniqueWork(PERIODIC)
    wm.cancelUniqueWork(NOW)
    wm.cancelUniqueWork(LIVE)
    wm.cancelAllWorkByTag(KICKOFF_TAG)
  }
}
