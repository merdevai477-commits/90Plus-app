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
    val rtl = config?.language?.startsWith("ar") == true
    val images = ImageResolver(context, allowNetwork)

    val pages = mutableListOf<RemoteViews>()
    when {
      config == null || config.teamIds.isEmpty() -> pages += messagePage(context, labels.followTeams)
      feed == null -> pages += messagePage(context, "")
      feed.teams.isEmpty() -> pages += messagePage(context, labels.followTeams)
      else -> {
        val featuredMatch = feed.featuredMatch
        val featured = feed.featured
        if (featuredMatch != null && featured != null) {
          pages += matchPage(context, featuredMatch, labels, images)
          if (featured.topPlayers.isNotEmpty()) {
            pages += playersPage(context, featuredMatch, featured.topPlayers, labels, images)
          }
          if (featured.momentum.size >= 2) {
            pages += momentumPage(context, featuredMatch, featured.momentum, labels, images)
          }
        }
        pages += listPage(context, feed, labels, images)
        feed.teams
          .mapNotNull { it.match }
          .filter { it.fixtureId != featured?.fixtureId }
          .take(2)
          .forEach { pages += matchPage(context, it, labels, images) }
      }
    }

    root.removeAllViews(R.id.np_flipper)
    for (page in pages) {
      page.setInt(R.id.np_page, "setLayoutDirection", if (rtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR)
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

  /** Headline crest + "vs"; first row is the headline team's opponent, the rest are other followed teams. */
  private fun listPage(context: Context, feed: WidgetFeed, labels: WidgetLabels, images: ImageResolver): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_page_list)
    val headline = feed.teams.first()
    views.setTextViewText(R.id.np_head_name, headline.name)
    views.setTextViewText(R.id.np_vs, labels.vs)
    images.crest(headline.logo)?.let { views.setImageViewBitmap(R.id.np_head_logo, it) }

    val rows = mutableListOf<Pair<String, FeedMatch?>>()
    headline.match?.let { match ->
      val opponent = if (match.home.id == headline.teamId) match.away else match.home
      rows += opponent.name to match
    }
    feed.teams.drop(1).take(3 - rows.size).forEach { rows += it.name to it.match }

    views.removeAllViews(R.id.np_rows)
    for ((title, match) in rows) {
      val row = RemoteViews(context.packageName, R.layout.np_widget_row_team)
      row.setTextViewText(R.id.np_row_title, title)
      if (match != null) {
        row.setTextViewText(R.id.np_row_time, rowTime(match, labels))
        row.setTextViewText(R.id.np_row_status, statusWord(match, labels))
        row.setTextColor(R.id.np_row_status, if (match.isLive) LIVE_TEXT else IDLE_TEXT)
        row.setInt(
          R.id.np_row_status,
          "setBackgroundResource",
          if (match.isLive) R.drawable.np_widget_chip_live else R.drawable.np_widget_chip_idle,
        )
        row.setOnClickPendingIntent(R.id.np_row, openIntent(context, matchUri(match)))
      } else {
        row.setViewVisibility(R.id.np_row_status, View.GONE)
      }
      views.addView(R.id.np_rows, row)
    }
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, headline.match?.let(::matchUri) ?: MATCHES_URI))
    return views
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

  private fun messagePage(context: Context, text: String): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.np_widget_message)
    views.setTextViewText(R.id.np_message, text)
    views.setViewVisibility(R.id.np_message, if (text.isBlank()) View.GONE else View.VISIBLE)
    views.setOnClickPendingIntent(R.id.np_page, openIntent(context, MATCHES_URI))
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
