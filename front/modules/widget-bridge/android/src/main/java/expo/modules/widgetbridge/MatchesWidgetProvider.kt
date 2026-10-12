package expo.modules.widgetbridge

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle

class MatchesWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    WidgetRenderer.renderCached(context)
    WidgetScheduler.ensurePeriodic(context)
    WidgetScheduler.refreshNow(context)
  }

  override fun onEnabled(context: Context) {
    WidgetScheduler.ensurePeriodic(context)
  }

  override fun onDisabled(context: Context) {
    // The live-score notification keeps using the same refresh work while teams are followed.
    if (WidgetStore.config(context)?.teamIds.isNullOrEmpty()) WidgetScheduler.cancelAll(context)
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    manager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle,
  ) {
    WidgetRenderer.renderCached(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_NEXT -> WidgetRenderer.flip(context, forward = true)
      ACTION_PREV -> WidgetRenderer.flip(context, forward = false)
      else -> super.onReceive(context, intent)
    }
  }

  companion object {
    const val ACTION_NEXT = "expo.modules.widgetbridge.action.NEXT_PAGE"
    const val ACTION_PREV = "expo.modules.widgetbridge.action.PREV_PAGE"
  }
}
