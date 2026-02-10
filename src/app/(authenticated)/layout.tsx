/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import { CommonProviders } from "@/components/providers";

export default function AuthenticatedLayout(props: LayoutProps<"/">) {
    return <CommonProviders>{props.children}</CommonProviders>;
}
