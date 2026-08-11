/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import { ReactNode } from "react";

import { requireSession } from "@/server/session";

export default async function AuthenticatedLayout(props: {
    modal: ReactNode;
    children: ReactNode;
}) {
    // Baseline guard for every authenticated route. The proxy only checks that a session
    // cookie is *present*; this is the check that actually validates it.
    await requireSession();

    return (
        <>
            {props.modal}
            {props.children}
        </>
    );
}
