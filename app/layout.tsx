import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadence · Dialogue Pacing Lab",
  description: "A local-first experiment in cinematic dialogue timing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
