import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OpenVideo Studio", template: "%s · OpenVideo Studio" },
  description: "Create professional narrated and captioned videos from a script.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
