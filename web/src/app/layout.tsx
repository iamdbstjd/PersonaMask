import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PersonaMask 콘솔",
  description: "FastAPI 백엔드와 연결된 캐릭터 마스크 및 프라이버시 리댁션 웹 콘솔입니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
