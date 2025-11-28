/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Collapsible as CollapsiblePrimitive } from "radix-ui";

export type CollapsibleProps = CollapsiblePrimitive.CollapsibleProps &
    React.RefAttributes<HTMLDivElement>;

export const Collapsible = CollapsiblePrimitive.Root;

export const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

export const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;
