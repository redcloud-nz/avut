/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import { ReactNode } from "react";

import { CommonProviders } from "@/components/providers";

export default function AuthenticatedLayout(props: {
    modal: ReactNode;
    children: ReactNode;
}) {
    return (
        <CommonProviders>
            {props.modal}
            {props.children}
        </CommonProviders>
    );
}
