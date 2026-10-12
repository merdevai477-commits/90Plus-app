package expo.modules.widgetbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.net.Uri
import android.os.Build
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

internal object WidgetRenderer {
  private const val MATCHES_URI = "ninetyplus://matches"
  private const val SEARCH_URI = "ninetyplus://search"
  private const val LIVE_TEXT = 0xFFDE1F1F.toInt()
  private const val IDLE_TEXT = 0xFF8C8C8C.toInt()
  private const val PURPLE = 0xFF8B5CF6.toInt()
  /** After the user pages manually, auto-rotation waits this long before taking over again. */
  private const val NAV_HOLD_MS = 2 * 60_000L

  fun widgetIds(context: Context): IntArray =
    AppWidgetManager.getInstance(context)
      .getAppWidgetIds(ComponentName(context, MatchesWidgetProvider::class.java))

  /** Instant redraw from the last saved feed and on-disk images; never touches the network. */
  fun renderCached(context: Context) {
    render(context, WidgetFeed.parse(WidgetStore.feed(context)), WidgetStore.config(context), allowNetwork = false)
  }

  fun render(context: Context, feed: WidgetFeed?, config: WidgetConfig?, allowNetwork: Boolean) {
    val ids = widgetIds(context)
    if (ids.isEmpty()) return
    val views = build(context, feed, config, allowNetwork, Sizing.of(context, ids.first()))
    AppWidgetManager.getInstance(context).updateAppWidget(ids, views)
  }

  /** Space the launcher actually gave the widget, so every page fits without clipping. */
  private data class Sizing(val widthDp: Int, val heightDp: Int) {
    /** Page padding is 8dp top and 26dp bottom (the arrows sit there). */
    val pageBody get() = heightDp - 34
    /** Below the one-line detail header. */
    val detailBody get() = pageBody - 24

    fun rows(rowDp: Int, cap: Int) = (detailBody / rowDp).coerceIn(1, cap)

    companion object {
      fun of(context: Context, widgetId: Int): Sizing {
        val options = AppWidgetManager.getInstance(context).getAppWidgetOptions(widgetId)
        val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).takeIf { it > 0 } ?: 250
        val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT).takeIf { it > 0 } ?: 110
        return Sizing(width, height)
      }
    }
  }

  /** View sizes can only change from RemoteViews on Android 12+; older launchers keep the XML size. */
  private fun RemoteViews.sizeDp(viewId: Int, widthDp: Int, heightDp: Int) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    setViewLayoutWidth(viewId, widthDp.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
    setViewLayoutHeight(viewId, heightDp.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
  }

  /**
   * The host merges partial updates into the cached views and reapplies all of them, and repeated
   * showNext actions collapse into one, so every tap would land on page 1. Track the index instead.
   */
  fun flip(context: Context, forward: Boolean) {
    if (widgetIds(context).isEmpty()) return
    val current = WidgetStore.heldPage(context, NAV_HOLD_MS) ?: 0
    WidgetStore.savePage(context, current + if (forward) 1 else -1)
    renderCached(context)
  }

  private fun build(
    context: Context,
    feed: WidgetFeed?,
    config: WidgetConfig?,
    allowNetwork: Boolean,
    size: Sizing,
  ): RemoteViews {
    val labels = config?.labels ?: WidgetLabels.DEFAULT
    val images = ImageResolver(context, allowNetwork)

    val pages = mutableListOf<RemoteViews>()
    val noScope = config == null || (config.teamIds.isEmpty() && config.favoriteIds.isEmpty())
    val arabic = config?.language?.startsWith("ar") == true
    // Home stays on the left. Arabic copy still renders inside each text view.
    when {
      noScope -> pages += messagePage(context, labels.followTeams, SEARCH_URI)
      feed == null -> pages += messagePage(context, "", MATCHES_URI)
      else -> {
        val focus = feed.focusMatch
        val featured = feed.featured?.takeIf { it.fixtureId == focus?.fixtureId }
        val goal = featured?.goal?.takeIf { focus?.isLive == true }
        // The live match and everything about it come first; other clubs' cards follow.
        if (focus != null && goal != null) pages += goalPage(context, focus, goal, labels, images, size)
        if (focus != null) pages += matchPage(context, focus, labels, images, size, featured?.events.orEmpty())
        if (focus != null && featured != null) {
          if (featured.events.isNotEmpty()) pages += eventsPage(context, focus, featured.events, labels, images, size)
          featured.stats?.takeIf { hasStats(it) }?.let {
            pages += statsPage(context, focus, it, labels, images, arabic, size)
          }
          if (featured.momentum.size >= 2) {
            pages += momentumPage(context, focus, featured.momentum, labels, images, size)
          }
          featured.lineup?.let { pages += lineupPage(context, focus, it, labels, images, size) }
          if (featured.topPlayers.isNotEmpty()) {
            pages += playersPage(context, focus, featured.topPlayers, labels, images, size)
          }
          featured.info?.takeIf { it.hasBasics }?.let { pages += infoPage(context, focus, it, labels, images, size) }
          featured.info?.takeIf { it.hasForm }?.let { pages += formPage(context, focus, it, labels, images, arabic, size) }
        }
        // Badges on missing view ids are ignored, so this marks the score card and every mini header.
        if (goal != null) pages.forEach { markGoal(it, labels) }
        // A live followed match owns the widget until the final whistle; the other fixtures return after.
        if (focus?.isLive != true) feed.fixtures.forEach { pages += matchPage(context, it, labels, images, size) }
        if (pages.isEmpty()) pages += messagePage(context, labels.followTeams, SEARCH_URI)
      }
    }

    val held = WidgetStore.heldPage(context, NAV_HOLD_MS)
    val root = RemoteViews(context.packageName, if (held == null) R.layout.np_widget_root else R.layout.np_widget_root_manual)
    root.removeAllViews(R.id.np_flipper)
    // Dot is 5dp + 4dp gap; leave the arrows (72dp) and side margins clear.
    val showDots = pages.size in 2..((size.widthDp - 110) / 9)
    pages.forEachIndexed { index, page ->
      page.setInt(R.id.np_page, "setLayoutDirection", View.LAYOUT_DIRECTION_LTR)
      val frame = RemoteViews(context.packageName, R.layout.np_widget_page_frame)
      frame.addView(R.id.np_frame_slot, page)
      if (showDots) {
        for (dot in pages.indices) {
          val layout = if (dot == index) R.layout.np_widget_dot_active else R.layout.np_widget_dot
          frame.addView(R.id.np_dots, RemoteViews(context.packageName, layout))
        }
      }
      root.addView(R.id.np_flipper, frame)
    }
    if (held != null) root.setDisplayedChild(R.id.np_flipper, Math.floorMod(held, pages.size))
    root.setViewVisibility(R.id.np_nav, if (pages.size > 1) View.VISIBLE else View.GONE)
    root.setOnClickPendingIntent(R.id.np_prev, navIntent(context, MatchesWidgetProvider.ACTION_PREV))
    root.setOnClickPendingIntent(R.id.np_next, navIntent(context, MatchesWidgetProvider.ACTION_NEXT))
    return root
  }

  // region Pages

  /** Leads the widget for a few match minutes after a goal. */
  private fun goalPage(
    context: Context,
    match: FeedMatch,
    goal: FeedGoal,
    labels: WidgetLabels,
    images: ImageResolver,
    size: Sizing,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_goal)
    applyMiniHeader(views, match, match.leagueName, labels, images)
    val team = if (goal.side == "home") match.home else match.away
    val who = goal.player.ifBlank { team.name } + when (goal.kind) {
      "penalty" -> " (P)"
      "own_goal" -> " (OG)"
      else -> ""
    }
    val minute = "${goal.minute}${goal.extra?.let { "+$it" }.orEmpty()}\u2019"
    views.setTextViewText(R.id.np_goal_title, labels.goal)
    // Photo, title, name and meta need about 65dp plus the photo; short widgets drop to two lines.
    if (size.detailBody < 90) {
      views.setViewVisibility(R.id.np_goal_photo, View.GONE)
      views.setViewVisibility(R.id.np_goal_meta, View.GONE)
      views.textSp(R.id.np_goal_title, 16f)
      views.setTextViewText(R.id.np_goal_player, "$who  $minute")
    } else {
      val photoDp = (size.detailBody - 65).coerceIn(28, 72)
      views.sizeDp(R.id.np_goal_photo, photoDp, photoDp)
      val photo = images.photo(goal.photo) ?: images.crest(team.logo)
      if (photo != null) views.setImageViewBitmap(R.id.np_goal_photo, photo)
      else views.setViewVisibility(R.id.np_goal_photo, View.GONE)
      views.setTextViewText(R.id.np_goal_player, who)
      views.setTextViewText(R.id.np_goal_meta, if (goal.player.isBlank()) minute else "$minute  \u00B7  ${team.name}")
    }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  private fun infoPage(
    context: Context,
    match: FeedMatch,
    info: FeedInfo,
    labels: WidgetLabels,
    images: ImageResolver,
    size: Sizing,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_info)
    applyMiniHeader(views, match, labels.info, labels, images)
    images.cover(info.venueImage, size.widthDp.toFloat() / size.heightDp, 24f / size.widthDp)?.let {
      views.setImageViewBitmap(R.id.np_info_bg, it)
      views.setViewVisibility(R.id.np_info_bg, View.VISIBLE)
    }
    // Venue 34dp, referee 24dp, table 32dp.
    var room = size.detailBody
    val showVenue = info.venue != null
    if (showVenue) room -= 34
    views.setViewVisibility(R.id.np_info_venue_row, if (showVenue) View.VISIBLE else View.GONE)
    views.setTextViewText(R.id.np_info_venue, info.venue.orEmpty())
    views.setTextViewText(R.id.np_info_city, info.city.orEmpty())
    views.setViewVisibility(R.id.np_info_city, if (info.city != null) View.VISIBLE else View.GONE)

    val showReferee = info.referee != null && room >= 24
    if (showReferee) room -= 24
    views.setViewVisibility(R.id.np_info_ref_row, if (showReferee) View.VISIBLE else View.GONE)
    views.setTextViewText(R.id.np_info_referee, "${labels.referee}: ${info.referee.orEmpty()}")

    val showTable = (info.home.rank != null || info.away.rank != null) && room >= 32
    views.setViewVisibility(R.id.np_info_table_row, if (showTable) View.VISIBLE else View.GONE)
    if (showTable) {
      images.crest(match.home.logo)?.let { views.setImageViewBitmap(R.id.np_info_home_logo, it) }
      images.crest(match.away.logo)?.let { views.setImageViewBitmap(R.id.np_info_away_logo, it) }
      views.setTextViewText(R.id.np_info_home_rank, info.home.rank?.let { "#$it" } ?: "-")
      views.setTextViewText(R.id.np_info_away_rank, info.away.rank?.let { "#$it" } ?: "-")
      views.setTextViewText(R.id.np_info_home_pts, info.home.points?.let { "$it ${labels.points}" }.orEmpty())
      views.setTextViewText(R.id.np_info_away_pts, info.away.points?.let { "$it ${labels.points}" }.orEmpty())
    }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  private fun formPage(
    context: Context,
    match: FeedMatch,
    info: FeedInfo,
    labels: WidgetLabels,
    images: ImageResolver,
    arabic: Boolean,
    size: Sizing,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_form)
    applyMiniHeader(views, match, labels.form, labels, images)
    var room = size.detailBody

    val hasForm = info.home.form.isNotEmpty() || info.away.form.isNotEmpty()
    views.setViewVisibility(R.id.np_form_home_row, if (hasForm) View.VISIBLE else View.GONE)
    views.setViewVisibility(R.id.np_form_away_row, if (hasForm) View.VISIBLE else View.GONE)
    if (hasForm) {
      room -= 44
      formRow(context, views, R.id.np_form_home_logo, R.id.np_form_home_name, R.id.np_form_home_chips, match.home, info.home, images, arabic)
      formRow(context, views, R.id.np_form_away_logo, R.id.np_form_away_name, R.id.np_form_away_chips, match.away, info.away, images, arabic)
    }

    val h2h = info.h2h?.takeIf { it.homeWins + it.draws + it.awayWins > 0 }
    val showH2h = h2h != null && (room >= 34 || !hasForm)
    views.setViewVisibility(R.id.np_h2h_row, if (showH2h) View.VISIBLE else View.GONE)
    views.removeAllViews(R.id.np_meetings)
    if (h2h != null && showH2h) {
      room -= 38
      images.crest(match.home.logo)?.let { views.setImageViewBitmap(R.id.np_h2h_home_logo, it) }
      images.crest(match.away.logo)?.let { views.setImageViewBitmap(R.id.np_h2h_away_logo, it) }
      views.setTextViewText(R.id.np_h2h_home_wins, h2h.homeWins.toString())
      views.setTextViewText(R.id.np_h2h_away_wins, h2h.awayWins.toString())
      views.setTextViewText(R.id.np_h2h_draws, "${labels.draws} ${h2h.draws}")
      for (meeting in h2h.meetings.take((room / 20).coerceIn(0, 3))) {
        val row = RemoteViews(context.packageName, R.layout.np_widget_meeting_row)
        row.setTextViewText(
          R.id.np_meeting_date,
          latinDigits(SimpleDateFormat("d MMM yy", Locale.getDefault()).format(Date(meeting.ts * 1000))),
        )
        row.setTextViewText(R.id.np_meeting_score, "${meeting.homeGoals} - ${meeting.awayGoals}")
        images.crest(match.home.logo)?.let { row.setImageViewBitmap(R.id.np_meeting_home_logo, it) }
        images.crest(match.away.logo)?.let { row.setImageViewBitmap(R.id.np_meeting_away_logo, it) }
        views.addView(R.id.np_meetings, row)
      }
    }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  /** Last results oldest to newest, so the most recent chip sits next to the edge. */
  private fun formRow(
    context: Context,
    views: RemoteViews,
    logoId: Int,
    nameId: Int,
    chipsId: Int,
    side: FeedSide,
    team: FeedTeamInfo,
    images: ImageResolver,
    arabic: Boolean,
  ) {
    images.crest(side.logo)?.let { views.setImageViewBitmap(logoId, it) }
    views.setTextViewText(nameId, side.name)
    views.removeAllViews(chipsId)
    for (result in team.form) {
      val chip = RemoteViews(context.packageName, R.layout.np_widget_form_chip)
      val (letter, background) = when (result) {
        "W" -> (if (arabic) "\u0641" else "W") to R.drawable.np_widget_form_w
        "L" -> (if (arabic) "\u062E" else "L") to R.drawable.np_widget_form_l
        else -> (if (arabic) "\u062A" else "D") to R.drawable.np_widget_form_d
      }
      chip.setTextViewText(R.id.np_form_chip, letter)
      chip.setInt(R.id.np_form_chip, "setBackgroundResource", background)
      views.addView(chipsId, chip)
    }
  }

  private fun matchPage(
    context: Context,
    match: FeedMatch,
    labels: WidgetLabels,
    images: ImageResolver,
    size: Sizing,
    events: List<FeedEvent> = emptyList(),
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_match)
    // brand 17 + league 13 + gap 6 + crest + gap 9 + name 16, then 3 + 13 per scorer line
    val showLeague = match.leagueName.isNotBlank() && size.pageBody >= 100
    val room = size.pageBody - if (showLeague) 61 else 48
    val homeScorers = scorerLines(events, "home")
    val awayScorers = scorerLines(events, "away")
    val wanted = maxOf(homeScorers.size, awayScorers.size)
    // Scorers only take space the crest does not need to stay at least 40dp.
    val scorerRows = if (wanted == 0) 0 else ((room - 43) / 13).coerceIn(0, minOf(wanted, 4))
    val crest = (room - if (scorerRows > 0) 3 + scorerRows * 13 else 0).coerceIn(26, 64)
    views.sizeDp(R.id.np_home_logo, crest, crest)
    views.sizeDp(R.id.np_away_logo, crest, crest)
    views.setViewVisibility(R.id.np_scorers, if (scorerRows > 0) View.VISIBLE else View.GONE)
    applyScorers(views, R.id.np_home_scorers, homeScorers, scorerRows)
    applyScorers(views, R.id.np_away_scorers, awayScorers, scorerRows)
    views.setTextViewText(R.id.np_league, match.leagueName)
    views.setViewVisibility(R.id.np_league, if (showLeague) View.VISIBLE else View.GONE)
    views.setTextViewText(R.id.np_home_name, match.home.name)
    views.setTextViewText(R.id.np_away_name, match.away.name)
    images.crest(match.home.logo)?.let { views.setImageViewBitmap(R.id.np_home_logo, it) }
    images.crest(match.away.logo)?.let { views.setImageViewBitmap(R.id.np_away_logo, it) }
    applyBadge(views, R.id.np_badge, match, labels)

    val hasScore = match.homeScore != null && match.awayScore != null
    views.setViewVisibility(R.id.np_score, if (hasScore) View.VISIBLE else View.GONE)
    views.setViewVisibility(R.id.np_center, if (hasScore) View.GONE else View.VISIBLE)
    if (hasScore) {
      views.setTextViewText(R.id.np_score_home, match.homeScore.toString())
      views.setTextViewText(R.id.np_score_away, match.awayScore.toString())
    } else {
      views.setTextViewText(R.id.np_center, clock(match.kickoffTs))
    }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  /** "Guerrero 13', 37'" per scorer, in the order they first scored. */
  private fun scorerLines(events: List<FeedEvent>, side: String): List<String> {
    val byPlayer = LinkedHashMap<String, MutableList<String>>()
    for (event in events) {
      if (event.side != side || event.kind !in setOf("goal", "penalty", "own_goal")) continue
      val name = (shortName(event.player) + if (event.kind == "own_goal") " (OG)" else "").trim()
      val minute = eventMinute(event) + if (event.kind == "penalty") " (P)" else ""
      byPlayer.getOrPut(name) { mutableListOf() } += minute
    }
    // Some leagues publish goals without the scorer; then only the minutes are listed.
    return byPlayer.map { (name, minutes) -> listOf(name, minutes.joinToString(", ")).filter { it.isNotBlank() }.joinToString(" ") }
  }

  private fun RemoteViews.textSp(viewId: Int, sp: Float) =
    setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_SP, sp)

  private fun RemoteViews.padVertical(context: Context, viewId: Int, dp: Int) {
    val px = (dp * context.resources.displayMetrics.density).toInt()
    setViewPadding(viewId, 0, px, 0, px)
  }

  private fun applyScorers(views: RemoteViews, viewId: Int, lines: List<String>, rows: Int) {
    if (rows <= 0) return
    views.setTextViewText(viewId, lines.take(rows).joinToString("\n"))
    views.setInt(viewId, "setMaxLines", rows)
  }

  private fun eventMinute(event: FeedEvent): String =
    "${event.minute}${event.extra?.let { "+$it" }.orEmpty()}\u2019"

  private fun eventsPage(
    context: Context,
    match: FeedMatch,
    events: List<FeedEvent>,
    labels: WidgetLabels,
    images: ImageResolver,
    size: Sizing,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_events)
    applyMiniHeader(views, match, labels.events, labels, images)
    views.removeAllViews(R.id.np_event_rows)
    // Tall widgets get larger rows instead of a small list floating in empty space.
    val roomy = size.detailBody >= 150
    for (event in events.takeLast(size.rows(if (roomy) 30 else 24, events.size))) {
      val row = RemoteViews(context.packageName, R.layout.np_widget_event_row)
      if (roomy) {
        row.padVertical(context, R.id.np_event_row, 6)
        row.textSp(R.id.np_event_home_name, 13f)
        row.textSp(R.id.np_event_away_name, 13f)
      }
      val home = event.side == "home"
      val who = if (event.player.isBlank()) (if (home) match.home.name else match.away.name) else shortName(event.player)
      val name = who + when (event.kind) {
        "penalty" -> " (P)"
        "own_goal" -> " (OG)"
        else -> ""
      }
      val icon = when (event.kind) {
        "own_goal" -> R.drawable.np_ic_ball_own
        "red" -> R.drawable.np_ic_card_red
        "yellow" -> R.drawable.np_ic_card_yellow
        else -> R.drawable.np_ic_ball
      }
      row.setTextViewText(R.id.np_event_home_name, if (home) name else "")
      row.setTextViewText(R.id.np_event_away_name, if (home) "" else name)
      row.setViewVisibility(R.id.np_event_home_icon, if (home) View.VISIBLE else View.INVISIBLE)
      row.setViewVisibility(R.id.np_event_away_icon, if (home) View.INVISIBLE else View.VISIBLE)
      row.setImageViewResource(if (home) R.id.np_event_home_icon else R.id.np_event_away_icon, icon)
      row.setTextViewText(R.id.np_event_minute, eventMinute(event))
      views.addView(R.id.np_event_rows, row)
    }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  private fun lineupPage(
    context: Context,
    match: FeedMatch,
    lineup: FeedLineup,
    labels: WidgetLabels,
    images: ImageResolver,
    size: Sizing,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_lineup)
    applyMiniHeader(views, match, labels.lineup, labels, images)
    views.setTextViewText(R.id.np_formation_home, formationLine(match.home.name, lineup.homeFormation))
    views.setTextViewText(R.id.np_formation_away, formationLine(match.away.name, lineup.awayFormation))
    views.removeAllViews(R.id.np_lineup_home)
    views.removeAllViews(R.id.np_lineup_away)
    // The formation line takes one row; each player row is 14dp.
    val shown = ((size.detailBody - 18) / 14).coerceIn(3, 11)
    lineup.home.take(shown).forEach { views.addView(R.id.np_lineup_home, lineupName(context, it)) }
    lineup.away.take(shown).forEach { views.addView(R.id.np_lineup_away, lineupName(context, it)) }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  private fun formationLine(team: String, formation: String?): String =
    listOf(team, formation.orEmpty()).filter { it.isNotBlank() }.joinToString("  ")

  private fun lineupName(context: Context, player: FeedLineupPlayer): RemoteViews {
    val row = RemoteViews(context.packageName, R.layout.np_widget_lineup_name)
    row.setTextViewText(R.id.np_lineup_number, player.number?.toString().orEmpty())
    row.setTextViewText(R.id.np_lineup_name, shortName(player.name))
    row.setTextViewText(R.id.np_lineup_rating, player.rating?.let { String.format(Locale.US, "%.1f", it) }.orEmpty())
    return row
  }

  private fun statsPage(
    context: Context,
    match: FeedMatch,
    stats: FeedStats,
    labels: WidgetLabels,
    images: ImageResolver,
    arabic: Boolean,
    size: Sizing,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_stats)
    applyMiniHeader(views, match, labels.stats, labels, images)
    views.removeAllViews(R.id.np_stat_rows)
    val roomy = size.detailBody >= 150
    // The share bar adds 7dp per row, so short widgets keep plain numbers.
    val bars = size.detailBody >= 110
    var room = size.rows(if (roomy) 36 else if (bars) 27 else 19, 5)
    fun add(key: String, pair: FeedStatPair?, percent: Boolean, decimal: Boolean) {
      if (pair == null || room <= 0) return
      room--
      val row = RemoteViews(context.packageName, R.layout.np_widget_stat_row)
      if (roomy) {
        row.padVertical(context, R.id.np_stat_row, if (bars) 4 else 7)
        row.textSp(R.id.np_stat_home, 16f)
        row.textSp(R.id.np_stat_away, 16f)
        row.textSp(R.id.np_stat_label, 12f)
      }
      row.setTextViewText(R.id.np_stat_label, statLabel(key, arabic))
      row.setTextViewText(R.id.np_stat_home, formatStat(pair.home, percent, decimal))
      row.setTextViewText(R.id.np_stat_away, formatStat(pair.away, percent, decimal))
      val total = pair.home + pair.away
      if (bars && total > 0) {
        row.setViewVisibility(R.id.np_stat_bar, View.VISIBLE)
        row.setProgressBar(R.id.np_stat_bar, 1000, (pair.home / total * 1000).toInt(), false)
      }
      views.addView(R.id.np_stat_rows, row)
    }
    add("possession", stats.possession, percent = true, decimal = false)
    add("shotsOn", stats.shotsOn, percent = false, decimal = false)
    add("shots", stats.shots, percent = false, decimal = false)
    add("xg", stats.xg, percent = false, decimal = true)
    add("corners", stats.corners, percent = false, decimal = false)
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  private fun hasStats(stats: FeedStats): Boolean =
    listOf(stats.possession, stats.shots, stats.shotsOn, stats.corners, stats.xg).any { it != null }

  private fun formatStat(value: Double, percent: Boolean, decimal: Boolean): String {
    val text = if (decimal) String.format(Locale.US, "%.1f", value) else String.format(Locale.US, "%.0f", value)
    return if (percent) "$text%" else text
  }

  private fun statLabel(key: String, arabic: Boolean): String = when (key) {
    "possession" -> if (arabic) "استحواذ" else "Possession"
    "shots" -> if (arabic) "تسديدات" else "Shots"
    "shotsOn" -> if (arabic) "على المرمى" else "On target"
    "corners" -> if (arabic) "ركنيات" else "Corners"
    else -> "xG"
  }

  private fun playersPage(
    context: Context,
    match: FeedMatch,
    players: List<FeedPlayer>,
    labels: WidgetLabels,
    images: ImageResolver,
    size: Sizing,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_players)
    applyMiniHeader(views, match, labels.topPlayers, labels, images)
    views.removeAllViews(R.id.np_players)
    // Name and rating chip under the photo take about 37dp.
    val photoDp = (size.detailBody - 37).coerceIn(22, 52)
    for (player in players.take(3)) {
      val tile = RemoteViews(context.packageName, R.layout.np_widget_player)
      tile.sizeDp(R.id.np_player_photo, photoDp, photoDp)
      val photo = images.photo(player.photo)
        ?: images.crest(if (player.side == "home") match.home.logo else match.away.logo)
      photo?.let { tile.setImageViewBitmap(R.id.np_player_photo, it) }
      tile.setTextViewText(R.id.np_player_name, shortName(player.name))
      tile.setTextViewText(R.id.np_player_rating, String.format(Locale.US, "%.1f \u2605", player.rating))
      views.addView(R.id.np_players, tile)
    }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  private fun momentumPage(
    context: Context,
    match: FeedMatch,
    points: List<FeedMomentumPoint>,
    labels: WidgetLabels,
    images: ImageResolver,
    size: Sizing,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_momentum)
    applyMiniHeader(views, match, labels.momentum, labels, images)
    val density = context.resources.displayMetrics.density
    val width = ((size.widthDp - 24) * density).toInt().coerceAtLeast(200)
    val height = (size.detailBody.coerceAtLeast(36) * density).toInt()
    views.setImageViewBitmap(R.id.np_momentum_chart, momentumChart(context, points, width, height, labels.halftime))
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  /** "Mohamed Salah" -> "Salah"; keeps single names and particles like "De Bruyne" readable. */
  private fun shortName(full: String): String {
    val parts = full.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (parts.size <= 1) return parts.firstOrNull().orEmpty()
    val particles = setOf("de", "da", "di", "van", "von", "der", "del", "la", "le", "el", "al", "dos", "ben", "bin", "abu")
    val second = parts[parts.size - 2]
    return if (second.lowercase() in particles) "$second ${parts.last()}" else parts.last()
  }

  private fun messagePage(context: Context, text: String, uri: String): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_message)
    views.setTextViewText(R.id.np_message, text)
    views.setViewVisibility(R.id.np_message, if (text.isBlank()) View.GONE else View.VISIBLE)
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, uri))
    return views
  }

  // endregion

  private fun applyMiniHeader(views: RemoteViews, match: FeedMatch, title: String, labels: WidgetLabels, images: ImageResolver) {
    views.setTextViewText(R.id.np_header_title, title)
    views.setTextViewText(R.id.np_header_score, "${match.homeScore ?: 0} - ${match.awayScore ?: 0}")
    images.crest(match.home.logo)?.let { views.setImageViewBitmap(R.id.np_header_home_logo, it) }
    images.crest(match.away.logo)?.let { views.setImageViewBitmap(R.id.np_header_away_logo, it) }
    applyBadge(views, R.id.np_header_badge, match, labels)
  }

  private fun applyBadge(views: RemoteViews, viewId: Int, match: FeedMatch, labels: WidgetLabels) {
    views.setTextViewText(viewId, badgeText(match, labels))
    views.setTextColor(viewId, if (match.isLive) LIVE_TEXT else IDLE_TEXT)
    views.setInt(
      viewId,
      "setBackgroundResource",
      if (match.isLive) R.drawable.np_widget_chip_live else R.drawable.np_widget_chip_idle,
    )
  }

  private fun markGoal(views: RemoteViews, labels: WidgetLabels) {
    for (viewId in intArrayOf(R.id.np_badge, R.id.np_header_badge)) {
      views.setTextViewText(viewId, labels.goal)
      views.setTextColor(viewId, Color.WHITE)
      views.setInt(viewId, "setBackgroundResource", R.drawable.np_widget_chip_goal)
    }
  }

  private fun badgeText(match: FeedMatch, labels: WidgetLabels): String = when (match.status) {
    "live" -> match.elapsed?.let { elapsed ->
      val extra = match.extra?.takeIf { it > 0 }?.let { "+$it" } ?: ""
      "$elapsed$extra\u2019"
    } ?: labels.live
    "ht" -> labels.halftime
    "ft" -> labels.finished
    "off" -> labels.postponed
    else -> if (isToday(match.kickoffTs)) labels.upcoming else dayLabel(match.kickoffTs, labels)
  }

  private fun clock(kickoffTs: Long): String =
    SimpleDateFormat("HH:mm", Locale.US).format(Date(kickoffTs * 1000))

  private fun isToday(kickoffTs: Long): Boolean = dayOffset(kickoffTs) == 0

  private fun dayOffset(kickoffTs: Long): Int {
    val today = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }
    val diff = kickoffTs * 1000 - today.timeInMillis
    return Math.floorDiv(diff, 24L * 60 * 60 * 1000).toInt()
  }

  private fun dayLabel(kickoffTs: Long, labels: WidgetLabels): String = when (dayOffset(kickoffTs)) {
    0 -> labels.today
    1 -> labels.tomorrow
    else -> latinDigits(SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(Date(kickoffTs * 1000)))
  }

  /** The app pins Latin digits in Arabic; keep the widget consistent. */
  private fun latinDigits(text: String): String = buildString(text.length) {
    for (ch in text) {
      append(
        when (ch) {
          in '\u0660'..'\u0669' -> '0' + (ch - '\u0660')
          in '\u06F0'..'\u06F9' -> '0' + (ch - '\u06F0')
          else -> ch
        },
      )
    }
  }

  /** Bars per minute bucket above (home) and below (away) the axis, with a minute scale and HT line. */
  private fun momentumChart(
    context: Context,
    points: List<FeedMomentumPoint>,
    width: Int,
    height: Int,
    halftime: String,
  ): Bitmap {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val metrics = context.resources.displayMetrics
    val labelStrip = 13 * metrics.density
    val chartHeight = height - labelStrip
    val mid = chartHeight / 2f
    val slot = width.toFloat() / points.size
    val barWidth = minOf(slot * 0.55f, chartHeight * 0.16f)
    val half = mid - 4f

    val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(150, 255, 255, 255)
      textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 9f, metrics)
    }
    val baseline = height - 2 * metrics.density
    text.textAlign = Paint.Align.LEFT
    canvas.drawText("0\u2019", 0f, baseline, text)
    // Half-time sits between the last first-half bucket and the first second-half one.
    val secondHalf = points.indexOfFirst { it.minute > 45 }
    val end = "${points.last().minute}\u2019"
    val endClear = secondHalf <= 0 ||
      width - secondHalf * slot > (text.measureText(halftime) / 2f + text.measureText(end) + 6 * metrics.density)
    if (endClear) {
      text.textAlign = Paint.Align.RIGHT
      canvas.drawText(end, width.toFloat(), baseline, text)
    }
    if (secondHalf > 0) {
      val x = secondHalf * slot
      val dash = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(110, 255, 255, 255)
        strokeWidth = metrics.density
        style = Paint.Style.STROKE
        pathEffect = DashPathEffect(floatArrayOf(4 * metrics.density, 3 * metrics.density), 0f)
      }
      canvas.drawPath(Path().apply { moveTo(x, 0f); lineTo(x, chartHeight) }, dash)
      text.textAlign = Paint.Align.CENTER
      val labelHalf = text.measureText(halftime) / 2f
      canvas.drawText(halftime, x.coerceIn(labelHalf, width - labelHalf), baseline, text)
    }
    val home = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PURPLE }
    val away = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(190, 255, 255, 255) }
    val axis = Paint().apply { color = Color.argb(50, 255, 255, 255); strokeWidth = 2f }
    canvas.drawLine(0f, mid, width.toFloat(), mid, axis)
    points.forEachIndexed { index, point ->
      // Buckets the match has not reached yet come back as 0/0.
      if (point.home <= 0 && point.away <= 0) return@forEachIndexed
      val left = index * slot + (slot - barWidth) / 2f
      val radius = barWidth / 2f
      val homeH = (point.home.coerceIn(0, 100) / 100f * half).coerceAtLeast(3f)
      val awayH = (point.away.coerceIn(0, 100) / 100f * half).coerceAtLeast(3f)
      canvas.drawRoundRect(RectF(left, mid - 2f - homeH, left + barWidth, mid - 2f), radius, radius, home)
      canvas.drawRoundRect(RectF(left, mid + 2f, left + barWidth, mid + 2f + awayH), radius, radius, away)
    }
    return bitmap
  }

  internal fun matchUri(match: FeedMatch) = "ninetyplus://match-details?fixtureId=${match.fixtureId}"

  internal fun openIntent(context: Context, uri: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(
      context,
      uri.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun navIntent(context: Context, action: String): PendingIntent {
    val intent = Intent(context, MatchesWidgetProvider::class.java).setAction(action)
    return PendingIntent.getBroadcast(
      context,
      action.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Loads each URL once per render, so a crest shared by several pages is decoded a single time. */
  private class ImageResolver(private val context: Context, private val allowNetwork: Boolean) {
    private val crests = HashMap<String, Bitmap?>()
    private val photos = HashMap<String, Bitmap?>()

    fun crest(url: String?): Bitmap? {
      if (url.isNullOrBlank()) return null
      return crests.getOrPut(url) { WidgetImages.load(context, url, allowNetwork) }
    }

    fun photo(url: String?): Bitmap? {
      if (url.isNullOrBlank()) return null
      return photos.getOrPut(url) { WidgetImages.load(context, url, allowNetwork)?.let(WidgetImages::circle) }
    }

    fun cover(url: String?, aspect: Float, radiusFraction: Float): Bitmap? {
      if (url.isNullOrBlank()) return null
      return WidgetImages.load(context, url, allowNetwork, WidgetImages.COVER_PX)
        ?.let { WidgetImages.cover(it, aspect, radiusFraction) }
    }
  }
}
