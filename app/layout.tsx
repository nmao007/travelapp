import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripPilot — Make room for the good parts",
  description: "Keep every part of your trip in one place.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
