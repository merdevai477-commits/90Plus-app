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

  /// The feed only carries `goal` for a few match minutes after it went in.
  func hasFreshGoal(_ match: FeedMatch) -> Bool {
    guard match.isLive else { return false }
    return feed?.details(for: match.fixtureId)?.goal != nil
  }

  /// The match (and its detail data) the current page belongs to.
  var block: FeedOther? {
    guard let page else { return nil }
    return feed?.block(page.slotted.slot)
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
    let goalKeys = pages.compactMap { page -> String? in
      let (slot, kind) = page.slotted
      guard kind == .goal, let block = feed.block(slot), let goal = block.featured?.goal else { return nil }
      return "\(block.match.fixtureId):\(goal.minute):\(goal.side):\(goal.player)"
    }
    WidgetPager.showNewGoal(goalKeys)
    var images = await ImageStore.images(for: imageURLs(for: feed, family: family))
    for page in pages where page.slotted.page == .info {
      if let url = feed.block(page.slotted.slot)?.featured?.info?.venueImage, let cover = await ImageStore.cover(for: url) {
        images[url + "#cover"] = cover
      }
    }

    var reloadAt = now.addingTimeInterval(feed.hasLive ? liveReload : idleReload)
    if let kickoff = feed.nextKickoff?.addingTimeInterval(60), kickoff < reloadAt {
      reloadAt = kickoff
    }
    // A just-finished match gives way at this point; a stale cached countdown must not spin reloads.
    if let refresh = feed.refreshInSec {
      reloadAt = min(reloadAt, max(loaded.at.addingTimeInterval(refresh), now.addingTimeInterval(60)))
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

    // A live followed match owns the widget until the final whistle; the other fixtures return after.
    let fixturePages = focus?.isLive == true ? [] : feed.fixtures.indices.map { WidgetPage.fixture($0) }
    switch family {
    case .systemMedium, .systemLarge, .systemExtraLarge:
      // Fresh goals first, then the focus match in full, then each other live match in full.
      let blocks = feed.blocks
      var pages: [WidgetPage] = []
      for (slot, block) in blocks.enumerated() where block.match.isLive && block.featured?.goal != nil {
        pages.append(WidgetPage.goal.inSlot(slot))
      }
      for (slot, block) in blocks.enumerated() {
        pages.append(contentsOf: detailPages(block.featured).map { $0.inSlot(slot) })
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

  private static func detailPages(_ featured: FeedFeatured?) -> [WidgetPage] {
    var pages: [WidgetPage] = [.live]
    guard let featured else { return pages }
    if !featured.events.isEmpty { pages.append(.events) }
    if featured.stats?.hasAny == true { pages.append(.stats) }
    if featured.momentum.count >= 2 { pages.append(.momentum) }
    if featured.lineup != nil { pages.append(.lineup) }
    if !featured.topPlayers.isEmpty { pages.append(.players) }
    if featured.info?.hasBasics == true { pages.append(.info) }
    if featured.info?.hasForm == true { pages.append(.form) }
    return pages
  }

  private static func imageURLs(for feed: WidgetFeed, family: WidgetFamily) -> [String] {
    switch family {
    case .accessoryInline, .accessoryCircular, .accessoryRectangular:
      return []
    default:
      break
    }
    let blocks = family == .systemSmall ? Array(feed.blocks.prefix(1)) : feed.blocks
    var urls: [String] = []
    for match in blocks.map(\.match) + feed.fixtures {
      if let logo = match.home.logo { urls.append(logo) }
      if let logo = match.away.logo { urls.append(logo) }
    }
    if family != .systemSmall {
      urls.append(contentsOf: blocks.compactMap { $0.featured?.goal?.photo })
      for featured in blocks.compactMap(\.featured) {
        urls.append(contentsOf: featured.topPlayers.compactMap(\.photo))
        urls.append(contentsOf: featured.lineup?.home.compactMap(\.photo) ?? [])
        urls.append(contentsOf: featured.lineup?.away.compactMap(\.photo) ?? [])
      }
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
