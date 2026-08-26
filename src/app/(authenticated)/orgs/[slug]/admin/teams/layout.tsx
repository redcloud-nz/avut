/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/teams
 *
 * Adds the `@modal` parallel slot so `--create` can be intercepted and rendered as an
 * overlay on top of whichever page is already mounted under this segment (the list, or a
 * team detail page), instead of navigating to a new page.
 */

import { ReactNode } from "react";

export default function TeamsLayout(props: { modal: ReactNode; children: ReactNode }) {
    return (
        <>
            {props.modal}
            {props.children}
        </>
    );
}
