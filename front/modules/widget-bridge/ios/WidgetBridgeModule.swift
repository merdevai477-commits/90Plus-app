import ActivityKit
import ExpoModulesCore

/// iOS side of the widget bridge. Widget config itself goes through `ExtensionStorage`
/// (@bacons/apple-targets); this module only covers match Live Activities.
public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    // The widget extension that draws the activity (targets/widget) requires iOS 17.
    AsyncFunction("areLiveActivitiesEnabled") { () -> Bool in
      guard #available(iOS 17.0, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("activeMatchActivities") { () async -> [Int] in
      guard #available(iOS 16.2, *) else { return [] }
      return await LiveActivityCenter.shared.activeFixtureIds
    }

    AsyncFunction("startMatchActivity") { (json: String) async throws -> Bool in
      guard #available(iOS 17.0, *) else { return false }
      let request = try JSONDecoder().decode(MatchActivityRequest.self, from: Data(json.utf8))
      return try await LiveActivityCenter.shared.start(request)
    }

    AsyncFunction("endMatchActivity") { (fixtureId: Int) async in
      guard #available(iOS 16.2, *) else { return }
      await LiveActivityCenter.shared.end(fixtureId: fixtureId)
    }

    AsyncFunction("endMatchActivitiesExcept") { (fixtureIds: [Int]) async in
      guard #available(iOS 16.2, *) else { return }
      await LiveActivityCenter.shared.endExcept(fixtureIds: Set(fixtureIds))
    }

    AsyncFunction("refreshLiveActivityRegistration") { () async in
      guard #available(iOS 16.2, *) else { return }
      await LiveActivityCenter.shared.refreshStartRegistration()
    }

    /// Current ActivityKit tokens + deviceId so JS can POST them via fetch (native URLSession
    /// has been observed to never deliver tokens to the backend in production).
    AsyncFunction("currentLiveActivityTokens") { () async -> [String: Any] in
      guard #available(iOS 16.2, *) else {
        return ["deviceId": "", "tokens": [] as [[String: Any]]]
      }
      // LiveActivityCenter is @MainActor — hop onto it before reading tokens/deviceId.
      let snapshots = await LiveActivityCenter.shared.currentTokens()
      let deviceId = await LiveActivityCenter.shared.registrationDeviceId
      let tokens: [[String: Any]] = snapshots.map { snap in
        var row: [String: Any] = ["kind": snap.kind, "token": snap.token]
        if let fixtureId = snap.fixtureId { row["fixtureId"] = fixtureId }
        return row
      }
      return ["deviceId": deviceId, "tokens": tokens]
    }

    AsyncFunction("liveActivityDiagnostics") { () async -> [String: Any] in
      guard #available(iOS 16.2, *) else { return [:] }
      return await LiveActivityCenter.shared.diagnostics()
    }
  }
}
