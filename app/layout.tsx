import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "PostPulse — Facebook Post Metrics",
    description:
      "Understand Facebook post reach, views, reactions, comments, shares, and clicks in one clean analytics dashboard.",
    openGraph: {
      title: "PostPulse — Facebook Post Metrics",
      description:
        "A clear, private workspace for comparing Facebook post performance.",
      type: "website",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "PostPulse Facebook post metrics dashboard",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "PostPulse — Facebook Post Metrics",
      description:
        "A clear, private workspace for comparing Facebook post performance.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
