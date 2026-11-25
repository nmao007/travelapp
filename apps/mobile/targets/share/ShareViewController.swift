import SwiftUI
import UIKit
import UniformTypeIdentifiers

// The share sheet's "Elsewhere" screen. It previews the shared video or link
// (caption, creator, cover and the places the caption names, from the server's
// /api/social-preview), lets you pick a place and a trip, and saves the link to
// the app group inbox. The app moves it into the trip's Ideas when it opens,
// so saving works offline and while signed out.
//
// The app writes "shareContext" (API address and trips) to the app group; see
// src/lib/share-inbox.tsx. Fonts are the app's DM Sans, bundled in this folder.

private let appGroup = "group.app.trippilot.mobile"
private let inboxKey = "importInbox"
private let contextKey = "shareContext"
private let lastTripKey = "lastShareTrip"

class ShareViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    Fonts.register()
    view.backgroundColor = .clear
    let model = ShareModel(context: extensionContext)
    let host = UIHostingController(rootView: ShareSheet(model: model))
    host.view.backgroundColor = .clear
    addChild(host)
    host.view.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(host.view)
    NSLayoutConstraint.activate([
      host.view.topAnchor.constraint(equalTo: view.topAnchor),
      host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
    ])
    host.didMove(toParent: self)
    Task { await model.load() }
  }
}

// MARK: - Data

struct TripChoice: Decodable, Hashable { let id: String; let name: String; let dates: String }
struct PlaceChoice: Codable, Hashable { let placeId: String; let name: String; let detail: String? }
struct Preview: Decodable {
  let provider: String; let url: String; let title: String; let author: String; let handle: String; let image: String; let places: [PlaceChoice]
}
private struct ShareContext: Decodable { let apiUrl: String; let trips: [TripChoice] }

@MainActor
final class ShareModel: ObservableObject {
  enum Phase { case loading, ready, saved(String), failed(String) }
  @Published var phase: Phase = .loading
  @Published var link: String?
  @Published var preview: Preview?
  @Published var previewFailed = false
  @Published var place: PlaceChoice?
  @Published var trip: TripChoice?
  // "New trip": the app asks for the destination when it opens.
  @Published var newTrip = false
  @Published var trips: [TripChoice] = []
  private let context: NSExtensionContext?
  private var sharedText: String?
  private let defaults = UserDefaults(suiteName: appGroup)

  init(context: NSExtensionContext?) { self.context = context }

  var providerName: String {
    switch preview?.provider ?? Self.provider(for: link) {
    case "tiktok": return "TikTok"
    case "instagram": return "Instagram"
    case "youtube": return "YouTube"
    default: return URL(string: link ?? "")?.host?.replacingOccurrences(of: "www.", with: "") ?? "Link"
    }
  }

  static func provider(for link: String?) -> String {
    let host = URL(string: link ?? "")?.host ?? ""
    if host.hasSuffix("tiktok.com") { return "tiktok" }
    if host.hasSuffix("instagram.com") { return "instagram" }
    if host.hasSuffix("youtube.com") || host.hasSuffix("youtu.be") { return "youtube" }
    return "web"
  }

  func load() async {
    let shared = await readShared()
    guard let url = shared.url else { phase = .failed("Elsewhere couldn't find a link to save."); return }
    link = url
    sharedText = shared.text
    var apiUrl = "http://localhost:3010"
    if let raw = defaults?.string(forKey: contextKey), let data = raw.data(using: .utf8), let saved = try? JSONDecoder().decode(ShareContext.self, from: data) {
      trips = saved.trips
      apiUrl = saved.apiUrl
    }
    let last = defaults?.string(forKey: lastTripKey)
    trip = trips.first { $0.id == last } ?? trips.first
    phase = .ready
    do {
      var components = URLComponents(string: "\(apiUrl)/api/social-preview")
      components?.queryItems = [URLQueryItem(name: "url", value: url)]
      guard let endpoint = components?.url else { throw URLError(.badURL) }
      var request = URLRequest(url: endpoint)
      request.timeoutInterval = 12
      let (data, response) = try await URLSession.shared.data(for: request)
      guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
      struct Body: Decodable { let preview: Preview }
      let body = try JSONDecoder().decode(Body.self, from: data)
      preview = body.preview
      place = body.preview.places.first
    } catch {
      previewFailed = true
    }
  }

  func save() {
    guard let link, let defaults else { return }
    var inbox: [[String: Any]] = []
    if let stored = defaults.string(forKey: inboxKey), let data = stored.data(using: .utf8),
       let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] { inbox = parsed }
    var entry: [String: Any] = ["id": UUID().uuidString, "url": preview?.url ?? link, "savedAt": ISO8601DateFormatter().string(from: Date())]
    if let trip { entry["tripId"] = trip.id } else if newTrip { entry["newTrip"] = true }
    if let preview {
      entry["provider"] = preview.provider; entry["title"] = preview.title; entry["author"] = preview.author
      entry["handle"] = preview.handle; entry["image"] = preview.image
      entry["places"] = preview.places.map(Self.dictionary)
    } else if let sharedText, sharedText != link {
      entry["title"] = sharedText
    }
    if let place { entry["place"] = Self.dictionary(place) }
    inbox.append(entry)
    if let data = try? JSONSerialization.data(withJSONObject: inbox), let json = String(data: data, encoding: .utf8) {
      defaults.set(json, forKey: inboxKey)
    }
    if let trip { defaults.set(trip.id, forKey: lastTripKey) }
    phase = .saved(trip.map { "Saved to \($0.name)" } ?? (newTrip ? "Saved. Open Elsewhere to pick the trip's destination." : "Saved to Elsewhere"))
    Task { try? await Task.sleep(nanoseconds: 900_000_000); context?.completeRequest(returningItems: nil) }
  }

  func cancel() { context?.cancelRequest(withError: NSError(domain: "app.elsewhere.share", code: 0)) }

  private static func dictionary(_ place: PlaceChoice) -> [String: String] {
    var value = ["placeId": place.placeId, "name": place.name]
    if let detail = place.detail { value["detail"] = detail }
    return value
  }

  private func readShared() async -> (url: String?, text: String?) {
    var url: String?
    var text: String?
    let items = context?.inputItems as? [NSExtensionItem] ?? []
    for item in items {
      if text == nil, let content = item.attributedContentText?.string, !content.isEmpty { text = content }
      for provider in item.attachments ?? [] {
        if url == nil, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
           let value = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
          url = value.absoluteString
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
           let value = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
          if url == nil { url = Self.firstLink(in: value) }
          if text == nil { text = value }
        }
      }
    }
    return (url, text == url ? nil : text)
  }

  private static func firstLink(in text: String) -> String? {
    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
    return detector?.firstMatch(in: text, options: [], range: NSRange(text.startIndex..., in: text))?.url?.absoluteString
  }
}

// MARK: - Look (values from src/lib/theme.ts)

enum Palette {
  static let ink = Color(hex: 0x242424), title = Color(hex: 0x313541), muted = Color(hex: 0x666666), meta = Color(hex: 0x7D8290)
  static let action = Color(hex: 0xC34E1F), accent = Color(hex: 0xF36B32), accentPressed = Color(hex: 0xBA4C1B)
  static let tint = Color(hex: 0xFFF2EB), tintLine = Color(hex: 0xFFD9BE), line = Color(hex: 0xECECEC), soft = Color(hex: 0xF5F6F8)
  static let label = Color(hex: 0x5D6270), success = Color(hex: 0x19765E)
}

enum Fonts {
  private static var names: [String: String] = [:]
  static func register() {
    guard names.isEmpty else { return }
    for url in Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: nil) ?? [] {
      CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
      if let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
         let name = descriptors.first.flatMap({ CTFontDescriptorCopyAttribute($0, kCTFontNameAttribute) as? String }) {
        names[url.deletingPathExtension().lastPathComponent] = name
      }
    }
  }
  static func dm(_ weight: String, _ size: CGFloat) -> Font {
    if let name = names["DMSans_\(weight)"] { return .custom(name, fixedSize: size) }
    return .system(size: size)
  }

  // Text in DM Sans with emoji drawn in the system font: fonts registered by
  // the extension don't fall back to Apple Color Emoji on their own.
  static func text(_ string: String, _ weight: String, _ size: CGFloat) -> Text {
    var result = Text(""), run = "", runIsEmoji = false
    func flush() {
      guard !run.isEmpty else { return }
      result = result + Text(run).font(runIsEmoji ? .system(size: size) : dm(weight, size))
      run = ""
    }
    for character in string {
      let emoji = character.unicodeScalars.contains { $0.properties.isEmojiPresentation || ($0.properties.isEmoji && $0.value > 0x238C) }
      if emoji != runIsEmoji { flush(); runIsEmoji = emoji }
      run.append(character)
    }
    flush()
    return result
  }
}

extension Color {
  init(hex: UInt32) { self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255) }
}

// MARK: - Screen

struct ShareSheet: View {
  @ObservedObject var model: ShareModel
  // iOS always shows a share extension as a full-height sheet, so the title
  // stays at the top and everything else sits at the bottom, within thumb
  // reach. Taller content scrolls.
  var body: some View {
    VStack(spacing: 0) {
      header
      GeometryReader { space in
        ScrollView {
          VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 0)
            switch model.phase {
            case .loading: ProgressView().frame(maxWidth: .infinity, minHeight: 160)
            case .failed(let message): Text(message).font(Fonts.dm("400Regular", 15)).foregroundColor(Palette.muted).padding(16).frame(maxWidth: .infinity, minHeight: 120)
            case .ready: form
            case .saved(let message): saved(message)
            }
          }
          .padding(.bottom, 8)
          .frame(minHeight: space.size.height, alignment: .bottom)
        }
        .scrollBounceBehavior(.basedOnSize)
      }
    }
    .background(Color.white.ignoresSafeArea())
  }

  private var header: some View {
    HStack(spacing: 16) {
      Text("Save to Elsewhere").font(Fonts.dm("600SemiBold", 20)).foregroundColor(Color(hex: 0x252525)).tracking(-0.5)
      Spacer()
      Button(action: model.cancel) {
        Image(systemName: "xmark").font(.system(size: 14, weight: .semibold)).foregroundColor(Color(hex: 0x555555))
          .frame(width: 44, height: 44).background(Palette.soft).clipShape(Circle())
      }.accessibilityLabel("Close")
    }
    .padding(.horizontal, 16).padding(.top, 16)
  }

  private var form: some View {
    VStack(alignment: .leading, spacing: 18) {
      previewCard
      if let places = model.preview?.places, !places.isEmpty {
        VStack(alignment: .leading, spacing: 8) {
          Text("Place").font(Fonts.dm("600SemiBold", 14)).foregroundColor(Palette.label)
          ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) { ForEach(places, id: \.self) { place in chip(place) } }
          }
        }
      }
      VStack(alignment: .leading, spacing: 8) {
        Text("Trip").font(Fonts.dm("600SemiBold", 14)).foregroundColor(Palette.label)
        tripPicker
      }
      Button(action: model.save) {
        Text("Save idea").font(Fonts.dm("600SemiBold", 16)).foregroundColor(.white)
          .frame(maxWidth: .infinity, minHeight: 50)
          .background(Palette.accent)
          .clipShape(RoundedRectangle(cornerRadius: 14.3, style: .continuous))
      }
    }
    .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 24)
  }

  private var previewCard: some View {
    HStack(alignment: .top, spacing: 12) {
      ZStack(alignment: .bottomLeading) {
        Palette.tint
        Group {
          if let image = model.preview?.image, let url = URL(string: image), !image.isEmpty {
            AsyncImage(url: url) { phase in
              if let picture = phase.image { picture.resizable().scaledToFill() } else { ProgressView() }
            }
          } else if model.preview == nil && !model.previewFailed {
            ProgressView()
          } else {
            Image(systemName: "play.rectangle").font(.system(size: 26)).foregroundColor(Palette.action)
          }
        }
        .frame(width: 84, height: 112).clipped()
        Text(model.providerName).font(Fonts.dm("600SemiBold", 10)).foregroundColor(.white)
          .padding(.horizontal, 6).padding(.vertical, 2).background(Color(hex: 0x20201F).opacity(0.72))
          .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous)).padding(6)
      }
      .frame(width: 84, height: 112).clipShape(RoundedRectangle(cornerRadius: 10.4, style: .continuous))
      VStack(alignment: .leading, spacing: 4) {
        Fonts.text(captionText, "700Bold", 16).foregroundColor(Palette.title).lineLimit(3)
        if let creator = creatorText { Text(creator).font(Fonts.dm("400Regular", 13)).foregroundColor(Palette.meta).lineLimit(1) }
        if model.previewFailed { Text("No preview right now. The link is saved as it is.").font(Fonts.dm("400Regular", 12)).foregroundColor(Palette.muted) }
      }
      Spacer(minLength: 0)
    }
  }

  private var captionText: String {
    let caption = model.preview?.title.split(separator: "\n")
      .map { $0.replacingOccurrences(of: "#[\\p{L}\\p{N}_]+", with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces) }
      .first { !$0.isEmpty }
    if let caption { return caption }
    if model.preview == nil && !model.previewFailed { return "Loading preview…" }
    return "\(model.providerName) link"
  }

  private var creatorText: String? {
    guard let preview = model.preview else { return nil }
    let parts = [preview.author, preview.handle].filter { !$0.isEmpty }
    return parts.isEmpty ? nil : parts.joined(separator: " · ")
  }

  private func chip(_ place: PlaceChoice) -> some View {
    let selected = model.place == place
    return Button { model.place = selected ? nil : place } label: {
      HStack(spacing: 5) {
        Image(systemName: selected ? "mappin.circle.fill" : "mappin").font(.system(size: 13, weight: .semibold))
        Text(place.name).font(Fonts.dm("500Medium", 14)).lineLimit(1)
      }
      .foregroundColor(selected ? Palette.action : Palette.ink)
      .padding(.horizontal, 12).frame(minHeight: 40)
      .background(selected ? Palette.tint : Color.white)
      .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).stroke(selected ? Palette.tintLine : Palette.line, lineWidth: 1))
      .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
    .accessibilityAddTraits(selected ? .isSelected : [])
  }

  private var tripPicker: some View {
    Menu {
      ForEach(model.trips, id: \.self) { trip in
        Button { model.trip = trip; model.newTrip = false } label: { Text(trip.dates.isEmpty ? trip.name : "\(trip.name) · \(trip.dates)") }
      }
      Button { model.trip = nil; model.newTrip = true } label: { Label("New trip", systemImage: "plus") }
      Button { model.trip = nil; model.newTrip = false } label: { Text("Decide later") }
    } label: {
      HStack(spacing: 10) {
        Image(systemName: "suitcase").font(.system(size: 16)).foregroundColor(Palette.action)
        VStack(alignment: .leading, spacing: 2) {
          Text(model.trip?.name ?? (model.newTrip ? "New trip" : "Decide later")).font(Fonts.dm("600SemiBold", 16)).foregroundColor(Palette.ink).lineLimit(1)
          Text(model.trip.map { $0.dates.isEmpty ? "Ideas tab" : $0.dates } ?? (model.newTrip ? "Pick the destination in Elsewhere" : model.trips.isEmpty ? "Open Elsewhere once to choose a trip here" : "Add it to a trip in the app"))
            .font(Fonts.dm("400Regular", 13)).foregroundColor(Palette.muted).lineLimit(1)
        }
        Spacer()
        Image(systemName: "chevron.up.chevron.down").font(.system(size: 13, weight: .semibold)).foregroundColor(Palette.meta)
      }
      .padding(.horizontal, 12).frame(minHeight: 56)
      .overlay(RoundedRectangle(cornerRadius: 14.3, style: .continuous).stroke(Palette.line, lineWidth: 1))
    }
  }

  private func saved(_ message: String) -> some View {
    VStack(spacing: 10) {
      Image(systemName: "checkmark.circle.fill").font(.system(size: 40)).foregroundColor(Palette.success)
      Text(message).font(Fonts.dm("600SemiBold", 17)).foregroundColor(Palette.ink).multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, minHeight: 160).padding(.bottom, 24)
  }
}
