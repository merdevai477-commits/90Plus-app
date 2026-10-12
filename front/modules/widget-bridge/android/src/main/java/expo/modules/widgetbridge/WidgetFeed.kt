package expo.modules.widgetbridge

import org.json.JSONObject

/** Mirrors `WidgetFeedPayload` from the backend `widget-feed.service.ts`. */
internal data class FeedSide(val id: Int, val name: String, val logo: String?)

internal data class FeedMatch(
  val fixtureId: Int,
  val status: String,
  val statusShort: String,
  val kickoffTs: Long,
  val elapsed: Int?,
  val extra: Int?,
  val home: FeedSide,
  val away: FeedSide,
  val homeScore: Int?,
  val awayScore: Int?,
  val leagueName: String,
) {
  val isLive get() = status == "live" || status == "ht"
}

internal data class FeedTeam(val teamId: Int, val name: String, val logo: String?, val match: FeedMatch?)

internal data class FeedPlayer(val name: String, val rating: Double, val side: String, val photo: String?)

internal data class FeedMomentumPoint(val minute: Int, val home: Int, val away: Int)

internal data class FeedFeatured(
  val fixtureId: Int,
  val topPlayers: List<FeedPlayer>,
  val momentum: List<FeedMomentumPoint>,
)

internal data class WidgetFeed(
  val hasLive: Boolean,
  val teams: List<FeedTeam>,
  val featured: FeedFeatured?,
) {
  val featuredMatch: FeedMatch?
    get() = featured?.let { f -> teams.firstOrNull { it.match?.fixtureId == f.fixtureId }?.match }

  companion object {
    fun parse(raw: String?): WidgetFeed? {
      if (raw.isNullOrBlank()) return null
      return try {
        val root = JSONObject(raw)
        val body = root.optJSONObject("response") ?: root
        val teamsJson = body.optJSONArray("teams")
        val teams = (0 until (teamsJson?.length() ?: 0)).mapNotNull { i ->
          teamsJson?.optJSONObject(i)?.let(::parseTeam)
        }
        WidgetFeed(
          hasLive = body.optBoolean("hasLive"),
          teams = teams,
          featured = body.optJSONObject("featured")?.let(::parseFeatured),
        )
      } catch (_: Exception) {
        null
      }
    }

    private fun JSONObject.optIntOrNull(key: String): Int? =
      if (isNull(key) || !has(key)) null else optInt(key)

    private fun JSONObject.optStringOrNull(key: String): String? =
      if (isNull(key) || !has(key)) null else optString(key).ifBlank { null }

    private fun parseSide(json: JSONObject?): FeedSide =
      FeedSide(
        id = json?.optInt("id") ?: 0,
        name = json?.optString("name").orEmpty(),
        logo = json?.optStringOrNull("logo"),
      )

    private fun parseMatch(json: JSONObject): FeedMatch {
      val score = json.optJSONObject("score")
      return FeedMatch(
        fixtureId = json.optInt("fixtureId"),
        status = json.optString("status"),
        statusShort = json.optString("statusShort"),
        kickoffTs = json.optLong("kickoffTs"),
        elapsed = json.optIntOrNull("elapsed"),
        extra = json.optIntOrNull("extra"),
        home = parseSide(json.optJSONObject("home")),
        away = parseSide(json.optJSONObject("away")),
        homeScore = score?.optIntOrNull("home"),
        awayScore = score?.optIntOrNull("away"),
        leagueName = json.optJSONObject("league")?.optString("name").orEmpty(),
      )
    }

    private fun parseTeam(json: JSONObject): FeedTeam =
      FeedTeam(
        teamId = json.optInt("teamId"),
        name = json.optString("name"),
        logo = json.optStringOrNull("logo"),
        match = json.optJSONObject("match")?.let(::parseMatch),
      )

    private fun parseFeatured(json: JSONObject): FeedFeatured {
      val players = json.optJSONArray("topPlayers")
      val momentum = json.optJSONArray("momentum")
      return FeedFeatured(
        fixtureId = json.optInt("fixtureId"),
        topPlayers = (0 until (players?.length() ?: 0)).mapNotNull { i ->
          players?.optJSONObject(i)?.let {
            FeedPlayer(it.optString("name"), it.optDouble("rating"), it.optString("side"), it.optStringOrNull("photo"))
          }
        },
        momentum = (0 until (momentum?.length() ?: 0)).mapNotNull { i ->
          momentum?.optJSONObject(i)?.let {
            FeedMomentumPoint(it.optInt("minute"), it.optInt("home"), it.optInt("away"))
          }
        },
      )
    }
  }
}
