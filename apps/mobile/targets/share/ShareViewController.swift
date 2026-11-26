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
// src/lib/share-inbox.tsx. Fonts are the app's Bricolage Grotesque, Instrument
// Serif and Inter, bundled in this folder (licenses in Fonts-OFL.txt).

private let appGroup = "group.app.elsewhere.mobile"
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
  // The redesign (src/lib/design.ts).
  static let ink = Color(hex: 0x1A1033), cream = Color(hex: 0xFFF6E9), muted = Color(hex: 0x5B4F73), lilac = Color(hex: 0xCFC7E6)
  static let yellow = Color(hex: 0xFFE14D), pink = Color(hex: 0xFF3D8B), orange = Color(hex: 0xFF7A1A), violet = Color(hex: 0x3B2BFF), cover = Color(hex: 0x2A2140)
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
  private static func named(_ file: String, _ size: CGFloat, fallback: Font.Weight) -> Font {
    if let name = names[file] { return .custom(name, fixedSize: size) }
    return .system(size: size, weight: fallback)
  }
  static func display(_ size: CGFloat) -> Font { named("BricolageGrotesque_800ExtraBold", size, fallback: .heavy) }
  static func serif(_ size: CGFloat) -> Font { named("InstrumentSerif_400Regular_Italic", size, fallback: .regular) }
  // weight: "500Medium", "600SemiBold", "700Bold" or "800ExtraBold".
  static func inter(_ weight: String, _ size: CGFloat) -> Font { named("Inter_\(weight)", size, fallback: .semibold) }

  // Text in Inter with emoji drawn in the system font: fonts registered by
  // the extension don't fall back to Apple Color Emoji on their own.
  static func text(_ string: String, _ weight: String, _ size: CGFloat) -> Text {
    var result = Text(""), run = "", runIsEmoji = false
    func flush() {
      guard !run.isEmpty else { return }
      result = result + Text(run).font(runIsEmoji ? .system(size: size) : inter(weight, size))
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

// Chips that wrap onto as many lines as they need.
struct Flow: Layout {
  var spacing: CGFloat = 8
  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    rows(proposal.width ?? .infinity, subviews).last.map { CGSize(width: proposal.width ?? $0.width, height: $0.y + $0.height) } ?? .zero
  }
  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    var x = bounds.minX, y = bounds.minY, line: CGFloat = 0
    for view in subviews {
      let size = view.sizeThatFits(.unspecified)
      if x > bounds.minX && x + size.width > bounds.maxX { x = bounds.minX; y += line + spacing; line = 0 }
      view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: min(size.width, bounds.width), height: size.height))
      x += size.width + spacing; line = max(line, size.height)
    }
  }
  private func rows(_ width: CGFloat, _ subviews: Subviews) -> [(width: CGFloat, y: CGFloat, height: CGFloat)] {
    var result: [(width: CGFloat, y: CGFloat, height: CGFloat)] = [], x: CGFloat = 0, y: CGFloat = 0, line: CGFloat = 0
    for view in subviews {
      let size = view.sizeThatFits(.unspecified)
      if x > 0 && x + size.width > width { y += line + spacing; x = 0; line = 0 }
      x += size.width + spacing; line = max(line, size.height)
      result.append((width: x, y: y, height: line))
    }
    return result
  }
}

// MARK: - Screen

struct ShareSheet: View {
  @ObservedObject var model: ShareModel
  // iOS always shows a share extension as a full-height sheet, so the title
  // stays at the top and everything else sits at the bottom, within thumb
  // reach. Taller content scrolls. The screen is ink with two suns in the
  // corner, like the redesign's share screen.
  var body: some View {
    ZStack(alignment: .topTrailing) {
      Palette.ink.ignoresSafeArea()
      Circle().fill(Palette.violet).frame(width: 240, height: 240).offset(x: 90, y: -90).accessibilityHidden(true)
      Circle().fill(Palette.orange).frame(width: 70, height: 70).offset(x: -40, y: 40).accessibilityHidden(true)
      VStack(spacing: 0) {
        header
        GeometryReader { space in
          ScrollView {
            VStack(alignment: .leading, spacing: 0) {
              switch model.phase {
              case .loading: ProgressView().tint(.white).frame(maxWidth: .infinity, minHeight: 160)
              case .failed(let message): Text(message).font(Fonts.inter("600SemiBold", 15)).foregroundColor(Palette.lilac).padding(20).frame(maxWidth: .infinity, minHeight: 120)
              case .ready: form(minHeight: space.size.height)
              case .saved(let message): saved(message).frame(minHeight: space.size.height)
              }
            }
          }
          .scrollBounceBehavior(.basedOnSize)
        }
      }
    }
  }

  private var header: some View {
    HStack {
      Button("Cancel", action: model.cancel).font(Fonts.inter("600SemiBold", 16)).foregroundColor(.white).frame(minWidth: 56, minHeight: 44, alignment: .leading)
      Spacer()
      Text("elsewhere").font(Fonts.display(20)).tracking(-0.5).foregroundColor(.white).accessibilityAddTraits(.isHeader)
      Spacer()
      Color.clear.frame(width: 56, height: 44)
    }
    .padding(.horizontal, 20).padding(.top, 12)
  }

  private func form(minHeight: CGFloat) -> some View {
    VStack(alignment: .leading, spacing: 20) {
      (Text("Ooh, ").font(Fonts.display(44)) + Text("good find.").font(Fonts.serif(48)).foregroundColor(Palette.pink))
        .foregroundColor(.white).tracking(-1.5).lineSpacing(-4).accessibilityAddTraits(.isHeader)
      previewCard
      if let places = model.preview?.places, !places.isEmpty {
        section("SPOTTED IN THIS VIDEO") { ForEach(places, id: \.self) { place in placeChip(place) } }
      }
      section("SAVE TO") {
        ForEach(model.trips, id: \.self) { trip in
          tripChip(trip.dates.isEmpty ? trip.name : "\(trip.name) · \(trip.dates)", selected: model.trip == trip) { model.trip = trip; model.newTrip = false }
        }
        tripChip("+ New trip", selected: model.newTrip, dashed: true) { model.trip = nil; model.newTrip = true }
        tripChip("Decide later", selected: model.trip == nil && !model.newTrip) { model.trip = nil; model.newTrip = false }
      }
      if model.trips.isEmpty {
        Text("Open Elsewhere once to choose a trip here.").font(Fonts.inter("500Medium", 13)).foregroundColor(Palette.lilac)
      }
      Spacer(minLength: 8)
      Button(action: model.save) {
        Text(saveLabel).font(Fonts.display(20)).foregroundColor(Palette.ink).lineLimit(1).minimumScaleFactor(0.7)
          .frame(maxWidth: .infinity, minHeight: 62).padding(.horizontal, 16)
          .background(Palette.orange).clipShape(Capsule())
          .overlay(Capsule().stroke(.white, lineWidth: 2.5))
          .padding(4).overlay(Capsule().stroke(Palette.orange, lineWidth: 2))
      }
    }
    .padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 24)
    .frame(minHeight: minHeight, alignment: .top)
  }

  private var saveLabel: String {
    if let trip = model.trip { return "Save to \(trip.name) ✦" }
    return model.newTrip ? "Save and start a trip ✦" : "Save for later ✦"
  }

  private func section<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(title).font(Fonts.inter("800ExtraBold", 13)).tracking(0.8).foregroundColor(Palette.yellow).accessibilityAddTraits(.isHeader)
      Flow { content() }
    }
  }

  private var previewCard: some View {
    HStack(alignment: .center, spacing: 14) {
      Group {
        if let image = model.preview?.image, let url = URL(string: image), !image.isEmpty {
          AsyncImage(url: url) { phase in
            if let picture = phase.image { picture.resizable().scaledToFill() } else { ProgressView().tint(.white) }
          }
        } else if model.preview == nil && !model.previewFailed {
          ProgressView().tint(.white)
        } else {
          Image(systemName: "play.fill").font(.system(size: 22)).foregroundColor(.white.opacity(0.8))
        }
      }
      .frame(width: 72, height: 96).background(Palette.cover).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
      .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 6) {
        Text(model.providerName).font(Fonts.inter("700Bold", 11)).foregroundColor(.white)
          .padding(.horizontal, 9).padding(.vertical, 3).background(Palette.ink).clipShape(Capsule())
        Fonts.text(captionText, "700Bold", 15).foregroundColor(Palette.ink).lineLimit(3)
        if let creator = creatorText { Text(creator).font(Fonts.inter("600SemiBold", 12)).foregroundColor(Palette.muted).lineLimit(1) }
        if model.previewFailed { Text("No preview right now. The link is saved as it is.").font(Fonts.inter("500Medium", 12)).foregroundColor(Palette.muted) }
      }
      Spacer(minLength: 0)
    }
    .padding(12).background(Color.white).clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
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

  // A place the caption names: pink when chosen.
  private func placeChip(_ place: PlaceChoice) -> some View {
    let selected = model.place == place
    return Button { model.place = selected ? nil : place } label: {
      Text(selected ? "✓ \(place.name)" : place.name).font(Fonts.inter(selected ? "800ExtraBold" : "700Bold", 14)).lineLimit(1)
        .foregroundColor(selected ? Palette.ink : .white)
        .padding(.horizontal, 16).frame(minHeight: 44)
        .background(selected ? Palette.pink : Color.clear).clipShape(Capsule())
        .overlay(Capsule().stroke(selected ? Palette.pink : .white, lineWidth: 2))
    }
    .accessibilityAddTraits(selected ? .isSelected : [])
  }

  // A trip to save to: yellow when chosen; "New trip" is dashed.
  private func tripChip(_ label: String, selected: Bool, dashed: Bool = false, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(label).font(Fonts.inter(selected ? "800ExtraBold" : "700Bold", 15)).lineLimit(1)
        .foregroundColor(selected ? Palette.ink : .white)
        .padding(.horizontal, 18).frame(minHeight: 48)
        .background(selected ? Palette.yellow : Color.clear).clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(selected ? Palette.yellow : .white, style: StrokeStyle(lineWidth: 2, dash: dashed && !selected ? [6, 4] : [])))
    }
    .accessibilityAddTraits(selected ? .isSelected : [])
  }

  private func saved(_ message: String) -> some View {
    VStack(spacing: 14) {
      Image(systemName: "checkmark.circle.fill").font(.system(size: 48)).foregroundColor(Palette.yellow)
      Text(message).font(Fonts.display(26)).foregroundColor(.white).multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity).padding(24)
  }
}
