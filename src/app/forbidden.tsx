/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import { AppErrorPanel } from "@/components/errors/app-error";
import { ErrorDescriptions } from "@/components/errors/describe-error";

export default function Root_Forbidden() {
    return <AppErrorPanel {...ErrorDescriptions.Forbidden} />;
}
