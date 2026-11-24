/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /forms/chch-soft-shell-jacket
 */

import type { Metadata } from "next";

import { JacketInterest_Form } from "@/components/forms/jacket-interest-form";

export const metadata: Metadata = {
    title: "Soft shell jacket",
    robots: { index: false, follow: false },
};

/**
 * The Christchurch teams' soft shell jacket interest form, open to anyone with the link. Each
 * answer is stored for the chch-cdem admins (`publicForms`).
 */
export default function ChchSoftShellJacket_Page() {
    return <JacketInterest_Form />;
}
