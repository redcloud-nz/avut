/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export interface D4HEquipmentItem {
    id: number;
    ref: string;
    owner: {
        resourceType: "Team";
        id: number;
    };
    category: {
        resourceType: "EquipmentCategory";
        id: number;
    };
    kind: {
        resourceType: "EquipmentKind";
        id: number;

        // More kind fields
    };
    model: {
        resourceType: "EquipmentModel";
        id: number;
    };
}
