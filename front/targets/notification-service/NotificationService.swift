import UserNotifications

/// Attaches the image sent via Expo push `richContent.image` (e.g. the scoring team's crest).
/// Expo delivers it at `body._richContent.image`; APNs must send `mutable-content: 1` for iOS to run this.
class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttemptContent: UNMutableNotificationContent?
  private var downloadTask: URLSessionDownloadTask?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
      contentHandler(request.content)
      return
    }
    bestAttemptContent = content

    guard let imageUrl = Self.imageUrl(from: request.content.userInfo) else {
      contentHandler(content)
      return
    }

    downloadTask = URLSession.shared.downloadTask(with: imageUrl) { [weak self] location, response, _ in
      guard let self = self else { return }
      if let location = location,
         let attachment = Self.makeAttachment(from: location, response: response, sourceUrl: imageUrl) {
        content.attachments = [attachment]
      }
      self.deliver()
    }
    downloadTask?.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    downloadTask?.cancel()
    deliver()
  }

  private func deliver() {
    guard let handler = contentHandler, let content = bestAttemptContent else { return }
    contentHandler = nil
    handler(content)
  }

  private static func imageUrl(from userInfo: [AnyHashable: Any]) -> URL? {
    let body = userInfo["body"] as? [String: Any]
    let richContent = (body?["_richContent"] ?? userInfo["_richContent"]) as? [String: Any]
    guard let raw = richContent?["image"] as? String,
          let url = URL(string: raw),
          url.scheme?.lowercased() == "https" else {
      return nil
    }
    return url
  }

  /// UNNotificationAttachment infers the media type from the file extension, so keep a real one.
  private static func makeAttachment(
    from location: URL,
    response: URLResponse?,
    sourceUrl: URL
  ) -> UNNotificationAttachment? {
    let ext: String
    switch response?.mimeType?.lowercased() {
    case "image/jpeg", "image/jpg": ext = "jpg"
    case "image/gif": ext = "gif"
    case "image/png": ext = "png"
    default:
      let pathExt = sourceUrl.pathExtension.lowercased()
      ext = ["png", "jpg", "jpeg", "gif"].contains(pathExt) ? pathExt : "png"
    }

    let target = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension(ext)
    do {
      try FileManager.default.moveItem(at: location, to: target)
      return try UNNotificationAttachment(identifier: "image", url: target, options: nil)
    } catch {
      return nil
    }
  }
}
