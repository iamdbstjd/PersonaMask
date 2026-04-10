import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Realtime Operator Console",
  description: "Frontend app shell skeleton for Character, Privacy, Video, and Settings workflows.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          backgroundColor: "#f8fafc",
          color: "#111827",
        }}
      >
        {children}
      </body>
    </html>
  );
}
