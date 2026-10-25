/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Badge } from "@/components/ui/badge";

/**
 * Marks an equipment item that has been returned: it has an open Retire task waiting to be
 * applied in D4H (`d4hTasks.listReturnedItemIds`). Not tied to the item's D4H status, so an item
 * set Non Operational for repair isn't mistaken for a return.
 */
export function D4HI3Module_ReturnedBadge() {
    return <Badge variant="secondary">Returned</Badge>;
}
