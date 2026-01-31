/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import { ControlBar } from "@/components/nav/control-bar";
import { Providers } from "./providers";

export default function AuthenticatedLayout(props: LayoutProps<"/">) {
    return <Providers>{props.children}</Providers>;
}
