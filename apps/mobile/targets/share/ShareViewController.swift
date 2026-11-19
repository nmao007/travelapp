import UIKit
import UniformTypeIdentifiers

// Bare-bones share screen (phase 2 proof): saves the shared link to the app
// group inbox and confirms. The app moves inbox entries into Ideas when it
// next becomes active. The full screen (thumbnail, trip picker, places) comes later.
class ShareViewController: UIViewController {
  private let appGroup = "group.app.trippilot.mobile"
  private let inboxKey = "importInbox"
  private let message = UILabel()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor.black.withAlphaComponent(0.2)

    let card = UIView()
    card.backgroundColor = .white
    card.layer.cornerRadius = 22
    card.layer.cornerCurve = .continuous
    card.translatesAutoresizingMaskIntoConstraints = false

    message.text = "Saving to TripPilot…"
    message.font = .systemFont(ofSize: 17, weight: .semibold)
    message.textColor = UIColor(red: 0.16, green: 0.17, blue: 0.2, alpha: 1)
    message.textAlignment = .center
    message.numberOfLines = 0
    message.translatesAutoresizingMaskIntoConstraints = false

    card.addSubview(message)
    view.addSubview(card)
    NSLayoutConstraint.activate([
      card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
      card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      message.topAnchor.constraint(equalTo: card.topAnchor, constant: 28),
      message.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -28),
      message.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
      message.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
    ])

    Task { @MainActor in
      let shared = await readShared()
      if let link = shared.url {
        save(url: link, text: shared.text)
        message.text = "Saved to TripPilot"
      } else {
        message.text = "TripPilot couldn't find a link to save"
      }
      try? await Task.sleep(nanoseconds: 900_000_000)
      extensionContext?.completeRequest(returningItems: nil)
    }
  }

  private func readShared() async -> (url: String?, text: String?) {
    var url: String?
    var text: String?
    let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
    for item in items {
      if text == nil, let content = item.attributedContentText?.string, !content.isEmpty { text = content }
      for provider in item.attachments ?? [] {
        if url == nil, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
           let value = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
          url = value.absoluteString
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
           let value = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
          if url == nil { url = firstLink(in: value) }
          if text == nil { text = value }
        }
      }
    }
    return (url, text == url ? nil : text)
  }

  private func firstLink(in text: String) -> String? {
    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
    let range = NSRange(text.startIndex..., in: text)
    return detector?.firstMatch(in: text, options: [], range: range)?.url?.absoluteString
  }

  // The inbox is a JSON array string so the app can read it with ExtensionStorage.get.
  private func save(url: String, text: String?) {
    guard let defaults = UserDefaults(suiteName: appGroup) else { return }
    var inbox: [[String: String]] = []
    if let stored = defaults.string(forKey: inboxKey), let data = stored.data(using: .utf8),
       let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] {
      inbox = parsed
    }
    var entry = ["url": url, "savedAt": ISO8601DateFormatter().string(from: Date())]
    if let text { entry["text"] = text }
    inbox.append(entry)
    if let data = try? JSONSerialization.data(withJSONObject: inbox), let json = String(data: data, encoding: .utf8) {
      defaults.set(json, forKey: inboxKey)
    }
  }
}
