import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/components/planner/planner.css";
import "@/components/planner/minimal.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/components/planner/destination.css";

export const metadata: Metadata = {
  title: "TripPilot — Your whole trip, together",
  description: "Keep every part of your trip in one place.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
