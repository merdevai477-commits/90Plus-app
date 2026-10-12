import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Palette (Figma 90plus node 1442:4283 + followed-teams list frame)

private enum Palette {
  static let muted = Color(red: 0.65, green: 0.65, blue: 0.65)       // #A7A7A7
  static let rowTitle = Color(red: 0.75, green: 0.75, blue: 0.75)    // #BFBFBF
  static let rowTime = Color(red: 0.56, green: 0.56, blue: 0.56)     // #8F8F8F
  static let vs = Color(red: 0.85, green: 0.85, blue: 0.85)          // #D9D9D9
  static let liveText = Color(red: 0.87, green: 0.12, blue: 0.12)    // #DE1F1F
  static let liveFill = Color(red: 0.53, green: 0.02, blue: 0.02).opacity(0.32)
  static let idleText = Color(red: 0.55, green: 0.55, blue: 0.55)
  static let idleFill = Color(red: 0.58, green: 0.58, blue: 0.58).opacity(0.13)
  static let purple = Color(red: 0.545, green: 0.361, blue: 0.965)   // #8B5CF6
  static let ratingText = Color(red: 0.82, green: 0.64, blue: 0.98)  // #D1A4FB
  static let ratingFill = Color(red: 0.145, green: 0.008, blue: 0.27).opacity(0.5)
}

private let matchesURL = URL(string: "ninetyplus://matches")

// MARK: - Root

struct MatchesWidgetView: View {
  let entry: MatchesEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    content
      .environment(\.layoutDirection, entry.isArabic ? .rightToLeft : .leftToRight)
      .containerBackground(for: .widget) { GlassBackground() }
      .widgetURL(deepLink)
  }

  @ViewBuilder
  private var content: some View {
    switch family {
    case .accessoryInline:
      InlineView(entry: entry)
    case .accessoryRectangular:
      RectangularView(entry: entry)
    case .systemSmall:
      SmallView(entry: entry)
    default:
      MediumView(entry: entry)
    }
  }

  private var deepLink: URL? {
    guard let feed = entry.feed else { return matchesURL }
    switch entry.page {
    case .live, .players, .momentum:
      return feed.featuredMatch?.deepLink ?? matchesURL
    case .match(let index) where feed.teams.indices.contains(index):
      return feed.teams[index].match?.deepLink ?? matchesURL
    default:
      return feed.teams.first?.match?.deepLink ?? matchesURL
    }
  }
}

// MARK: - Glass container

/// Figma: rgba(20,17,28,.2) card + inset purple glow. In tinted / clear (iOS 26 Liquid Glass) modes
/// the system draws the glass itself, so the custom fill steps aside.
private struct GlassBackground: View {
  @Environment(\.widgetRenderingMode) private var renderingMode

  var body: some View {
    if renderingMode == .fullColor {
      ZStack {
        LinearGradient(
          colors: [Color(red: 0.12, green: 0.10, blue: 0.19), Color(red: 0.05, green: 0.04, blue: 0.08)],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
        LinearGradient(
          colors: [.clear, Color(red: 0.25, green: 0.08, blue: 0.63).opacity(0.30)],
          startPoint: .center,
          endPoint: .bottom
        )
        LinearGradient(
          colors: [.clear, Palette.purple.opacity(0.18)],
          startPoint: UnitPoint(x: 0.5, y: 0.85),
          endPoint: .bottom
        )
        LinearGradient(
          colors: [Color.white.opacity(0.09), .clear],
          startPoint: .topLeading,
          endPoint: UnitPoint(x: 0.55, y: 0.45)
        )
      }
    } else {
      Color.clear
    }
  }
}

private extension View {
  /// Real Liquid Glass on iOS 26; a quiet translucent capsule before that.
  @ViewBuilder
  func glassCapsule() -> some View {
    #if compiler(>=6.2)
    if #available(iOS 26.0, *) {
      self.glassEffect(.regular, in: .capsule)
    } else {
      self.background(Color.white.opacity(0.08), in: Capsule())
    }
    #else
    self.background(Color.white.opacity(0.08), in: Capsule())
    #endif
  }
}

// MARK: - Building blocks

private struct Crest: View {
  let image: UIImage?
  let size: CGFloat

  var body: some View {
    Group {
      if let image {
        Image(uiImage: image).resizable().scaledToFit()
      } else {
        Image(systemName: "shield.fill")
          .resizable()
          .scaledToFit()
          .foregroundStyle(Color.white.opacity(0.22))
          .padding(size * 0.12)
      }
    }
    .frame(width: size, height: size)
  }
}

private struct ScoreText: View {
  let match: FeedMatch
  let size: CGFloat

  var body: some View {
    HStack(spacing: size * 0.18) {
      Text("\(match.score?.home ?? 0)")
      Text("-")
      Text("\(match.score?.away ?? 0)")
    }
    .font(.system(size: size, weight: .semibold))
    .monospacedDigit()
    .foregroundStyle(.white)
    .contentTransition(.numericText())
    .widgetAccentable()
  }
}

private enum KickoffText {
  static func time(_ date: Date, arabic: Bool) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: arabic ? "ar@numbers=latn" : "en_US_POSIX")
    formatter.dateFormat = "HH:mm"
    return formatter.string(from: date)
  }

  static func day(_ date: Date, labels: WidgetLabels, arabic: Bool) -> String {
    let calendar = Calendar.current
    if calendar.isDateInToday(date) { return labels.today }
    if calendar.isDateInTomorrow(date) { return labels.tomorrow }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: arabic ? "ar@numbers=latn" : "en_US_POSIX")
    formatter.setLocalizedDateFormatFromTemplate("EEE d MMM")
    return formatter.string(from: date)
  }
}

/// Live minute keeps ticking between reloads via a system timer; other states are static labels.
private struct StatusBadge: View {
  let match: FeedMatch
  let labels: WidgetLabels
  let asOf: Date
  let arabic: Bool
  var fontSize: CGFloat = 12

  var body: some View {
    label
      .font(.system(size: fontSize, weight: .semibold))
      .monospacedDigit()
      .lineLimit(1)
      .foregroundStyle(match.isLive ? Palette.liveText : Palette.idleText)
      .padding(.horizontal, fontSize * 0.6)
      .frame(minWidth: fontSize * 4.5, minHeight: fontSize * 1.6)
      .background(match.isLive ? Palette.liveFill : Palette.idleFill, in: Capsule())
  }

  @ViewBuilder
  private var label: some View {
    switch match.status {
    case "live":
      if let elapsed = match.elapsed {
        let start = asOf.addingTimeInterval(-Double(elapsed) * 60)
        Text(timerInterval: start...start.addingTimeInterval(150 * 60), countsDown: false, showsHours: false)
          .multilineTextAlignment(.center)
      } else {
        Text(labels.live)
      }
    case "ht":
      Text(labels.halftime)
    case "ft":
      Text(labels.finished)
    case "off":
      Text(labels.postponed)
    default:
      Text(KickoffText.time(match.kickoff, arabic: arabic))
    }
  }
}

private struct TeamColumn: View {
  let side: FeedSide
  let image: UIImage?
  let crest: CGFloat
  let spacing: CGFloat

  var body: some View {
    VStack(spacing: spacing) {
      Crest(image: image, size: crest)
      Text(side.name)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Palette.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity)
  }
}

// MARK: - Medium pages

private struct MediumView: View {
  let entry: MatchesEntry

  var body: some View {
    ZStack(alignment: .bottom) {
      page
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 14)
        .padding(.top, 11)
        .padding(.bottom, entry.pages.count > 1 ? 24 : 11)
        .transition(.push(from: .trailing))
        .id(entry.pageIndex)

      if entry.pages.count > 1 {
        PagerBar(count: entry.pages.count, index: entry.pageIndex)
          .padding(.horizontal, 12)
          .padding(.bottom, 7)
      }
    }
  }

  @ViewBuilder
  private var page: some View {
    switch entry.content {
    case .needsTeams:
      MessageView(text: entry.labels.followTeams)
    case .unavailable:
      MessageView(text: nil)
    case .feed(let feed):
      switch entry.page {
      case .live:
        if let match = feed.featuredMatch { MatchCard(entry: entry, match: match) }
      case .players:
        if let featured = feed.featured, let match = feed.featuredMatch {
          PlayersPage(entry: entry, match: match, players: featured.topPlayers)
        }
      case .momentum:
        if let featured = feed.featured, let match = feed.featuredMatch {
          MomentumPage(entry: entry, match: match, points: featured.momentum)
        }
      case .match(let index) where feed.teams.indices.contains(index):
        if let match = feed.teams[index].match { MatchCard(entry: entry, match: match) }
      default:
        FollowedListPage(entry: entry, feed: feed)
      }
    }
  }
}

private struct PagerBar: View {
  let count: Int
  let index: Int

  private var current: Int { ((index % count) + count) % count }

  var body: some View {
    HStack(spacing: 6) {
      HStack(spacing: 4) {
        ForEach(0..<count, id: \.self) { dot in
          Capsule()
            .fill(dot == current ? Palette.purple : Color.white.opacity(0.25))
            .frame(width: dot == current ? 12 : 5, height: 5)
        }
      }
      Spacer(minLength: 0)
      Button(intent: ChangePageIntent(step: -1)) {
        Image(systemName: "chevron.backward")
          .font(.system(size: 10, weight: .bold))
          .frame(width: 26, height: 18)
          .glassCapsule()
      }
      .buttonStyle(.plain)
      Button(intent: ChangePageIntent(step: 1)) {
        Image(systemName: "chevron.forward")
          .font(.system(size: 10, weight: .bold))
          .frame(width: 26, height: 18)
          .glassCapsule()
      }
      .buttonStyle(.plain)
    }
    .foregroundStyle(Color.white.opacity(0.8))
  }
}

/// Figma 1442:4283 — crest / status pill + score / crest. Also used for upcoming fixtures.
private struct MatchCard: View {
  let entry: MatchesEntry
  let match: FeedMatch

  var body: some View {
    VStack(spacing: 6) {
      if let league = match.league?.name, !league.isEmpty {
        Text(league)
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(Palette.rowTime)
          .lineLimit(1)
      }
      HStack(spacing: 16) {
        TeamColumn(side: match.home, image: entry.image(match.home.logo), crest: 42, spacing: 9)
        VStack(spacing: 8) {
          StatusBadge(match: match, labels: entry.labels, asOf: entry.asOf, arabic: entry.isArabic)
          if match.score != nil {
            ScoreText(match: match, size: 23)
          } else {
            Text(KickoffText.day(match.kickoff, labels: entry.labels, arabic: entry.isArabic))
              .font(.system(size: 15, weight: .semibold))
              .foregroundStyle(.white)
              .lineLimit(1)
              .minimumScaleFactor(0.7)
          }
        }
        .frame(maxWidth: .infinity)
        TeamColumn(side: match.away, image: entry.image(match.away.logo), crest: 42, spacing: 11)
      }
    }
  }
}

/// Followed-teams frame: headline team crest, "vs", then each followed team's next fixture.
private struct FollowedListPage: View {
  let entry: MatchesEntry
  let feed: WidgetFeed

  var body: some View {
    if let headline = feed.teams.first {
      HStack(spacing: 12) {
        VStack(spacing: 9) {
          Crest(image: entry.image(headline.logo), size: 60)
          Text(headline.name)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Palette.muted)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        .frame(width: 72)

        Text(entry.labels.vs)
          .font(.system(size: 27, weight: .medium))
          .foregroundStyle(Palette.vs)

        VStack(alignment: .leading, spacing: 5) {
          ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
            if let link = row.match?.deepLink {
              Link(destination: link) { TeamRow(entry: entry, title: row.title, match: row.match) }
            } else {
              TeamRow(entry: entry, title: row.title, match: row.match)
            }
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    } else {
      MessageView(text: entry.labels.followTeams)
    }
  }

  /// First row is the headline team's opponent (reads "Team vs Opponent"); the rest are other followed teams.
  private var rows: [(title: String, match: FeedMatch?)] {
    guard let headline = feed.teams.first else { return [] }
    var out: [(title: String, match: FeedMatch?)] = []
    if let match = headline.match {
      let opponent = match.home.id == headline.teamId ? match.away : match.home
      out.append((opponent.name, match))
    }
    for team in feed.teams.dropFirst().prefix(3 - out.count) {
      out.append((team.name, team.match))
    }
    return out
  }
}

private struct TeamRow: View {
  let entry: MatchesEntry
  let title: String
  let match: FeedMatch?

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(title)
        .font(.system(size: 14, weight: .medium))
        .foregroundStyle(Palette.rowTitle)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
      if let match {
        HStack(spacing: 4) {
          Text(timeText(match))
            .font(.system(size: 9))
            .foregroundStyle(Palette.rowTime)
            .lineLimit(1)
          Text(statusText(match))
            .font(.system(size: 8, weight: .medium))
            .foregroundStyle(match.isLive ? Palette.liveText : Palette.idleText)
            .padding(.vertical, 2)
            .padding(.horizontal, 6)
            .background(match.isLive ? Palette.liveFill : Palette.idleFill, in: Capsule())
        }
      }
    }
  }

  private func timeText(_ match: FeedMatch) -> String {
    if match.isLive, let score = match.score { return "\(score.home) - \(score.away)" }
    let time = KickoffText.time(match.kickoff, arabic: entry.isArabic)
    if Calendar.current.isDateInToday(match.kickoff) { return time }
    return "\(KickoffText.day(match.kickoff, labels: entry.labels, arabic: entry.isArabic)) \(time)"
  }

  private func statusText(_ match: FeedMatch) -> String {
    switch match.status {
    case "live": return entry.labels.live
    case "ht": return entry.labels.halftime
    case "ft": return entry.labels.finished
    case "off": return entry.labels.postponed
    default: return entry.labels.upcoming
    }
  }
}

private struct MiniScoreHeader: View {
  let entry: MatchesEntry
  let match: FeedMatch
  let title: String

  var body: some View {
    HStack(spacing: 6) {
      Text(title)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(.white)
        .lineLimit(1)
      Spacer(minLength: 4)
      Crest(image: entry.image(match.home.logo), size: 16)
      ScoreText(match: match, size: 12)
      Crest(image: entry.image(match.away.logo), size: 16)
      StatusBadge(match: match, labels: entry.labels, asOf: entry.asOf, arabic: entry.isArabic, fontSize: 9)
    }
  }
}

private struct PlayersPage: View {
  let entry: MatchesEntry
  let match: FeedMatch
  let players: [FeedPlayer]

  var body: some View {
    VStack(spacing: 8) {
      MiniScoreHeader(entry: entry, match: match, title: entry.labels.topPlayers)
      HStack(spacing: 8) {
        ForEach(Array(players.prefix(3).enumerated()), id: \.offset) { _, player in
          PlayerTile(entry: entry, match: match, player: player)
        }
      }
    }
  }
}

private struct PlayerTile: View {
  let entry: MatchesEntry
  let match: FeedMatch
  let player: FeedPlayer

  var body: some View {
    VStack(spacing: 4) {
      ZStack(alignment: .bottomTrailing) {
        Group {
          if let photo = entry.image(player.photo) {
            Image(uiImage: photo).resizable().scaledToFill()
          } else {
            Image(systemName: "person.fill")
              .resizable()
              .scaledToFit()
              .padding(10)
              .foregroundStyle(Palette.purple)
          }
        }
        .frame(width: 42, height: 42)
        .background(Color(red: 0.11, green: 0.07, blue: 0.25))
        .clipShape(Circle())

        Crest(image: entry.image(player.side == "home" ? match.home.logo : match.away.logo), size: 14)
      }
      Text(shortName)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(.white)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      HStack(spacing: 2) {
        Text(String(format: "%.1f", player.rating))
        Image(systemName: "star.fill").font(.system(size: 7))
      }
      .font(.system(size: 10, weight: .semibold))
      .foregroundStyle(Palette.ratingText)
      .padding(.horizontal, 6)
      .padding(.vertical, 1)
      .background(Palette.ratingFill, in: Capsule())
    }
    .frame(maxWidth: .infinity)
  }

  private var shortName: String {
    let parts = player.name.split(separator: " ")
    return parts.count > 1 ? String(parts.last!) : player.name
  }
}

private struct MomentumPage: View {
  let entry: MatchesEntry
  let match: FeedMatch
  let points: [FeedMomentumPoint]

  private let halfHeight: CGFloat = 30

  var body: some View {
    VStack(spacing: 8) {
      MiniScoreHeader(entry: entry, match: match, title: entry.labels.momentum)
      HStack(alignment: .center, spacing: 3) {
        ForEach(Array(points.enumerated()), id: \.offset) { _, point in
          VStack(spacing: 2) {
            VStack(spacing: 0) {
              Spacer(minLength: 0)
              Capsule().fill(Palette.purple).frame(height: barHeight(point.home))
            }
            .frame(height: halfHeight)
            VStack(spacing: 0) {
              Capsule().fill(Color.white.opacity(0.75)).frame(height: barHeight(point.away))
              Spacer(minLength: 0)
            }
            .frame(height: halfHeight)
          }
          .frame(maxWidth: .infinity)
        }
      }
      .environment(\.layoutDirection, .leftToRight)
    }
  }

  private func barHeight(_ value: Int) -> CGFloat {
    max(2, min(halfHeight, CGFloat(value) / 100 * halfHeight))
  }
}

private struct MessageView: View {
  let text: String?

  var body: some View {
    VStack(spacing: 6) {
      Text("90PLUS")
        .font(.system(size: 16, weight: .heavy))
        .foregroundStyle(Palette.purple)
        .widgetAccentable()
      if let text {
        Text(text)
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(Palette.muted)
          .multilineTextAlignment(.center)
      } else {
        Button(intent: ChangePageIntent(step: 0)) {
          Image(systemName: "arrow.clockwise")
            .font(.system(size: 12, weight: .bold))
            .frame(width: 32, height: 22)
            .glassCapsule()
        }
        .buttonStyle(.plain)
        .foregroundStyle(.white)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

// MARK: - Small

private struct SmallView: View {
  let entry: MatchesEntry

  var body: some View {
    Group {
      switch entry.content {
      case .needsTeams:
        MessageView(text: entry.labels.followTeams)
      case .unavailable:
        MessageView(text: nil)
      case .feed(let feed):
        if let match = currentMatch(feed) {
          SmallMatchCard(entry: entry, match: match)
        } else {
          MessageView(text: entry.labels.followTeams)
        }
      }
    }
    .padding(12)
    .transition(.push(from: .trailing))
    .id(entry.pageIndex)
  }

  private func currentMatch(_ feed: WidgetFeed) -> FeedMatch? {
    switch entry.page {
    case .live: return feed.featuredMatch
    case .match(let index) where feed.teams.indices.contains(index): return feed.teams[index].match
    default: return feed.teams.first?.match
    }
  }
}

private struct SmallMatchCard: View {
  let entry: MatchesEntry
  let match: FeedMatch

  var body: some View {
    VStack(spacing: 8) {
      HStack {
        Crest(image: entry.image(match.home.logo), size: 38)
        Spacer(minLength: 4)
        Crest(image: entry.image(match.away.logo), size: 38)
      }
      if match.score != nil {
        ScoreText(match: match, size: 24)
      } else {
        Text(KickoffText.day(match.kickoff, labels: entry.labels, arabic: entry.isArabic))
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      StatusBadge(match: match, labels: entry.labels, asOf: entry.asOf, arabic: entry.isArabic, fontSize: 11)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

// MARK: - Lock screen

private func lockScreenMatch(_ entry: MatchesEntry) -> FeedMatch? {
  guard let feed = entry.feed else { return nil }
  if case .match(let index) = entry.page, feed.teams.indices.contains(index) {
    return feed.teams[index].match
  }
  return feed.featuredMatch ?? feed.teams.first?.match
}

private func lockScreenLine(_ match: FeedMatch) -> String {
  if let score = match.score {
    return "\(match.home.name) \(score.home)-\(score.away) \(match.away.name)"
  }
  return "\(match.home.name) vs \(match.away.name)"
}

private struct RectangularView: View {
  let entry: MatchesEntry

  var body: some View {
    if let match = lockScreenMatch(entry) {
      VStack(alignment: .leading, spacing: 2) {
        Text(lockScreenLine(match))
          .font(.system(size: 14, weight: .semibold))
          .lineLimit(2)
          .minimumScaleFactor(0.8)
          .widgetAccentable()
        HStack(spacing: 4) {
          if match.isLive { Image(systemName: "dot.radiowaves.left.and.right") }
          statusLine(match)
        }
        .font(.system(size: 12))
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else {
      Text("90PLUS").font(.headline)
    }
  }

  @ViewBuilder
  private func statusLine(_ match: FeedMatch) -> some View {
    switch match.status {
    case "live":
      if let elapsed = match.elapsed {
        let start = entry.asOf.addingTimeInterval(-Double(elapsed) * 60)
        Text(timerInterval: start...start.addingTimeInterval(150 * 60), countsDown: false, showsHours: false)
      } else {
        Text(entry.labels.live)
      }
    case "ht": Text(entry.labels.halftime)
    case "ft": Text(entry.labels.finished)
    default:
      Text("\(KickoffText.day(match.kickoff, labels: entry.labels, arabic: entry.isArabic)) \(KickoffText.time(match.kickoff, arabic: entry.isArabic))")
    }
  }
}

private struct InlineView: View {
  let entry: MatchesEntry

  var body: some View {
    if let match = lockScreenMatch(entry) {
      Text(lockScreenLine(match))
    } else {
      Text("90PLUS")
    }
  }
}
