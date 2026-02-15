/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { D4HResource } from "./resource";

export interface D4HTeamRef extends D4HResource<"Team"> {
    title: string;
}

export interface D4HTeam extends D4HResource<"Team"> {
    title: string;
    owner?: D4HResource<"Organization">;
}
