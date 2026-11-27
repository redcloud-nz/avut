/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { format } from "date-fns";

import { TZDate } from "@date-fns/tz";

/**
 * A self audit campaign's name when none is given: `<bundle name> <Mon YYYY>`, the month in
 * `timeZone` (the organization's). `createCampaign` names a campaign with it; the create dialog
 * shows it as the name field's placeholder.
 */
export function defaultCampaignName(bundleName: string, timeZone: string, now = new Date()) {
    return `${bundleName} ${format(new TZDate(now, timeZone), "MMM yyyy")}`;
}
