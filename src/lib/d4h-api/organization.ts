/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { D4HResource } from "./resource";

export interface D4HOrganizationRef extends D4HResource<"Organization"> {
    title: string;
}

export interface D4HOrganization extends D4HResource<"Organization"> {
    title: string;

    country: string;
    createdAt: string;
    createdById: number;
    currency: string;
    timezone: string;
    updatedAt: string;
}
