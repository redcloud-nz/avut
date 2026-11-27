/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /forms/[slug]/d4h-i3-self-audit/demo   ([slug] is ignored: the demo is sample data)
 */

import type { Metadata } from "next";

import { SelfAudit_Demo } from "@/components/self-audit/self-audit-demo";

export const metadata: Metadata = {
    title: "Issued Equipment Self-Audit (demo)",
    robots: { index: false, follow: false },
};

/** A public, no-login demo of the self-audit member form, over made-up data. */
export default function SelfAuditDemo_Page() {
    return <SelfAudit_Demo />;
}
