import ActivityKit
import CryptoKit
import Foundation
import ImageIO
import UIKit

private let appGroup = "group.com.mhmdsh1892.ninetyplusapp"

/// Written by the JS side (`widget.config`, shared with the home-screen widget).
private struct BridgeConfig: Decodable {
  let teamIds: [Int]
  let apiBase: String
  let language: String
}

@available(iOS 16.1, *)
struct MatchActivityRequest: Decodable {
  let attributes: MatchActivityAttributes
  let state: MatchActivityAttributes.ContentState
}

/// Starts match Live Activities and hands every ActivityKit push token to the backend
/// (POST /api/live-activity/tokens), which then drives the lock screen card and Dynamic Island.
@available(iOS 16.2, *)
@MainActor
final class LiveActivityCenter {
  static let shared = LiveActivityCenter()

  private static let deviceIdKey = "liveActivity.deviceId"
  private static let startTokenKey = "liveActivity.startToken"
  private static let shownFixturesKey = "liveActivity.shownFixtures"
  private static let staleAfter: TimeInterval = 15 * 60

  private var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
  private var observed = Set<String>()
  private var booted = false

  /// Runs on every launch, including the background launch iOS grants after a push-to-start,
  /// so tokens of activities the server opened still reach the backend.
  func boot() {
    guard !booted else { return }
    booted = true
    for activity in Activity<MatchActivityAttributes>.activities {
      observe(activity)
    }
    Task {
      for await activity in Activity<MatchActivityAttributes>.activityUpdates {
        self.observe(activity)
      }
    }
    if #available(iOS 17.2, *) {
      Task {
        for await data in Activity<MatchActivityAttributes>.pushToStartTokenUpdates {
          let token = data.hexString
          self.defaults?.set(token, forKey: Self.startTokenKey)
          await self.post(["kind": "start", "token": token])
        }
      }
    }
  }

  var activeFixtureIds: [Int] {
    Activity<MatchActivityAttributes>.activities
      .filter { $0.activityState == .active }
      .map(\.attributes.fixtureId)
  }

  @discardableResult
  func start(_ request: MatchActivityRequest) async throws -> Bool {
    let content = ActivityContent(state: request.state, staleDate: Date().addingTimeInterval(Self.staleAfter))
    if let running = Activity<MatchActivityAttributes>.activities.first(where: {
      $0.attributes.fixtureId == request.attributes.fixtureId && $0.activityState == .active
    }) {
      await running.update(content)
      return true
    }
    // A match whose card the user already saw (and maybe swiped away) is not reopened by the app.
    if shownFixtures.contains(request.attributes.fixtureId) { return false }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
    await CrestCache.store([request.attributes.homeLogo, request.attributes.awayLogo])
    let activity = try Activity.request(attributes: request.attributes, content: content, pushType: .token)
    observe(activity)
    return true
  }

  func end(fixtureId: Int) async {
    for activity in Activity<MatchActivityAttributes>.activities where activity.attributes.fixtureId == fixtureId {
      if let token = activity.pushToken?.hexString { await remove(token) }
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  /// The followed teams changed; the server's push-to-start list must follow.
  func refreshStartRegistration() {
    guard let token = defaults?.string(forKey: Self.startTokenKey) else { return }
    Task { await self.post(["kind": "start", "token": token]) }
  }

  private func observe(_ activity: Activity<MatchActivityAttributes>) {
    guard observed.insert(activity.id).inserted else { return }
    let fixtureId = activity.attributes.fixtureId
    rememberShown(fixtureId)

    Task {
      // Push-started activities appear before their crests are cached; redraw once they are.
      if await CrestCache.store([activity.attributes.homeLogo, activity.attributes.awayLogo]) {
        await activity.update(activity.content)
      }
    }
    Task {
      for await data in activity.pushTokenUpdates {
        await self.post(["kind": "update", "token": data.hexString, "fixtureId": fixtureId])
      }
    }
    Task {
      for await state in activity.activityStateUpdates {
        guard state == .dismissed || state == .ended else { continue }
        if state == .dismissed, let token = activity.pushToken?.hexString {
          await self.remove(token)
        }
        self.observed.remove(activity.id)
        break
      }
    }
  }

  private var shownFixtures: [Int] {
    defaults?.array(forKey: Self.shownFixturesKey) as? [Int] ?? []
  }

  private func rememberShown(_ fixtureId: Int) {
    var list = shownFixtures.filter { $0 != fixtureId }
    list.append(fixtureId)
    defaults?.set(Array(list.suffix(40)), forKey: Self.shownFixturesKey)
  }

  // MARK: - Backend

  private var config: BridgeConfig? {
    guard let raw = defaults?.string(forKey: "widget.config") else { return nil }
    return try? JSONDecoder().decode(BridgeConfig.self, from: Data(raw.utf8))
  }

  private var deviceId: String {
    if let existing = defaults?.string(forKey: Self.deviceIdKey) { return existing }
    let created = UUID().uuidString
    defaults?.set(created, forKey: Self.deviceIdKey)
    return created
  }

  private func post(_ fields: [String: Any]) async {
    guard let config, let url = URL(string: "\(config.apiBase)/live-activity/tokens") else { return }
    var body = fields
    body["deviceId"] = deviceId
    body["language"] = config.language
    if fields["kind"] as? String == "start" { body["teamIds"] = config.teamIds }
    var request = URLRequest(url: url, timeoutInterval: 15)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    await send(request)
  }

  private func remove(_ token: String) async {
    guard let config, let url = URL(string: "\(config.apiBase)/live-activity/tokens/\(token)") else { return }
    var request = URLRequest(url: url, timeoutInterval: 15)
    request.httpMethod = "DELETE"
    await send(request)
  }

  /// Token callbacks often land while the app is in the background; finish the upload before suspension.
  private func send(_ request: URLRequest) async {
    let task = UIApplication.shared.beginBackgroundTask(withName: "live-activity-token")
    _ = try? await URLSession.shared.data(for: request)
    if task != .invalid { UIApplication.shared.endBackgroundTask(task) }
  }
}

/// Same cache layout as the widget's `ImageStore` (App Group, SHA-256 of the URL, 120px PNG),
/// because Live Activity views can only read local files.
enum CrestCache {
  private static let maxPixel: CGFloat = 120

  @discardableResult
  static func store(_ urls: [String]) async -> Bool {
    var wrote = false
    for urlString in Set(urls) where !urlString.isEmpty {
      guard let file = fileURL(for: urlString), !FileManager.default.fileExists(atPath: file.path),
            let remote = URL(string: urlString),
            let response = try? await URLSession.shared.data(from: remote),
            let png = downsample(response.0)?.pngData() else { continue }
      if (try? png.write(to: file, options: .atomic)) != nil { wrote = true }
    }
    return wrote
  }

  private static func fileURL(for url: String) -> URL? {
    guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
    let dir = base.appendingPathComponent("Library/Caches/widget-images", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let digest = SHA256.hash(data: Data(url.utf8)).map { String(format: "%02x", $0) }.joined()
    return dir.appendingPathComponent("\(digest).png")
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

private extension Data {
  var hexString: String { map { String(format: "%02x", $0) }.joined() }
}
