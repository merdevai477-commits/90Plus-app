package expo.modules.widgetbridge

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class WidgetUpdateWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    val context = applicationContext
    if (WidgetRenderer.widgetIds(context).isEmpty()) return Result.success()

    val config = WidgetStore.config(context)
    if (config == null || config.teamIds.isEmpty() || config.apiBase.isBlank()) {
      WidgetRenderer.render(context, null, config, allowNetwork = false)
      return Result.success()
    }

    val fetched = fetchFeed(config)
    if (fetched != null) WidgetStore.saveFeed(context, fetched)
    val feed = WidgetFeed.parse(fetched ?: WidgetStore.feed(context))
    WidgetRenderer.render(context, feed, config, allowNetwork = true)

    if (feed?.hasLive == true) {
      WidgetScheduler.scheduleLiveTick(context, fromLiveTick = tags.contains(WidgetScheduler.LIVE_TAG))
    }
    return Result.success()
  }

  private fun fetchFeed(config: WidgetConfig): String? {
    val teams = URLEncoder.encode(config.teamIds.joinToString(","), "UTF-8")
    val url = "${config.apiBase}/football/widget/followed?teams=$teams&language=${config.language}"
    var connection: HttpURLConnection? = null
    return try {
      connection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 10_000
        readTimeout = 12_000
        setRequestProperty("Accept", "application/json")
      }
      if (connection.responseCode != 200) null
      else connection.inputStream.bufferedReader().use { it.readText() }
    } catch (_: Exception) {
      null
    } finally {
      connection?.disconnect()
    }
  }
}
