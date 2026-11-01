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

/// One push token the JS side can POST itself (independent of native URLSession).
@available(iOS 16.2, *)
struct LiveActivityTokenSnapshot: Codable {
  let kind: String
  let token: String
  let fixtureId: Int?
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
  private static let diagKey = "liveActivity.diag"
  private static let staleAfter: TimeInterval = 15 * 60

  private var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
  private var observed = Set<String>()
  private var booted = false

  /// Runs on every launch, including the background launch iOS grants after a push-to-start,
  /// so tokens of activities the server opened still reach the backend.
  func boot() {
    guard !booted else { return }
    booted = true
    recordDiag("boot")

    for activity in Activity<MatchActivityAttributes>.activities {
      observe(activity)
      Task { await self.uploadCurrentUpdateToken(of: activity) }
    }
    Task {
      for await activity in Activity<MatchActivityAttributes>.activityUpdates {
        self.observe(activity)
        await self.uploadCurrentUpdateToken(of: activity)
      }
    }
    if #available(iOS 17.2, *) {
      // Tokens can arrive before the async sequence is subscribed; read the current one first.
      if let data = Activity<MatchActivityAttributes>.pushToStartToken {
        let token = data.hexString
        defaults?.set(token, forKey: Self.startTokenKey)
        recordDiag("startToken.sync")
        Task { await self.post(["kind": "start", "token": token]) }
      }
      Task {
        for await data in Activity<MatchActivityAttributes>.pushToStartTokenUpdates {
          let token = data.hexString
          self.defaults?.set(token, forKey: Self.startTokenKey)
          self.recordDiag("startToken.update")
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

  /// Stable device id shared with the JS registration path.
  var registrationDeviceId: String { deviceId }

  /// Current push-to-start + per-activity update tokens, for the JS fetch fallback.
  func currentTokens() -> [LiveActivityTokenSnapshot] {
    var out: [LiveActivityTokenSnapshot] = []
    if let start = defaults?.string(forKey: Self.startTokenKey), !start.isEmpty {
      out.append(LiveActivityTokenSnapshot(kind: "start", token: start, fixtureId: nil))
    }
    if #available(iOS 17.2, *), let data = Activity<MatchActivityAttributes>.pushToStartToken {
      let token = data.hexString
      if out.contains(where: { $0.kind == "start" && $0.token == token }) == false {
        defaults?.set(token, forKey: Self.startTokenKey)
        out.append(LiveActivityTokenSnapshot(kind: "start", token: token, fixtureId: nil))
      }
    }
    for activity in Activity<MatchActivityAttributes>.activities where activity.activityState == .active {
      if let data = activity.pushToken {
        out.append(
          LiveActivityTokenSnapshot(
            kind: "update",
            token: data.hexString,
            fixtureId: activity.attributes.fixtureId
          )
        )
      }
    }
    return out
  }

  func diagnostics() -> [String: Any] {
    let raw = defaults?.dictionary(forKey: Self.diagKey) ?? [:]
    var out = raw
    out["activeCount"] = Activity<MatchActivityAttributes>.activities.filter { $0.activityState == .active }.count
    out["tokenCount"] = currentTokens().count
    out["hasConfig"] = config != nil
    out["deviceId"] = deviceId
    return out
  }

  @discardableResult
  func start(_ request: MatchActivityRequest) async throws -> Bool {
    let content = ActivityContent(state: request.state, staleDate: Date().addingTimeInterval(Self.staleAfter))
    if let running = Activity<MatchActivityAttributes>.activities.first(where: {
      $0.attributes.fixtureId == request.attributes.fixtureId && $0.activityState == .active
    }) {
      await running.update(content)
      await uploadCurrentUpdateToken(of: running)
      return true
    }
    // Same fixture already shown (and maybe swiped away) — do not reopen from the app.
    if shownFixtures.contains(request.attributes.fixtureId) { return false }
    // Same home/away pair under a different fixtureId (API-Football vs 365) would spawn a twin card.
    if hasActiveCard(home: request.attributes.homeName, away: request.attributes.awayName) {
      return false
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
    await CrestCache.store([request.attributes.homeLogo, request.attributes.awayLogo])
    let activity = try Activity.request(attributes: request.attributes, content: content, pushType: .token)
    observe(activity)
    // Token emission is async; poll a few times so the first upload is not lost if the
    // pushTokenUpdates stream already fired (or is delayed) before we subscribe.
    Task {
      for _ in 0..<8 {
        if await self.uploadCurrentUpdateToken(of: activity) { return }
        try? await Task.sleep(nanoseconds: 500_000_000)
      }
    }
    return true
  }

  func end(fixtureId: Int) async {
    for activity in Activity<MatchActivityAttributes>.activities where activity.attributes.fixtureId == fixtureId {
      if let token = activity.pushToken?.hexString { await remove(token) }
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  /// Ends every active card whose fixtureId is not in `keep` (finished / gone from the feed).
  func endExcept(fixtureIds keep: Set<Int>) async {
    for activity in Activity<MatchActivityAttributes>.activities where activity.activityState == .active {
      let id = activity.attributes.fixtureId
      if keep.contains(id) { continue }
      if let token = activity.pushToken?.hexString { await remove(token) }
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  /// Re-posts the push-to-start token and every active update token.
  func refreshStartRegistration() async {
    if let token = defaults?.string(forKey: Self.startTokenKey) {
      await post(["kind": "start", "token": token])
    } else if #available(iOS 17.2, *), let data = Activity<MatchActivityAttributes>.pushToStartToken {
      let token = data.hexString
      defaults?.set(token, forKey: Self.startTokenKey)
      await post(["kind": "start", "token": token])
    }
    for activity in Activity<MatchActivityAttributes>.activities where activity.activityState == .active {
      await uploadCurrentUpdateToken(of: activity)
    }
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
        self.recordDiag("updateToken.\(fixtureId)")
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

  @discardableResult
  private func uploadCurrentUpdateToken(of activity: Activity<MatchActivityAttributes>) async -> Bool {
    guard let data = activity.pushToken else { return false }
    recordDiag("updateToken.sync.\(activity.attributes.fixtureId)")
    await post(["kind": "update", "token": data.hexString, "fixtureId": activity.attributes.fixtureId])
    return true
  }

  private func hasActiveCard(home: String, away: String) -> Bool {
    let homeKey = Self.normalizeName(home)
    let awayKey = Self.normalizeName(away)
    return Activity<MatchActivityAttributes>.activities.contains {
      $0.activityState == .active
        && Self.normalizeName($0.attributes.homeName) == homeKey
        && Self.normalizeName($0.attributes.awayName) == awayKey
    }
  }

  private static func normalizeName(_ name: String) -> String {
    name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  private var shownFixtures: [Int] {
    defaults?.array(forKey: Self.shownFixturesKey) as? [Int] ?? []
  }

  private func rememberShown(_ fixtureId: Int) {
    var list = shownFixtures.filter { $0 != fixtureId }
    list.append(fixtureId)
    defaults?.set(Array(list.suffix(40)), forKey: Self.shownFixturesKey)
  }

  private func recordDiag(_ event: String) {
    var diag = defaults?.dictionary(forKey: Self.diagKey) ?? [:]
    diag["lastEvent"] = event
    diag["lastEventAt"] = Date().timeIntervalSince1970
    defaults?.set(diag, forKey: Self.diagKey)
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
    guard let config, let url = URL(string: "\(config.apiBase)/live-activity/tokens") else {
      recordDiag("post.skip.noConfig")
      return
    }
    var body = fields
    body["deviceId"] = deviceId
    body["language"] = config.language
    if fields["kind"] as? String == "start" { body["teamIds"] = config.teamIds }
    var request = URLRequest(url: url, timeoutInterval: 15)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    let ok = await send(request)
    recordDiag(ok ? "post.ok.\(fields["kind"] ?? "?")" : "post.fail.\(fields["kind"] ?? "?")")
  }

  private func remove(_ token: String) async {
    guard let config, let url = URL(string: "\(config.apiBase)/live-activity/tokens/\(token)") else { return }
    var request = URLRequest(url: url, timeoutInterval: 15)
    request.httpMethod = "DELETE"
    _ = await send(request)
  }

  /// Token callbacks often land while the app is in the background; finish the upload before suspension.
  @discardableResult
  private func send(_ request: URLRequest) async -> Bool {
    let task = UIApplication.shared.beginBackgroundTask(withName: "live-activity-token")
    defer {
      if task != .invalid { UIApplication.shared.endBackgroundTask(task) }
    }
    do {
      let (_, response) = try await URLSession.shared.data(for: request)
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      return (200..<300).contains(status)
    } catch {
      return false
    }
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
