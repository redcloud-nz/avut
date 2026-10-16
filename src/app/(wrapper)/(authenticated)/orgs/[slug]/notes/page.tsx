/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/notes
 */

import { Hermes } from "@/components/blocks/hermes";

export const metadata = {
    title: "Notes",
};

export default function Notes_Index_Page() {
    return <Hermes.Placeholder>Select a note, or create a new one.</Hermes.Placeholder>;
}
