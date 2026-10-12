import AppIntents
import SwiftUI
import WidgetKit

struct MatchesEntry: TimelineEntry {
  enum Content {
    case needsTeams
    case unavailable
    case feed(WidgetFeed)
  }

  let date: Date
  let content: Content
  let labels: WidgetLabels
  let isArabic: Bool
  let pages: [WidgetPage]
  let pageIndex: Int
  let images: [String: UIImage]

  var page: WidgetPage? {
    guard !pages.isEmpty else { return nil }
    return pages[((pageIndex % pages.count) + pages.count) % pages.count]
  }

  var feed: WidgetFeed? {
    if case .feed(let feed) = content { return feed }
    return nil
  }

  /// The server clock the match `elapsed` values were measured against.
  var asOf: Date {
    guard let feed else { return date }
    return Date(timeIntervalSince1970: feed.generatedAt / 1000)
  }

  func image(_ url: String?) -> UIImage? {
    guard let url else { return nil }
    return images[url]
  }

  static func message(_ content: Content, labels: WidgetLabels = WidgetLabels(), isArabic: Bool = false) -> MatchesEntry {
    MatchesEntry(date: Date(), content: content, labels: labels, isArabic: isArabic, pages: [], pageIndex: 0, images: [:])
  }
}

struct MatchesProvider: TimelineProvider {
  func placeholder(in context: Context) -> MatchesEntry {
    .message(.needsTeams)
  }

  func getSnapshot(in context: Context, completion: @escaping (MatchesEntry) -> Void) {
    Task {
      let result = await Self.build(family: context.family, rotate: false)
      completion(result.entries.first ?? .message(.needsTeams))
    }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<MatchesEntry>) -> Void) {
    Task {
      let result = await Self.build(family: context.family, rotate: true)
      completion(Timeline(entries: result.entries, policy: .after(result.reloadAt)))
    }
  }

  private static let rotationHorizon: TimeInterval = 15 * 60
  private static let liveReload: TimeInterval = 3 * 60
  private static let idleReload: TimeInterval = 15 * 60

  static func build(family: WidgetFamily, rotate: Bool) async -> (entries: [MatchesEntry], reloadAt: Date) {
    let now = Date()
    guard let config = WidgetConfig.load(), !config.teamIds.isEmpty || !config.favoriteIds.isEmpty else {
      return ([.message(.needsTeams, labels: WidgetConfig.load()?.labels ?? WidgetLabels(),
                        isArabic: WidgetConfig.load()?.isArabic ?? false)],
              now.addingTimeInterval(60 * 60))
    }
    let labels = config.labels ?? WidgetLabels()

    guard let loaded = await FeedLoader.load(config: config) else {
      return ([.message(.unavailable, labels: labels, isArabic: config.isArabic)], now.addingTimeInterval(idleReload))
    }

    let feed = loaded.feed
    let pages = pages(for: feed, family: family)
    let images = await ImageStore.images(for: imageURLs(for: feed, family: family))

    var reloadAt = now.addingTimeInterval(feed.hasLive ? liveReload : idleReload)
    if let kickoff = feed.nextKickoff?.addingTimeInterval(60), kickoff < reloadAt {
      reloadAt = kickoff
    }

    let count = rotate && pages.count > 1 ? Int(rotationHorizon / WidgetPager.interval) : 1
    let entries = (0..<count).map { step -> MatchesEntry in
      let date = now.addingTimeInterval(Double(step) * WidgetPager.interval)
      return MatchesEntry(
        date: date,
        content: .feed(feed),
        labels: labels,
        isArabic: config.isArabic,
        pages: pages,
        pageIndex: WidgetPager.index(at: date),
        images: images
      )
    }
    return (entries, reloadAt)
  }

  static func pages(for feed: WidgetFeed, family: WidgetFamily) -> [WidgetPage] {
    let focus = feed.focusMatch
    let featured = feed.featured?.fixtureId == focus?.fixtureId ? feed.featured : nil

    let fixturePages = feed.fixtures.indices.map { WidgetPage.fixture($0) }
    switch family {
    case .systemMedium, .systemLarge, .systemExtraLarge:
      // The live match and everything about it come first; other clubs' cards follow.
      var pages: [WidgetPage] = []
      if focus != nil { pages.append(.live) }
      if let featured {
        if !featured.events.isEmpty { pages.append(.events) }
        if featured.momentum.count >= 2 { pages.append(.momentum) }
        if featured.lineup != nil { pages.append(.lineup) }
        if !featured.topPlayers.isEmpty { pages.append(.players) }
        if featured.stats?.hasAny == true { pages.append(.stats) }
      }
      pages.append(contentsOf: fixturePages)
      return pages.isEmpty ? [.empty] : pages
    case .systemSmall:
      let pages = (focus != nil ? [WidgetPage.live] : []) + fixturePages
      return pages.isEmpty ? [.empty] : pages
    default:
      if focus != nil { return [.live] }
      return fixturePages.isEmpty ? [.empty] : [fixturePages[0]]
    }
  }

  private static func imageURLs(for feed: WidgetFeed, family: WidgetFamily) -> [String] {
    switch family {
    case .accessoryInline, .accessoryCircular, .accessoryRectangular:
      return []
    default:
      break
    }
    var urls: [String] = []
    for match in [feed.focusMatch].compactMap({ $0 }) + feed.fixtures {
      if let logo = match.home.logo { urls.append(logo) }
      if let logo = match.away.logo { urls.append(logo) }
    }
    if family != .systemSmall {
      urls.append(contentsOf: feed.featured?.topPlayers.compactMap(\.photo) ?? [])
      urls.append(contentsOf: feed.featured?.lineup?.home.compactMap(\.photo) ?? [])
      urls.append(contentsOf: feed.featured?.lineup?.away.compactMap(\.photo) ?? [])
    }
    return urls
  }
}

/// Arrow buttons on the widget; WidgetKit reloads the timeline right after `perform()`.
struct ChangePageIntent: AppIntent {
  static var title: LocalizedStringResource = "Change widget page"
  static var isDiscoverable: Bool = false

  @Parameter(title: "Step")
  var step: Int

  init() {
    step = 1
  }

  init(step: Int) {
    self.step = step
  }

  func perform() async throws -> some IntentResult {
    WidgetPager.shift(by: step)
    return .result()
  }
}

struct MatchesWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: WidgetShared.kind, provider: MatchesProvider()) { entry in
      MatchesWidgetView(entry: entry)
    }
    .configurationDisplayName("90PLUS")
    .description("Live scores and the next match of the teams you follow.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    .contentMarginsDisabled()
  }
}
