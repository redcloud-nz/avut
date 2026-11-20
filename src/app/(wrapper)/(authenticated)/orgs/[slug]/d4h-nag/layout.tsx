/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-nag
 */

import { D4HNag_ModuleGate } from "@/modules/d4h-nag/components/d4h-nag-module-gate";

export default function D4HNag_Layout(props: LayoutProps<"/orgs/[slug]/d4h-nag">) {
    return <D4HNag_ModuleGate>{props.children}</D4HNag_ModuleGate>;
}
