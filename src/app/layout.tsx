/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Jersey_10, Inter } from "next/font/google";

import { RootProviders } from "@/components/providers/root-providers";
import { cn } from "@/lib/utils";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = localFont({
    src: "./fonts/GeistVF.woff",
    variable: "--font-geist-sans",
    weight: "100 900",
});
const geistMono = localFont({
    src: "./fonts/GeistMonoVF.woff",
    variable: "--font-geist-mono",
    weight: "100 900",
});

const jersey10 = Jersey_10({
    subsets: ["latin"],
    variable: "--font-jersey-10",
    weight: ["400"],
});

export const metadata: Metadata = {
    applicationName: "AVUT",
    title: {
        template: "%s | AVUT",
        default: "AVUT",
    },
    description: "Assorted Vaguely Useful Tools",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    // Without this, Chrome on Android only shrinks the visual viewport when the
    // on-screen keyboard opens — the layout viewport (and `dvh` units) stay full-height,
    // so fixed-position dialogs centered on 100dvh can end up with their lower fields
    // behind the keyboard. "resizes-content" makes the layout viewport shrink too.
    interactiveWidget: "resizes-content",
};

export default function Root_Layout(props: LayoutProps<"/">) {
    return (
        <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
            <body
                className={`${geistSans.className} ${geistSans.variable} ${geistMono.variable} ${jersey10.variable} antialiased`}
            >
                <RootProviders>{props.children}</RootProviders>
            </body>
        </html>
    );
}
