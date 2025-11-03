import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export const metadata: Metadata = {
  title: "Encrypted Lucky Draw",
  description: "Transparent FHE-powered raffle where players verify results privately.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-transparent text-slate-900 antialiased">
        <Providers>
          <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-16 pt-10">
            <div className="absolute inset-0 -z-10 app-gradient rounded-[48px] blur-3xl opacity-70" />
            <nav className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white/80 px-6 py-4 shadow-lg backdrop-blur-xl">
              <Link href="/" className="flex items-center gap-4">
                <Image
                  src="/lucky-draw-logo.svg"
                  alt="Encrypted Lucky Draw logo"
                  width={48}
                  height={48}
                  priority
                />
                <span className="text-lg font-semibold tracking-tight text-slate-900">
                  Encrypted Lucky Draw
                </span>
              </Link>
              <ConnectButton
                accountStatus={{
                  smallScreen: "avatar",
                  largeScreen: "full",
                }}
                chainStatus="icon"
                showBalance={false}
              />
            </nav>
            <main className="mt-10 flex flex-1 flex-col gap-10">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
