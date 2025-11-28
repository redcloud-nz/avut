/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import type { Metadata } from "next";
import localFont from "next/font/local";
import { Jersey_10 } from "next/font/google";

import "./globals.css";

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
    applicationName: "RT+",
    title: {
        template: "%s | RT+",
        default: "RT+",
    },
    description: "RT+ App",
};

export default async function Root_Layout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.className} ${geistSans.variable} ${geistMono.variable} ${jersey10.variable} antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
