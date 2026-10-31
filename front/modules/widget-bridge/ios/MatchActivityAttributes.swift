import ActivityKit
import Foundation

/// Identical copy of targets/widget/MatchActivityAttributes.swift; ActivityKit matches the app and
/// the widget extension by type name and Codable shape, and the server encodes the same fields.
@available(iOS 16.1, *)
struct MatchActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var homeScore: Int
    var awayScore: Int
    /// live | ht | ft | upcoming
    var status: String
    var minute: Int?
    /// Unix seconds at which the match clock read 0'; capped on-device at the period end.
    var clockStart: Double?
    /// Provider period (`1H` / `2H` / `ET` / …) — used for `45+N'` / `90+N'` labels.
    var statusShort: String?
    /// Announced injury/stoppage minutes when elapsed is pinned at 45/90/120.
    var extra: Int?
  }

  var fixtureId: Int
  var homeName: String
  var awayName: String
  var homeLogo: String
  var awayLogo: String
  var league: String
  var language: String
}
