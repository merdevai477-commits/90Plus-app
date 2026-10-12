package expo.modules.widgetbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

internal object WidgetRenderer {
  private const val MATCHES_URI = "ninetyplus://matches"
  private const val SEARCH_URI = "ninetyplus://search"
  private const val LIST_ROWS = 3
  private const val LINEUP_NAMES = 4
  private const val LIVE_TEXT = 0xFFDE1F1F.toInt()
  private const val IDLE_TEXT = 0xFF8C8C8C.toInt()
  private const val PURPLE = 0xFF8B5CF6.toInt()

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
    val views = build(context, feed, config, allowNetwork)
    AppWidgetManager.getInstance(context).updateAppWidget(ids, views)
  }

  fun flip(context: Context, forward: Boolean) {
    val ids = widgetIds(context)
    if (ids.isEmpty()) return
    val views = RemoteViews(context.packageName, R.layout.np_widget_root)
    if (forward) views.showNext(R.id.np_flipper) else views.showPrevious(R.id.np_flipper)
    AppWidgetManager.getInstance(context).partiallyUpdateAppWidget(ids, views)
  }

  private fun build(context: Context, feed: WidgetFeed?, config: WidgetConfig?, allowNetwork: Boolean): RemoteViews {
    val root = RemoteViews(context.packageName, R.layout.np_widget_root)
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
        if (focus != null) pages += matchPage(context, focus, labels, images)
        if (feed.fixtures.isNotEmpty()) pages += listPage(context, feed.fixtures, labels, images)
        if (focus != null && featured != null) {
          featured.lineup?.let { pages += lineupPage(context, focus, it, labels, images) }
          if (featured.topPlayers.isNotEmpty()) {
            pages += playersPage(context, focus, featured.topPlayers, labels, images)
          }
          if (featured.momentum.size >= 2) {
            pages += momentumPage(context, focus, featured.momentum, labels, images)
          }
          featured.stats?.takeIf { hasStats(it) }?.let { pages += statsPage(context, focus, it, labels, images, arabic) }
        }
        if (pages.isEmpty()) pages += messagePage(context, labels.followTeams, SEARCH_URI)
      }
    }

    root.removeAllViews(R.id.np_flipper)
    for (page in pages) {
      page.setInt(R.id.np_page, "setLayoutDirection", View.LAYOUT_DIRECTION_LTR)
      root.addView(R.id.np_flipper, page)
    }
    root.setViewVisibility(R.id.np_nav, if (pages.size > 1) View.VISIBLE else View.GONE)
    root.setOnClickPendingIntent(R.id.np_prev, navIntent(context, MatchesWidgetProvider.ACTION_PREV))
    root.setOnClickPendingIntent(R.id.np_next, navIntent(context, MatchesWidgetProvider.ACTION_NEXT))
    return root
  }

  // region Pages

  private fun matchPage(context: Context, match: FeedMatch, labels: WidgetLabels, images: ImageResolver): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_match)
    views.setTextViewText(R.id.np_league, match.leagueName)
    views.setViewVisibility(R.id.np_league, if (match.leagueName.isBlank()) View.GONE else View.VISIBLE)
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
      views.setTextViewText(R.id.np_center, dayLabel(match.kickoffTs, labels))
    }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  private fun listPage(context: Context, fixtures: List<FeedMatch>, labels: WidgetLabels, images: ImageResolver): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_list)
    views.removeAllViews(R.id.np_rows)
    val shown = fixtures.take(LIST_ROWS)
    for (match in shown) {
      val row = RemoteViews(context.packageName, R.layout.np_widget_row_fixture)
      row.setTextViewText(R.id.np_home_name, match.home.name)
      row.setTextViewText(R.id.np_away_name, match.away.name)
      images.crest(match.home.logo)?.let { row.setImageViewBitmap(R.id.np_home_logo, it) }
      images.crest(match.away.logo)?.let { row.setImageViewBitmap(R.id.np_away_logo, it) }
      row.setTextViewText(R.id.np_row_time, rowTime(match, labels))
      val chip = match.status == "upcoming"
      row.setViewVisibility(R.id.np_row_status, if (chip) View.GONE else View.VISIBLE)
      if (!chip) {
        row.setTextViewText(R.id.np_row_status, statusWord(match, labels))
        row.setTextColor(R.id.np_row_status, if (match.isLive) LIVE_TEXT else IDLE_TEXT)
        row.setInt(
          R.id.np_row_status,
          "setBackgroundResource",
          if (match.isLive) R.drawable.np_widget_chip_live else R.drawable.np_widget_chip_idle,
        )
      }
      row.setOnClickPendingIntent(R.id.np_row, openIntent(context, matchUri(match)))
      views.addView(R.id.np_rows, row)
    }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, shown.firstOrNull()?.let(::matchUri) ?: MATCHES_URI))
    return views
  }

  private fun lineupPage(
    context: Context,
    match: FeedMatch,
    lineup: FeedLineup,
    labels: WidgetLabels,
    images: ImageResolver,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_lineup)
    applyMiniHeader(views, match, labels.lineup, labels, images)
    val formation = listOfNotNull(lineup.homeFormation, lineup.awayFormation).filter { it.isNotBlank() }.joinToString(" · ")
    views.setTextViewText(R.id.np_formation, formation)
    views.setViewVisibility(R.id.np_formation, if (formation.isBlank()) View.GONE else View.VISIBLE)
    views.removeAllViews(R.id.np_lineup_home)
    views.removeAllViews(R.id.np_lineup_away)
    lineup.home.take(LINEUP_NAMES).forEach { views.addView(R.id.np_lineup_home, lineupName(context, it)) }
    lineup.away.take(LINEUP_NAMES).forEach { views.addView(R.id.np_lineup_away, lineupName(context, it)) }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
  }

  private fun lineupName(context: Context, player: FeedLineupPlayer): RemoteViews {
    val row = RemoteViews(context.packageName, R.layout.np_widget_lineup_name)
    val rating = player.rating?.let { "  ${String.format(Locale.US, "%.1f", it)}" }.orEmpty()
    row.setTextViewText(R.id.np_lineup_name, player.name.trim().split(" ").last() + rating)
    return row
  }

  private fun statsPage(
    context: Context,
    match: FeedMatch,
    stats: FeedStats,
    labels: WidgetLabels,
    images: ImageResolver,
    arabic: Boolean,
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_stats)
    applyMiniHeader(views, match, labels.stats, labels, images)
    views.removeAllViews(R.id.np_stat_rows)
    fun add(key: String, pair: FeedStatPair?, percent: Boolean, decimal: Boolean) {
      if (pair == null) return
      val row = RemoteViews(context.packageName, R.layout.np_widget_stat_row)
      row.setTextViewText(R.id.np_stat_label, statLabel(key, arabic))
      row.setTextViewText(R.id.np_stat_home, formatStat(pair.home, percent, decimal))
      row.setTextViewText(R.id.np_stat_away, formatStat(pair.away, percent, decimal))
      views.addView(R.id.np_stat_rows, row)
    }
    add("possession", stats.possession, percent = true, decimal = false)
    add("shots", stats.shots, percent = false, decimal = false)
    add("shotsOn", stats.shotsOn, percent = false, decimal = false)
    add("corners", stats.corners, percent = false, decimal = false)
    add("xg", stats.xg, percent = false, decimal = true)
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
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_players)
    applyMiniHeader(views, match, labels.topPlayers, labels, images)
    views.removeAllViews(R.id.np_players)
    for (player in players.take(3)) {
      val tile = RemoteViews(context.packageName, R.layout.np_widget_player)
      val photo = images.photo(player.photo)
        ?: images.crest(if (player.side == "home") match.home.logo else match.away.logo)
      photo?.let { tile.setImageViewBitmap(R.id.np_player_photo, it) }
      tile.setTextViewText(R.id.np_player_name, player.name.trim().split(" ").last())
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
  ): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_momentum)
    applyMiniHeader(views, match, labels.momentum, labels, images)
    views.setImageViewBitmap(R.id.np_momentum_chart, momentumChart(points))
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, matchUri(match)))
    return views
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

  private fun badgeText(match: FeedMatch, labels: WidgetLabels): String = when (match.status) {
    "live" -> match.elapsed?.let { elapsed ->
      val extra = match.extra?.takeIf { it > 0 }?.let { "+$it" } ?: ""
      "$elapsed$extra\u2019"
    } ?: labels.live
    "ht" -> labels.halftime
    "ft" -> labels.finished
    "off" -> labels.postponed
    else -> clock(match.kickoffTs)
  }

  private fun statusWord(match: FeedMatch, labels: WidgetLabels): String = when (match.status) {
    "live" -> labels.live
    "ht" -> labels.halftime
    "ft" -> labels.finished
    "off" -> labels.postponed
    else -> labels.upcoming
  }

  private fun rowTime(match: FeedMatch, labels: WidgetLabels): String {
    if (match.isLive && match.homeScore != null && match.awayScore != null) {
      return "${match.homeScore} - ${match.awayScore}"
    }
    val time = clock(match.kickoffTs)
    return if (isToday(match.kickoffTs)) time else "${dayLabel(match.kickoffTs, labels)} $time"
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

  private fun momentumChart(points: List<FeedMomentumPoint>): Bitmap {
    val width = 420
    val height = 96
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val mid = height / 2f
    val slot = width.toFloat() / points.size
    val barWidth = slot * 0.55f
    val half = mid - 4f
    val home = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PURPLE }
    val away = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(190, 255, 255, 255) }
    val axis = Paint().apply { color = Color.argb(50, 255, 255, 255); strokeWidth = 2f }
    canvas.drawLine(0f, mid, width.toFloat(), mid, axis)
    points.forEachIndexed { index, point ->
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
  }
}
