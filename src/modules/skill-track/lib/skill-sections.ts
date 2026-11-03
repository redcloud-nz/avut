/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";

/**
 * The heading for a skill group's section: "Package · Group", or just "Package" when the group
 * repeats the package's name (the usual shape of a flat package with a single group).
 */
export function skillSectionLabel(
    skillPackage: { name: string },
    skillGroup: { name: string },
): string {
    const packageName = skillPackage.name.trim();
    const groupName = skillGroup.name.trim();
    return packageName.toLowerCase() === groupName.toLowerCase()
        ? packageName
        : `${packageName} · ${groupName}`;
}

/**
 * Sorts `items` into one flat section per skill group: packages by name, groups by sequence.
 * Items keep their input order within a section, and empty sections are dropped. Items whose
 * group isn't among `skillGroups` are left out; the caller lists those separately.
 */
export function groupSkillSections<
    G extends { id: string; name: string; skillPackageId: string; sequence: number },
    T,
>({
    skillPackages,
    skillGroups,
    items,
    skillGroupIdOf,
}: {
    skillPackages: readonly { id: string; name: string }[];
    skillGroups: readonly G[];
    items: readonly T[];
    skillGroupIdOf: (item: NoInfer<T>) => string | undefined;
}): { id: G["id"]; label: string; items: T[] }[] {
    return R.pipe(
        skillPackages,
        R.sortBy((skillPackage) => skillPackage.name),
        R.flatMap((skillPackage) =>
            R.pipe(
                skillGroups,
                R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
                R.sortBy((skillGroup) => skillGroup.sequence),
                R.map((skillGroup) => ({
                    id: skillGroup.id,
                    label: skillSectionLabel(skillPackage, skillGroup),
                    items: items.filter((item) => skillGroupIdOf(item) === skillGroup.id),
                })),
                R.filter((section) => section.items.length > 0),
            ),
        ),
    );
}
