import ExpoModulesCore
import UIKit

/// Boots Live Activity token observers on every launch — including the silent background launch
/// after a push-to-start — before any JS runs.
public class LiveActivityAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if #available(iOS 16.2, *) {
      Task { @MainActor in LiveActivityCenter.shared.boot() }
    }
    return true
  }
}
