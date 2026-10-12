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
    val hasWidgets = WidgetRenderer.widgetIds(context).isNotEmpty()

    val config = WidgetStore.config(context)
    val hasScope = config != null && (config.teamIds.isNotEmpty() || config.favoriteIds.isNotEmpty())
    if (config == null || !hasScope || config.apiBase.isBlank()) {
      if (hasWidgets) WidgetRenderer.render(context, null, config, allowNetwork = false)
      LiveNotifier.update(context, null, config)
      return Result.success()
    }

    val fetched = fetchFeed(config)
    if (fetched != null) WidgetStore.saveFeed(context, fetched)
    val feed = WidgetFeed.parse(fetched ?: WidgetStore.feed(context))
    if (hasWidgets) WidgetRenderer.render(context, feed, config, allowNetwork = true)
    LiveNotifier.update(context, feed, config)

    if (feed?.hasLive == true) {
      WidgetScheduler.scheduleLiveTick(context, fromLiveTick = tags.contains(WidgetScheduler.LIVE_TAG))
    }
    val kickoffs = (feed?.fixtures.orEmpty() + listOfNotNull(feed?.primary)).distinctBy { it.fixtureId }
    kickoffs.forEach { WidgetScheduler.scheduleKickoff(context, it) }
    return Result.success()
  }

  private fun fetchFeed(config: WidgetConfig): String? {
    val query = buildList {
      if (config.teamIds.isNotEmpty()) add("teams=" + URLEncoder.encode(config.teamIds.joinToString(","), "UTF-8"))
      if (config.favoriteIds.isNotEmpty()) add("favorites=" + URLEncoder.encode(config.favoriteIds.joinToString(","), "UTF-8"))
      add("language=${config.language}")
    }.joinToString("&")
    val url = "${config.apiBase}/football/widget/followed?$query"
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
