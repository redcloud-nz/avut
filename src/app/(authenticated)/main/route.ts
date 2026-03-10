/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/
 */

import { redirect } from "next/navigation";

export async function GET() {
    redirect("/main/--select-org");
}
