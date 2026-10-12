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
private let searchURL = URL(string: "ninetyplus://search")

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
    guard let feed = entry.feed else { return searchURL }
    switch entry.page {
    case .live, .players, .momentum, .lineup, .stats, .events:
      return feed.focusMatch?.deepLink ?? searchURL
    case .fixture(let index) where feed.fixtures.indices.contains(index):
      return feed.fixtures[index].deepLink ?? searchURL
    case .match(let index) where feed.teams.indices.contains(index):
      return feed.teams[index].match?.deepLink ?? searchURL
    default:
      return feed.focusMatch?.deepLink ?? feed.fixtures.first?.deepLink ?? searchURL
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

private struct BrandMark: View {
  var size: CGFloat = 13

  var body: some View {
    HStack(spacing: 0) {
      Text("90").foregroundStyle(.white)
      Text("Plus").foregroundStyle(Palette.purple)
    }
    .font(.system(size: size, weight: .heavy))
    .widgetAccentable()
  }
}

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
      Text(Calendar.current.isDateInToday(match.kickoff) ? labels.upcoming : KickoffText.day(match.kickoff, labels: labels, arabic: arabic))
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
        if let match = feed.focusMatch {
          let events = feed.featured?.fixtureId == match.fixtureId ? feed.featured?.events ?? [] : []
          MatchCard(entry: entry, match: match, events: events)
        }
      case .players:
        if let featured = feed.featured, let match = feed.focusMatch {
          PlayersPage(entry: entry, match: match, players: featured.topPlayers)
        }
      case .momentum:
        if let featured = feed.featured, let match = feed.focusMatch {
          MomentumPage(entry: entry, match: match, points: featured.momentum)
        }
      case .lineup:
        if let lineup = feed.featured?.lineup, let match = feed.focusMatch {
          LineupPage(entry: entry, match: match, lineup: lineup)
        }
      case .stats:
        if let stats = feed.featured?.stats, stats.hasAny, let match = feed.focusMatch {
          StatsPage(entry: entry, match: match, stats: stats)
        }
      case .events:
        if let events = feed.featured?.events, !events.isEmpty, let match = feed.focusMatch {
          EventsPage(entry: entry, match: match, events: events)
        }
      case .fixture(let index) where feed.fixtures.indices.contains(index):
        MatchCard(entry: entry, match: feed.fixtures[index])
      case .match(let index) where feed.teams.indices.contains(index):
        if let match = feed.teams[index].match { MatchCard(entry: entry, match: match) }
      default:
        MessageView(text: entry.labels.followTeams)
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
  var events: [FeedEvent] = []
  @Environment(\.widgetFamily) private var family

  private var isLarge: Bool { family == .systemLarge || family == .systemExtraLarge }
  private var crest: CGFloat { isLarge ? 60 : 42 }

  var body: some View {
    VStack(spacing: 6) {
      BrandMark()
      if let league = match.league?.name, !league.isEmpty {
        Text(league)
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(Palette.rowTime)
          .lineLimit(1)
      }
      teams
      // Only the large family has room for scorers under the crests.
      if isLarge, !events.isEmpty {
        HStack(alignment: .top, spacing: 16) {
          scorerColumn(scorerLines(events, side: "home"))
          Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
          scorerColumn(scorerLines(events, side: "away"))
        }
        .environment(\.layoutDirection, .leftToRight)
      }
    }
  }

  private func scorerColumn(_ lines: [String]) -> some View {
    VStack(spacing: 2) {
      ForEach(Array(lines.prefix(5).enumerated()), id: \.offset) { _, line in
        Text(line).lineLimit(1).minimumScaleFactor(0.8)
      }
    }
    .font(.system(size: 10, weight: .medium))
    .foregroundStyle(Palette.rowTime)
    .frame(maxWidth: .infinity)
  }

  private var teams: some View {
    HStack(spacing: 16) {
      TeamColumn(side: match.home, image: entry.image(match.home.logo), crest: crest, spacing: 9)
      VStack(spacing: 8) {
        StatusBadge(match: match, labels: entry.labels, asOf: entry.asOf, arabic: entry.isArabic)
        if match.score != nil {
          ScoreText(match: match, size: 23)
        } else {
          Text(KickoffText.time(match.kickoff, arabic: entry.isArabic))
            .font(.system(size: 20, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
      }
      .frame(maxWidth: .infinity)
      TeamColumn(side: match.away, image: entry.image(match.away.logo), crest: crest, spacing: 11)
    }
    .environment(\.layoutDirection, .leftToRight)
  }
}

/// "Guerrero 13', 37'" per scorer, in the order they first scored. Mirrors the Android widget.
private func scorerLines(_ events: [FeedEvent], side: String) -> [String] {
  var order: [String] = []
  var minutes: [String: [String]] = [:]
  for event in events where event.side == side && ["goal", "penalty", "own_goal"].contains(event.kind) {
    let name = shortPlayerName(event.player) + (event.kind == "own_goal" ? " (OG)" : "")
    let extra = event.extra.map { "+\($0)" } ?? ""
    let minute = "\(event.minute)\(extra)\u{2019}" + (event.kind == "penalty" ? " (P)" : "")
    if minutes[name] == nil { order.append(name) }
    minutes[name, default: []].append(minute)
  }
  return order.map { "\($0) \(minutes[$0]!.joined(separator: ", "))" }
}

private struct MiniScoreHeader: View {
  let entry: MatchesEntry
  let match: FeedMatch
  let title: String

  var body: some View {
    HStack(spacing: 6) {
      BrandMark(size: 12)
      Text(title)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(Palette.muted)
        .lineLimit(1)
      Spacer(minLength: 4)
      Crest(image: entry.image(match.home.logo), size: 16)
      ScoreText(match: match, size: 12)
      Crest(image: entry.image(match.away.logo), size: 16)
      StatusBadge(match: match, labels: entry.labels, asOf: entry.asOf, arabic: entry.isArabic, fontSize: 9)
    }
    .environment(\.layoutDirection, .leftToRight)
  }
}

/// "Mohamed Salah" -> "Salah"; keeps particles like "De Bruyne" readable. Mirrors the Android widget.
private func shortPlayerName(_ full: String) -> String {
  let parts = full.split(whereSeparator: \.isWhitespace).map(String.init)
  guard parts.count > 1 else { return parts.first ?? "" }
  let particles: Set<String> = ["de", "da", "di", "van", "von", "der", "del", "la", "le", "el", "al", "dos", "ben", "bin", "abu"]
  let second = parts[parts.count - 2]
  return particles.contains(second.lowercased()) ? "\(second) \(parts.last!)" : parts.last!
}

/// Goals and red cards (yellows fill spare rows), mirrored around the minute like the in-app timeline.
private struct EventsPage: View {
  let entry: MatchesEntry
  let match: FeedMatch
  let events: [FeedEvent]
  @Environment(\.widgetFamily) private var family

  var body: some View {
    VStack(spacing: 4) {
      MiniScoreHeader(entry: entry, match: match, title: entry.labels.events)
      Spacer(minLength: 0)
      VStack(spacing: family == .systemLarge ? 6 : 3) {
        ForEach(Array(events.suffix(family == .systemLarge ? 10 : 5).enumerated()), id: \.offset) { _, event in
          EventRow(event: event)
        }
      }
      Spacer(minLength: 0)
    }
  }
}

private struct EventRow: View {
  let event: FeedEvent

  private var isHome: Bool { event.side == "home" }

  private var label: String {
    let name = shortPlayerName(event.player)
    switch event.kind {
    case "penalty": return "\(name) (P)"
    case "own_goal": return "\(name) (OG)"
    default: return name
    }
  }

  private var minute: String {
    let extra = event.extra.map { "+\($0)" } ?? ""
    return "\(event.minute)\(extra)\u{2019}"
  }

  var body: some View {
    HStack(spacing: 6) {
      HStack(spacing: 4) {
        if isHome {
          Text(label).lineLimit(1)
          EventIcon(kind: event.kind)
        }
      }
      .frame(maxWidth: .infinity, alignment: .trailing)
      Text(minute)
        .font(.system(size: 10, weight: .bold))
        .monospacedDigit()
        .foregroundStyle(Palette.ratingText)
        .frame(width: 42, height: 15)
        .background(Palette.ratingFill, in: Capsule())
      HStack(spacing: 4) {
        if !isHome {
          EventIcon(kind: event.kind)
          Text(label).lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .font(.system(size: 11, weight: .medium))
    .foregroundStyle(.white)
    .environment(\.layoutDirection, .leftToRight)
  }
}

private struct EventIcon: View {
  let kind: String

  var body: some View {
    switch kind {
    case "red":
      RoundedRectangle(cornerRadius: 1.5).fill(Color(red: 0.94, green: 0.27, blue: 0.27)).frame(width: 8, height: 11)
    case "yellow":
      RoundedRectangle(cornerRadius: 1.5).fill(Color(red: 0.98, green: 0.80, blue: 0.08)).frame(width: 8, height: 11)
    default:
      Image(systemName: "soccerball")
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(kind == "own_goal" ? Color(red: 0.97, green: 0.44, blue: 0.44) : Color.white)
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

  private var shortName: String { shortPlayerName(player.name) }
}

private struct MomentumPage: View {
  let entry: MatchesEntry
  let match: FeedMatch
  let points: [FeedMomentumPoint]

  @Environment(\.widgetFamily) private var family

  private var halfHeight: CGFloat { family == .systemLarge ? 80 : 34 }

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

private struct LineupPage: View {
  let entry: MatchesEntry
  let match: FeedMatch
  let lineup: FeedLineup

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      MiniScoreHeader(entry: entry, match: match, title: entry.labels.lineup)
      if lineup.hasPitch {
        Pitch(lineup: lineup)
      } else {
        if let formation = formationText {
          Text(formation)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(Palette.rowTime)
            .lineLimit(1)
        }
        HStack(alignment: .top, spacing: 8) {
          nameColumn(lineup.home)
          nameColumn(lineup.away)
        }
        .environment(\.layoutDirection, .leftToRight)
      }
    }
  }

  private var formationText: String? {
    let parts = [lineup.homeFormation, lineup.awayFormation].compactMap { $0 }.filter { !$0.isEmpty }
    return parts.isEmpty ? nil : parts.joined(separator: " · ")
  }

  @Environment(\.widgetFamily) private var family

  private func nameColumn(_ players: [FeedLineupPlayer]) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      ForEach(Array(players.prefix(family == .systemLarge ? 11 : 5).enumerated()), id: \.offset) { _, player in
        HStack(spacing: 4) {
          Text(player.number.map(String.init) ?? "")
            .foregroundStyle(Palette.rowTime)
            .frame(width: 16, alignment: .leading)
          Text(shortPlayerName(player.name))
            .foregroundStyle(.white)
            .lineLimit(1)
          Spacer(minLength: 2)
          if let rating = player.rating, rating > 0 {
            Text(String(format: "%.1f", rating)).foregroundStyle(Palette.ratingText)
          }
        }
        .font(.system(size: 10, weight: .medium))
        .monospacedDigit()
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// Compact pitch. Grid values are "row:column" from the provider; missing grids use the name list instead.
private struct Pitch: View {
  let lineup: FeedLineup

  var body: some View {
    let players = lineup.home + lineup.away
    let rows = Set(players.compactMap { grid($0)?.row }).count
    ZStack {
      RoundedRectangle(cornerRadius: 8)
        .fill(Color(red: 0.08, green: 0.18, blue: 0.12).opacity(0.85))
      VStack(spacing: 2) {
        ForEach(1...max(rows, 1), id: \.self) { row in
          let rowPlayers = players.filter { grid($0)?.row == row }
          HStack(spacing: 2) {
            ForEach(Array(rowPlayers.enumerated()), id: \.offset) { _, player in
              Text(player.name.split(separator: " ").last.map(String.init) ?? player.name)
                .font(.system(size: 7, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .frame(maxWidth: .infinity)
            }
          }
        }
      }
      .padding(4)
    }
    .frame(maxWidth: .infinity, maxHeight: 78)
    .environment(\.layoutDirection, .leftToRight)
  }

  private func grid(_ player: FeedLineupPlayer) -> (row: Int, column: Int)? {
    guard let raw = player.grid, let split = raw.split(separator: ":").first, let row = Int(split) else { return nil }
    let column = Int(raw.split(separator: ":").dropFirst().first ?? "0") ?? 0
    return (row, column)
  }
}

private struct StatsPage: View {
  let entry: MatchesEntry
  let match: FeedMatch
  let stats: FeedStats

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      MiniScoreHeader(entry: entry, match: match, title: entry.labels.stats)
      VStack(spacing: 2) {
        statRow(entry.isArabic ? "استحواذ" : "Possession", stats.possession, suffix: "%")
        statRow(entry.isArabic ? "تسديدات" : "Shots", stats.shots, suffix: "")
        statRow(entry.isArabic ? "على المرمى" : "On target", stats.shotsOn, suffix: "")
        statRow(entry.isArabic ? "ركنيات" : "Corners", stats.corners, suffix: "")
        statRow("xG", stats.xg, suffix: "", decimal: true)
      }
    }
  }

  @ViewBuilder
  private func statRow(_ title: String, _ pair: FeedStatPair?, suffix: String, decimal: Bool = false) -> some View {
    if let pair {
      HStack {
        Text(format(pair.home, suffix: suffix, decimal: decimal))
          .frame(maxWidth: .infinity, alignment: .trailing)
        Text(title)
          .foregroundStyle(Palette.rowTime)
          .frame(maxWidth: .infinity)
        Text(format(pair.away, suffix: suffix, decimal: decimal))
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(.white)
      .environment(\.layoutDirection, .leftToRight)
    }
  }

  private func format(_ value: Double, suffix: String, decimal: Bool) -> String {
    let number = decimal ? String(format: "%.1f", value) : String(format: "%.0f", value)
    return number + suffix
  }
}

private struct MessageView: View {
  let text: String?

  var body: some View {
    VStack(spacing: 6) {
      BrandMark(size: 16)
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
    case .fixture(let index) where feed.fixtures.indices.contains(index): return feed.fixtures[index]
    default: return feed.focusMatch ?? feed.fixtures.first
    }
  }
}

private struct SmallMatchCard: View {
  let entry: MatchesEntry
  let match: FeedMatch

  var body: some View {
    VStack(spacing: 6) {
      BrandMark(size: 11)
      HStack {
        Crest(image: entry.image(match.home.logo), size: 38)
        Spacer(minLength: 4)
        Crest(image: entry.image(match.away.logo), size: 38)
      }
      .environment(\.layoutDirection, .leftToRight)
      if match.score != nil {
        ScoreText(match: match, size: 24)
      } else {
        Text(KickoffText.time(match.kickoff, arabic: entry.isArabic))
          .font(.system(size: 18, weight: .bold))
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
  return feed.focusMatch ?? feed.fixtures.first
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
      Text("90Plus").font(.headline)
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
      Text("90Plus")
    }
  }
}
