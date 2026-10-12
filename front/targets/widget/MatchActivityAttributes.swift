import ActivityKit
import Foundation

/// The server encodes both halves for push updates and push-to-start (`MatchActivityAttributes` in
/// src/services/live-activity.service.ts), and an identical copy lives in modules/widget-bridge/ios.
/// Field names and the type name itself must stay in sync across all three.
struct MatchActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var homeScore: Int
    var awayScore: Int
    /// live | ht | ft | upcoming
    var status: String
    var minute: Int?
    /// Unix seconds at which the match clock read 0'; lets the clock run on-device between pushes.
    var clockStart: Double?
  }

  var fixtureId: Int
  var homeName: String
  var awayName: String
  var homeLogo: String
  var awayLogo: String
  var league: String
  var language: String
}
