/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export interface D4HTeamRef {
    id: number;
    resourceType: "Team";
    title: string;
    owner?: {
        id: number;
        resourceType: string;
    };
}
