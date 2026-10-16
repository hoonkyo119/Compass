import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Compass | 오늘의 기록, 내일의 방향",
  description: "수입과 지출부터 자산과 대출까지, 나의 재무 나침반 Compass",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
