package expo.modules.widgetbridge

import android.content.Context
import org.json.JSONObject

internal data class WidgetLabels(
  val live: String,
  val upcoming: String,
  val finished: String,
  val halftime: String,
  val postponed: String,
  val topPlayers: String,
  val momentum: String,
  val myTeams: String,
  val followTeams: String,
  val vs: String,
  val today: String,
  val tomorrow: String,
) {
  companion object {
    val DEFAULT = WidgetLabels(
      live = "Live",
      upcoming = "Upcoming",
      finished = "FT",
      halftime = "HT",
      postponed = "Postponed",
      topPlayers = "Top players",
      momentum = "Momentum",
      myTeams = "My teams",
      followTeams = "Follow teams in 90PLUS to see their matches here",
      vs = "vs",
      today = "Today",
      tomorrow = "Tomorrow",
    )

    fun parse(json: JSONObject?): WidgetLabels {
      if (json == null) return DEFAULT
      fun s(key: String, fallback: String) = json.optString(key).ifBlank { fallback }
      return WidgetLabels(
        live = s("live", DEFAULT.live),
        upcoming = s("upcoming", DEFAULT.upcoming),
        finished = s("finished", DEFAULT.finished),
        halftime = s("halftime", DEFAULT.halftime),
        postponed = s("postponed", DEFAULT.postponed),
        topPlayers = s("topPlayers", DEFAULT.topPlayers),
        momentum = s("momentum", DEFAULT.momentum),
        myTeams = s("myTeams", DEFAULT.myTeams),
        followTeams = s("followTeams", DEFAULT.followTeams),
        vs = s("vs", DEFAULT.vs),
        today = s("today", DEFAULT.today),
        tomorrow = s("tomorrow", DEFAULT.tomorrow),
      )
    }
  }
}

internal data class WidgetConfig(
  val teamIds: List<Int>,
  val apiBase: String,
  val language: String,
  val labels: WidgetLabels,
)

/** Shared between the JS bridge (writer) and the widget provider/worker (readers). */
internal object WidgetStore {
  private const val PREFS = "ninetyplus_widget"
  private const val KEY_CONFIG = "widget.config"
  private const val KEY_FEED = "widget.feed"
  private const val KEY_FEED_AT = "widget.feedAt"

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveConfig(context: Context, json: String) {
    prefs(context).edit().putString(KEY_CONFIG, json).apply()
  }

  fun config(context: Context): WidgetConfig? {
    val raw = prefs(context).getString(KEY_CONFIG, null) ?: return null
    return try {
      val json = JSONObject(raw)
      val ids = json.optJSONArray("teamIds")
      val teamIds = (0 until (ids?.length() ?: 0)).mapNotNull { i -> ids?.optInt(i)?.takeIf { it > 0 } }
      WidgetConfig(
        teamIds = teamIds,
        apiBase = json.optString("apiBase").trimEnd('/'),
        language = json.optString("language").ifBlank { "en" },
        labels = WidgetLabels.parse(json.optJSONObject("labels")),
      )
    } catch (_: Exception) {
      null
    }
  }

  fun saveFeed(context: Context, json: String) {
    prefs(context).edit()
      .putString(KEY_FEED, json)
      .putLong(KEY_FEED_AT, System.currentTimeMillis())
      .apply()
  }

  fun feed(context: Context): String? = prefs(context).getString(KEY_FEED, null)

  fun clearFeed(context: Context) {
    prefs(context).edit().remove(KEY_FEED).remove(KEY_FEED_AT).apply()
  }
}
