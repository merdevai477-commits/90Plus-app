package expo.modules.widgetbridge

import java.util.Locale
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

internal data class FeedLineupPlayer(
  val name: String,
  val rating: Double?,
  val grid: String?,
  val number: Int?,
)

internal data class FeedLineup(
  val homeFormation: String?,
  val awayFormation: String?,
  val home: List<FeedLineupPlayer>,
  val away: List<FeedLineupPlayer>,
)

internal data class FeedStatPair(val home: Double, val away: Double)

internal data class FeedStats(
  val possession: FeedStatPair?,
  val shots: FeedStatPair?,
  val shotsOn: FeedStatPair?,
  val corners: FeedStatPair?,
  val xg: FeedStatPair?,
)

internal data class FeedEvent(val minute: Int, val extra: Int?, val kind: String, val side: String, val player: String)

internal data class FeedGoal(
  val minute: Int,
  val extra: Int?,
  val kind: String,
  val side: String,
  val player: String,
  val photo: String?,
)

internal data class FeedTeamInfo(val rank: Int?, val points: Int?, val played: Int?, val form: List<String>)

/** Goals oriented to this fixture: [homeGoals] belong to today's home side. */
internal data class FeedMeeting(val ts: Long, val homeGoals: Int, val awayGoals: Int)

internal data class FeedH2H(val homeWins: Int, val draws: Int, val awayWins: Int, val meetings: List<FeedMeeting>)

internal data class FeedInfo(
  val venue: String?,
  val city: String?,
  val venueImage: String?,
  val referee: String?,
  val home: FeedTeamInfo,
  val away: FeedTeamInfo,
  val h2h: FeedH2H?,
) {
  val hasBasics get() = venue != null || referee != null || home.rank != null || away.rank != null
  val hasForm get() = home.form.isNotEmpty() || away.form.isNotEmpty() || h2h != null
}

internal data class FeedFeatured(
  val fixtureId: Int,
  val topPlayers: List<FeedPlayer>,
  val momentum: List<FeedMomentumPoint>,
  val lineup: FeedLineup?,
  val stats: FeedStats?,
  val events: List<FeedEvent>,
  val goal: FeedGoal?,
  val info: FeedInfo?,
)

internal data class FeedOther(val match: FeedMatch, val featured: FeedFeatured?)

internal data class WidgetFeed(
  val hasLive: Boolean,
  val teams: List<FeedTeam>,
  val primary: FeedMatch?,
  val primaryReason: String?,
  val fixtures: List<FeedMatch>,
  val featured: FeedFeatured?,
  /** Further live matches the widget alternates through after [primary]. */
  val others: List<FeedOther> = emptyList(),
  /** Seconds until a just-finished [primary] gives way to the next fixture. */
  val refreshInSec: Int? = null,
) {
  val focusMatch: FeedMatch?
    get() = primary ?: featured?.let { f -> teams.firstOrNull { it.match?.fixtureId == f.fixtureId }?.match }

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
        val fixturesJson = body.optJSONArray("fixtures")
        val othersJson = body.optJSONArray("others")
        WidgetFeed(
          hasLive = body.optBoolean("hasLive"),
          teams = teams,
          primary = body.optJSONObject("primary")?.let(::parseMatch),
          primaryReason = body.optStringOrNull("primaryReason"),
          fixtures = (0 until (fixturesJson?.length() ?: 0)).mapNotNull { i ->
            fixturesJson?.optJSONObject(i)?.let(::parseMatch)
          },
          featured = body.optJSONObject("featured")?.let(::parseFeatured),
          others = (0 until (othersJson?.length() ?: 0)).mapNotNull { i ->
            val other = othersJson?.optJSONObject(i) ?: return@mapNotNull null
            val match = other.optJSONObject("match")?.let(::parseMatch) ?: return@mapNotNull null
            FeedOther(match, other.optJSONObject("featured")?.let(::parseFeatured))
          },
          refreshInSec = body.optIntOrNull("refreshInSec")?.takeIf { it > 0 },
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

    private fun parsePlayers(json: org.json.JSONArray?): List<FeedLineupPlayer> =
      (0 until (json?.length() ?: 0)).mapNotNull { i ->
        json?.optJSONObject(i)?.let {
          val rating = if (it.isNull("rating") || !it.has("rating")) null else it.optDouble("rating").takeIf { value ->
            !value.isNaN() && value > 0
          }
          FeedLineupPlayer(it.optString("name"), rating, it.optStringOrNull("grid"), it.optIntOrNull("number"))
        }
      }

    private fun parsePair(json: JSONObject?): FeedStatPair? {
      if (json == null || json.isNull("home") || json.isNull("away")) return null
      return FeedStatPair(json.optDouble("home"), json.optDouble("away"))
    }

    private fun parseFeatured(json: JSONObject): FeedFeatured {
      val players = json.optJSONArray("topPlayers")
      val momentum = json.optJSONArray("momentum")
      val lineup = json.optJSONObject("lineup")
      val stats = json.optJSONObject("stats")
      val events = json.optJSONArray("events")
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
        lineup = lineup?.let {
          FeedLineup(
            it.optStringOrNull("homeFormation"),
            it.optStringOrNull("awayFormation"),
            parsePlayers(it.optJSONArray("home")),
            parsePlayers(it.optJSONArray("away")),
          )
        },
        stats = stats?.let {
          FeedStats(
            parsePair(it.optJSONObject("possession")),
            parsePair(it.optJSONObject("shots")),
            parsePair(it.optJSONObject("shotsOn")),
            parsePair(it.optJSONObject("corners")),
            parsePair(it.optJSONObject("xg")),
          )
        },
        events = (0 until (events?.length() ?: 0)).mapNotNull { i ->
          events?.optJSONObject(i)?.let {
            FeedEvent(it.optInt("minute"), it.optIntOrNull("extra"), it.optString("kind"), it.optString("side"), it.optString("player"))
          }
        },
        goal = json.optJSONObject("goal")?.let {
          FeedGoal(
            it.optInt("minute"),
            it.optIntOrNull("extra"),
            it.optString("kind"),
            it.optString("side"),
            it.optString("player"),
            it.optStringOrNull("photo"),
          )
        },
        info = json.optJSONObject("info")?.let(::parseInfo),
      )
    }

    private fun parseTeamInfo(json: JSONObject?): FeedTeamInfo {
      val form = json?.optJSONArray("form")
      return FeedTeamInfo(
        rank = json?.optIntOrNull("rank"),
        points = json?.optIntOrNull("points"),
        played = json?.optIntOrNull("played"),
        form = (0 until (form?.length() ?: 0)).map { form!!.optString(it) }.filter { it in setOf("W", "D", "L") },
      )
    }

    private fun parseInfo(json: JSONObject): FeedInfo {
      val h2h = json.optJSONObject("h2h")
      val meetings = h2h?.optJSONArray("meetings")
      return FeedInfo(
        venue = json.optStringOrNull("venue"),
        city = json.optStringOrNull("city"),
        venueImage = json.optStringOrNull("venueImage"),
        referee = json.optStringOrNull("referee"),
        home = parseTeamInfo(json.optJSONObject("home")),
        away = parseTeamInfo(json.optJSONObject("away")),
        h2h = h2h?.let {
          FeedH2H(
            it.optInt("homeWins"),
            it.optInt("draws"),
            it.optInt("awayWins"),
            (0 until (meetings?.length() ?: 0)).mapNotNull { i ->
              meetings?.optJSONObject(i)?.let { m -> FeedMeeting(m.optLong("ts"), m.optInt("homeGoals"), m.optInt("awayGoals")) }
            },
          )
        },
      )
    }
  }
}

/** Mirrors front `formatLiveMinuteDisplay` — `45+2'` / `90+4'`, never bare 50' in 1H. */
internal object LiveMinuteFormat {
  private const val MAX_STOPPAGE = 20

  fun label(match: FeedMatch): String? =
    label(match.statusShort, match.elapsed, match.extra)

  fun label(statusShort: String, elapsed: Int?, extra: Int?): String? {
    val s = statusShort.trim().uppercase(Locale.US)
    if (s == "FT" || s == "AET" || s == "PEN" || s == "P") return null
    if (s == "HT") return "HT"
    if (s == "BT") return "BT"
    if (elapsed == null) return null

    if (s == "ET") return "${extraTimeMinute(elapsed, extra)} (ET)"

    if (s == "1H" || s == "2H" || s == "LIVE" || s == "INT") {
      val base = periodBase(s, elapsed)
      val useExtra = if (s == "1H" || elapsed >= base) extra else null
      return stoppage(base, elapsed, useExtra)
    }
    return null
  }

  private fun periodBase(statusShort: String, elapsed: Int): Int {
    val s = statusShort.trim().uppercase(Locale.US)
    if (s == "1H") return 45
    if (s == "ET") return if (elapsed >= 120) 120 else 90
    if (s == "LIVE" || s == "INT") {
      if (elapsed <= 45) return 45
      if (elapsed <= 90) return 90
      return if (elapsed >= 120) 120 else 90
    }
    return 90
  }

  private fun stoppage(base: Int, elapsed: Int, extra: Int?): String {
    if (elapsed > base) return "$base+${clamp(elapsed - base)}'"
    if (extra != null && extra > 0 && elapsed >= base) return "$base+${clamp(extra)}'"
    return "$elapsed'"
  }

  /** Extra time counts on (98', 113'); only 105' and 120' take stoppage. */
  private fun extraTimeMinute(elapsed: Int, extra: Int?): String {
    if (elapsed > 120) return "120+${clamp(elapsed - 120)}'"
    if (extra != null && extra > 0 && elapsed >= 105) {
      return "${if (elapsed >= 120) 120 else 105}+${clamp(extra)}'"
    }
    return "$elapsed'"
  }

  private fun clamp(n: Int): Int = n.coerceIn(1, MAX_STOPPAGE)
}
