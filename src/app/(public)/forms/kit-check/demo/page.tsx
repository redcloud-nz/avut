/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /forms/kit-check/demo
 */

import type { Metadata } from "next";

import { KitCheck_Demo } from "@/components/kit-check/kit-check-demo";

export const metadata: Metadata = {
    title: "Issued Equipment Self-Audit (demo)",
    robots: { index: false, follow: false },
};

/** A public, no-login demo of the kit-check member form, over made-up data. */
export default function KitCheckDemo_Page() {
    return <KitCheck_Demo />;
}
