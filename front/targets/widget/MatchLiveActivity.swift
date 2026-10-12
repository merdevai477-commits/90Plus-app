import ActivityKit
import SwiftUI
import WidgetKit

private enum ActivityPalette {
  static let background = Color(red: 0.08, green: 0.07, blue: 0.11)
  static let muted = Color(red: 0.65, green: 0.65, blue: 0.65)
  static let liveText = Color(red: 0.87, green: 0.12, blue: 0.12)
  static let liveFill = Color(red: 0.53, green: 0.02, blue: 0.02).opacity(0.32)
  static let idleText = Color(red: 0.75, green: 0.75, blue: 0.75)
  static let idleFill = Color.white.opacity(0.10)
  static let purple = Color(red: 0.545, green: 0.361, blue: 0.965)
}

private struct ActivityCopy {
  let live: String
  let halftime: String
  let fullTime: String

  init(language: String) {
    if language.hasPrefix("ar") {
      live = "مباشر"
      halftime = "استراحة"
      fullTime = "انتهت"
    } else {
      live = "Live"
      halftime = "HT"
      fullTime = "FT"
    }
  }
}

private extension MatchActivityAttributes {
  var isArabic: Bool { language.hasPrefix("ar") }
  var deepLink: URL? { URL(string: "ninetyplus://match-details?fixtureId=\(fixtureId)") }
  var direction: LayoutDirection { isArabic ? .rightToLeft : .leftToRight }
}

struct MatchLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: MatchActivityAttributes.self) { context in
      LockScreenMatchView(attributes: context.attributes, state: context.state)
        .activityBackgroundTint(ActivityPalette.background.opacity(0.82))
        .activitySystemActionForegroundColor(.white)
        .widgetURL(context.attributes.deepLink)
    } dynamicIsland: { context in
      let attributes = context.attributes
      let state = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          TeamBadge(name: attributes.homeName, logo: attributes.homeLogo, crest: 34)
            .environment(\.layoutDirection, attributes.direction)
        }
        DynamicIslandExpandedRegion(.trailing) {
          TeamBadge(name: attributes.awayName, logo: attributes.awayLogo, crest: 34)
            .environment(\.layoutDirection, attributes.direction)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 4) {
            ScoreLine(state: state, size: 26)
            StatusPill(state: state, copy: ActivityCopy(language: attributes.language))
          }
          .environment(\.layoutDirection, attributes.direction)
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(attributes.league)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(ActivityPalette.muted)
            .lineLimit(1)
        }
      } compactLeading: {
        HStack(spacing: 4) {
          CrestImage(logo: attributes.homeLogo, size: 18)
          Text("\(state.homeScore)").font(.system(size: 14, weight: .bold)).monospacedDigit()
        }
      } compactTrailing: {
        HStack(spacing: 4) {
          Text("\(state.awayScore)").font(.system(size: 14, weight: .bold)).monospacedDigit()
          CrestImage(logo: attributes.awayLogo, size: 18)
        }
      } minimal: {
        Text("\(state.homeScore)-\(state.awayScore)")
          .font(.system(size: 12, weight: .bold))
          .monospacedDigit()
      }
      .widgetURL(attributes.deepLink)
      .keylineTint(ActivityPalette.purple)
    }
  }
}

/// Lock screen / banner: the same live card as the home-screen widget (Figma 1442:4283).
private struct LockScreenMatchView: View {
  let attributes: MatchActivityAttributes
  let state: MatchActivityAttributes.ContentState

  var body: some View {
    VStack(spacing: 10) {
      HStack {
        Text(attributes.league)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(ActivityPalette.muted)
          .lineLimit(1)
        Spacer(minLength: 8)
        Text("90PLUS")
          .font(.system(size: 10, weight: .heavy))
          .foregroundStyle(ActivityPalette.purple)
      }
      HStack(spacing: 12) {
        TeamBadge(name: attributes.homeName, logo: attributes.homeLogo, crest: 40)
          .frame(maxWidth: .infinity)
        VStack(spacing: 6) {
          StatusPill(state: state, copy: ActivityCopy(language: attributes.language))
          ScoreLine(state: state, size: 30)
        }
        TeamBadge(name: attributes.awayName, logo: attributes.awayLogo, crest: 40)
          .frame(maxWidth: .infinity)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    .environment(\.layoutDirection, attributes.direction)
  }
}

private struct CrestImage: View {
  let logo: String
  let size: CGFloat

  var body: some View {
    Group {
      if let image = ImageStore.cachedImage(for: logo) {
        Image(uiImage: image).resizable().scaledToFit()
      } else {
        Image(systemName: "shield.fill")
          .resizable()
          .scaledToFit()
          .foregroundStyle(Color.white.opacity(0.25))
          .padding(size * 0.12)
      }
    }
    .frame(width: size, height: size)
  }
}

private struct TeamBadge: View {
  let name: String
  let logo: String
  let crest: CGFloat

  var body: some View {
    VStack(spacing: 6) {
      CrestImage(logo: logo, size: crest)
      Text(name)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(ActivityPalette.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
  }
}

/// An HStack (not one string) so the home score sits next to the home crest in RTL too.
private struct ScoreLine: View {
  let state: MatchActivityAttributes.ContentState
  let size: CGFloat

  var body: some View {
    HStack(spacing: size * 0.2) {
      Text("\(state.homeScore)").contentTransition(.numericText())
      Text("-")
      Text("\(state.awayScore)").contentTransition(.numericText())
    }
    .font(.system(size: size, weight: .semibold))
    .monospacedDigit()
    .foregroundStyle(.white)
  }
}

private struct StatusPill: View {
  let state: MatchActivityAttributes.ContentState
  let copy: ActivityCopy

  var body: some View {
    label
      .font(.system(size: 11, weight: .semibold))
      .monospacedDigit()
      .foregroundStyle(isLive ? ActivityPalette.liveText : ActivityPalette.idleText)
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .background(isLive ? ActivityPalette.liveFill : ActivityPalette.idleFill, in: Capsule())
  }

  private var isLive: Bool { state.status == "live" }

  @ViewBuilder
  private var label: some View {
    switch state.status {
    case "ht":
      Text(copy.halftime)
    case "ft":
      Text(copy.fullTime)
    default:
      if let clockStart = state.clockStart {
        let start = Date(timeIntervalSince1970: clockStart)
        Text(timerInterval: start...start.addingTimeInterval(150 * 60), countsDown: false)
          .multilineTextAlignment(.center)
          .frame(width: 44)
      } else if let minute = state.minute {
        Text("\(minute)'")
      } else {
        Text(copy.live)
      }
    }
  }
}
