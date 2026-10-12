import CryptoKit
import Foundation
import ImageIO
import UIKit

enum WidgetShared {
  /// Must match `WIDGET_APP_GROUP` in modules/widget-bridge and `ios.entitlements` in app.json.
  static let appGroup = "group.com.mhmdsh1892.ninetyplusapp"
  static let configKey = "widget.config"
  static let feedKey = "widget.feed"
  static let feedAtKey = "widget.feedAt"
  static let kind = "NinetyPlusMatchesWidget"

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
}

// MARK: - Config written by the app (JSON string under `widget.config`)

struct WidgetLabels: Codable, Hashable {
  var live = "Live"
  var upcoming = "Upcoming"
  var finished = "FT"
  var halftime = "HT"
  var postponed = "Postponed"
  var topPlayers = "Top rated"
  var momentum = "Match momentum"
  var myTeams = "My teams"
  var followTeams = "Follow teams in 90PLUS to see their matches here"
  var vs = "vs"
  var today = "Today"
  var tomorrow = "Tomorrow"
}

struct WidgetConfig: Codable {
  var teamIds: [Int]
  var apiBase: String
  var language: String
  var labels: WidgetLabels?

  var isArabic: Bool { language.hasPrefix("ar") }

  static func load() -> WidgetConfig? {
    guard let raw = WidgetShared.defaults?.string(forKey: WidgetShared.configKey),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetConfig.self, from: data)
  }
}

// MARK: - Feed from GET /api/football/widget/followed (mirrors widget-feed.service.ts)

struct FeedSide: Codable, Hashable {
  let id: Int
  let name: String
  let logo: String?
}

struct FeedScore: Codable, Hashable {
  let home: Int
  let away: Int
}

struct FeedLeague: Codable, Hashable {
  let id: Int
  let name: String
  let logo: String?
}

struct FeedMatch: Codable, Hashable {
  let fixtureId: Int
  let status: String
  let statusShort: String
  let kickoffTs: Double
  let elapsed: Int?
  let extra: Int?
  let home: FeedSide
  let away: FeedSide
  let score: FeedScore?
  let league: FeedLeague?

  var isLive: Bool { status == "live" || status == "ht" }
  var kickoff: Date { Date(timeIntervalSince1970: kickoffTs) }
  var deepLink: URL? { URL(string: "ninetyplus://match-details?fixtureId=\(fixtureId)") }
}

struct FeedTeam: Codable, Hashable {
  let teamId: Int
  let name: String
  let logo: String?
  let match: FeedMatch?
}

struct FeedPlayer: Codable, Hashable {
  let id: Int?
  let name: String
  let rating: Double
  let side: String
  let photo: String?
}

struct FeedMomentumPoint: Codable, Hashable {
  let minute: Int
  let home: Int
  let away: Int
}

struct FeedFeatured: Codable, Hashable {
  let fixtureId: Int
  let topPlayers: [FeedPlayer]
  let momentum: [FeedMomentumPoint]
}

struct WidgetFeed: Codable, Hashable {
  let generatedAt: Double
  let hasLive: Bool
  let teams: [FeedTeam]
  let featured: FeedFeatured?

  var featuredMatch: FeedMatch? {
    guard let featured else { return nil }
    return teams.first { $0.match?.fixtureId == featured.fixtureId }?.match
  }

  var nextKickoff: Date? {
    teams.compactMap { $0.match }
      .filter { $0.status == "upcoming" && $0.kickoff > Date() }
      .map(\.kickoff)
      .min()
  }
}

private struct FeedEnvelope: Codable {
  let response: WidgetFeed
}

// MARK: - Network + cache

enum FeedLoader {
  /// Reuse a very fresh cached feed so page buttons (which reload the timeline) feel instant.
  static let freshWindow: TimeInterval = 75

  static func cached() -> (feed: WidgetFeed, at: Date)? {
    guard let defaults = WidgetShared.defaults,
          let data = defaults.data(forKey: WidgetShared.feedKey),
          let feed = try? JSONDecoder().decode(WidgetFeed.self, from: data) else { return nil }
    let at = Date(timeIntervalSince1970: defaults.double(forKey: WidgetShared.feedAtKey))
    return (feed, at)
  }

  static func load(config: WidgetConfig) async -> (feed: WidgetFeed, at: Date)? {
    let cache = cached()
    if let cache, Date().timeIntervalSince(cache.at) < freshWindow, cacheMatches(cache.feed, config) {
      return cache
    }
    if let fresh = await fetch(config: config) {
      if let data = try? JSONEncoder().encode(fresh) {
        WidgetShared.defaults?.set(data, forKey: WidgetShared.feedKey)
        WidgetShared.defaults?.set(Date().timeIntervalSince1970, forKey: WidgetShared.feedAtKey)
      }
      return (fresh, Date())
    }
    if let cache, cacheMatches(cache.feed, config) { return cache }
    return nil
  }

  /// A cached feed for a different team list must never leak unfollowed teams onto the widget.
  private static func cacheMatches(_ feed: WidgetFeed, _ config: WidgetConfig) -> Bool {
    Set(feed.teams.map(\.teamId)).isSubset(of: Set(config.teamIds))
  }

  private static func fetch(config: WidgetConfig) async -> WidgetFeed? {
    let teams = config.teamIds.map(String.init).joined(separator: ",")
    guard var components = URLComponents(string: "\(config.apiBase)/football/widget/followed") else { return nil }
    components.queryItems = [
      URLQueryItem(name: "teams", value: teams),
      URLQueryItem(name: "language", value: config.language),
    ]
    guard let url = components.url else { return nil }
    var request = URLRequest(url: url, timeoutInterval: 12)
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
      return try JSONDecoder().decode(FeedEnvelope.self, from: data).response
    } catch {
      return nil
    }
  }
}

/// Crests and player photos, downsampled and cached in the App Group so reloads skip the network.
enum ImageStore {
  private static let maxPixel: CGFloat = 120

  private static var directory: URL? {
    guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: WidgetShared.appGroup)
    else { return nil }
    let dir = base.appendingPathComponent("Library/Caches/widget-images", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  private static func fileURL(for url: String) -> URL? {
    let digest = SHA256.hash(data: Data(url.utf8)).map { String(format: "%02x", $0) }.joined()
    return directory?.appendingPathComponent("\(digest).png")
  }

  static func images(for urls: [String]) async -> [String: UIImage] {
    let unique = Array(Set(urls.filter { !$0.isEmpty })).prefix(16)
    return await withTaskGroup(of: (String, UIImage?).self) { group in
      for url in unique {
        group.addTask { (url, await ImageStore.image(for: url)) }
      }
      var out: [String: UIImage] = [:]
      for await (url, image) in group {
        if let image { out[url] = image }
      }
      return out
    }
  }

  /// Live Activity views cannot fetch, so they only read what the app or the widget already cached.
  static func cachedImage(for urlString: String) -> UIImage? {
    guard !urlString.isEmpty,
          let file = fileURL(for: urlString),
          let data = try? Data(contentsOf: file) else { return nil }
    return UIImage(data: data)
  }

  private static func image(for urlString: String) async -> UIImage? {
    if let file = fileURL(for: urlString),
       let data = try? Data(contentsOf: file),
       let cached = UIImage(data: data) {
      return cached
    }
    guard let url = URL(string: urlString),
          let response = try? await URLSession.shared.data(from: url),
          let image = downsample(response.0) else { return nil }
    if let file = fileURL(for: urlString), let png = image.pngData() {
      try? png.write(to: file, options: .atomic)
    }
    return image
  }

  private static func downsample(_ data: Data) -> UIImage? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixel,
    ]
    guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
    return UIImage(cgImage: cg)
  }
}

// MARK: - Page rotation

enum WidgetPage: Hashable {
  case live
  case players
  case momentum
  case list
  case match(Int)
}

/// Displayed page at time t = base + elapsed rotation steps since `baseAt`; the arrow buttons rebase it.
enum WidgetPager {
  static let interval: TimeInterval = 60
  private static let baseKey = "widget.pageBase"
  private static let baseAtKey = "widget.pageBaseAt"

  static func index(at date: Date) -> Int {
    let defaults = WidgetShared.defaults
    let base = defaults?.integer(forKey: baseKey) ?? 0
    let baseAt = defaults?.double(forKey: baseAtKey) ?? 0
    return base + Int(max(0, date.timeIntervalSince1970 - baseAt) / interval)
  }

  static func shift(by delta: Int) {
    let now = Date()
    let current = index(at: now)
    WidgetShared.defaults?.set(current + delta, forKey: baseKey)
    WidgetShared.defaults?.set(now.timeIntervalSince1970, forKey: baseAtKey)
  }
}
