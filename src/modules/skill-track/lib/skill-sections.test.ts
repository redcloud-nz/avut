/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { groupSkillSections, skillSectionLabel } from "./skill-sections";

describe("skillSectionLabel", () => {
    it("combines the package and group names", () => {
        expect(skillSectionLabel({ name: "Rope Rescue" }, { name: "Anchors" })).toBe(
            "Rope Rescue · Anchors",
        );
    });

    it("drops a group name that repeats the package's, ignoring case and spacing", () => {
        expect(skillSectionLabel({ name: "Rope Rescue" }, { name: " rope rescue " })).toBe(
            "Rope Rescue",
        );
    });
});

describe("groupSkillSections", () => {
    const skillPackages = [
        { id: "p2", name: "Water" },
        { id: "p1", name: "Rope" },
    ];
    const skillGroups = [
        { id: "g2", name: "Hauling", skillPackageId: "p1", sequence: 2 },
        { id: "g1", name: "Anchors", skillPackageId: "p1", sequence: 1 },
        { id: "g3", name: "Water", skillPackageId: "p2", sequence: 1 },
        { id: "g4", name: "Empty", skillPackageId: "p2", sequence: 2 },
    ];

    it("orders packages by name and groups by sequence, keeping item order and dropping empty groups", () => {
        const items = [
            { name: "Throw bag", groupId: "g3" },
            { name: "Z-rig", groupId: "g2" },
            { name: "Bolt", groupId: "g1" },
            { name: "Sling", groupId: "g1" },
            { name: "Orphan", groupId: "gone" },
        ];

        const sections = groupSkillSections({
            skillPackages,
            skillGroups,
            items,
            skillGroupIdOf: (item) => item.groupId,
        });

        expect(
            sections.map((section) => [section.label, section.items.map((item) => item.name)]),
        ).toEqual([
            ["Rope · Anchors", ["Bolt", "Sling"]],
            ["Rope · Hauling", ["Z-rig"]],
            ["Water", ["Throw bag"]],
        ]);
    });
});
