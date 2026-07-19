import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "野人先生 AI 设备维修协同中枢",
  description: "门店、维修管理与责任方协同的本地可运行 Demo V1。全部业务数据均为模拟。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
