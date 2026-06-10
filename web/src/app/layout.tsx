import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PersonaMask 콘솔",
  description: "업로드 영상 리뷰와 디퓨전 대체 리댁션을 위한 PersonaMask 웹 콘솔입니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
