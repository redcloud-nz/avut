/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { TRPCError } from "@trpc/server";

import type {
    Prisma,
    PrismaClient,
    Skill,
    SkillGroup,
    SkillPackage,
} from "@/generated/prisma/client";
import { diffObject } from "@/lib/diff";
import {
    SKILL_PACKAGE_EXPORT_FORMAT_VERSION,
    SkillPackageExport,
    type ExportedGroup,
    type ExportedSkill,
    type SkillPackageExport as SkillPackageExportType,
} from "@/lib/schemas/skill-package-export";

/** Just the tables this module touches. */
type SkillPackagePrisma = Pick<PrismaClient, "skillPackage" | "skillGroup" | "skill">;

/**
 * Build a portable export envelope for a skill-package authoring tree. Pure — the caller
 * supplies the already-loaded records.
 */
export function buildSkillPackageExport(
    pkg: SkillPackage,
    groups: SkillGroup[],
    skills: Skill[],
): SkillPackageExportType {
    const sortedGroups = [...groups].sort((a, b) => a.sequence - b.sequence);
    const skillsByGroup = new Map<string, Skill[]>();
    for (const skill of skills) {
        const list = skillsByGroup.get(skill.skillGroupId) ?? [];
        list.push(skill);
        skillsByGroup.set(skill.skillGroupId, list);
    }

    return SkillPackageExport.schema.parse({
        formatVersion: SKILL_PACKAGE_EXPORT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        package: {
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            tags: pkg.tags,
            properties: pkg.properties,
            groups: sortedGroups.map((group) => ({
                id: group.id,
                name: group.name,
                description: group.description,
                tags: group.tags,
                properties: group.properties,
                sequence: group.sequence,
                defaultInclude: group.defaultInclude,
                skills: [...(skillsByGroup.get(group.id) ?? [])]
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((skill) => ({
                        id: skill.id,
                        name: skill.name,
                        description: skill.description,
                        tags: skill.tags,
                        properties: skill.properties,
                        sequence: skill.sequence,
                        frequency: skill.frequency,
                        defaultInclude: skill.defaultInclude,
                        defaultRequired: skill.defaultRequired,
                    })),
            })),
        },
    });
}

export type ImportAction = "create" | "update" | "archive" | "unchanged";

export interface ImportPlanNode {
    kind: "package" | "group" | "skill";
    id: string;
    name: string;
    action: ImportAction;
}

export interface ImportPlan {
    targetOrganizationId: string;
    /** `"Create"` when the package is new to this instance, else `"Update"`. */
    packageAction: "Create" | "Update";
    package: ImportPlanNode;
    groups: ImportPlanNode[];
    skills: ImportPlanNode[];
    counts: {
        created: number;
        updated: number;
        archived: number;
        unchanged: number;
    };
}

export interface PreparedSkillPackageImport {
    plan: ImportPlan;
    /**
     * The writes for the import, in FK-safe order (package, groups, skills, then archives).
     * Compose into `ctx.prisma.$transaction([...writes, ctx.logEvent({...})])`.
     */
    buildWrites: (prisma: SkillPackagePrisma) => Prisma.PrismaPromise<unknown>[];
}

const GROUP_COMPARE_KEYS = [
    "name",
    "description",
    "tags",
    "properties",
    "sequence",
    "defaultInclude",
] as const;
const SKILL_COMPARE_KEYS = [
    "name",
    "description",
    "tags",
    "properties",
    "sequence",
    "frequency",
    "defaultInclude",
    "defaultRequired",
] as const;

function pick<K extends string>(obj: object, keys: readonly K[]): Record<string, unknown> {
    const rec = obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of keys) out[key] = rec[key];
    return out;
}

/**
 * Validate an import envelope against the target organization and diff it against what is
 * already stored, producing a human-readable plan plus the deferred writes to apply it.
 *
 * Create-or-sync, keyed on stable record IDs:
 * - Package ID absent → create the whole tree.
 * - Package ID present and owned by `targetOrganizationId` → upsert groups/skills by ID and
 *   **archive** (never delete — `SkillCheck.skillId` cascades) any active group/skill under
 *   the package that the file omits.
 * - Package ID owned by a different organization → `CONFLICT`.
 *
 * An imported package always lands `published: false` / `status: Active`.
 *
 * @throws TRPCError(BAD_REQUEST) if the envelope repeats a group or skill ID.
 * @throws TRPCError(CONFLICT) if the package ID belongs to another organization.
 */
export async function prepareSkillPackageImport(
    prisma: SkillPackagePrisma,
    envelope: SkillPackageExportType,
    targetOrganizationId: string,
): Promise<PreparedSkillPackageImport> {
    const { package: incoming } = envelope;

    assertNoDuplicateIds(incoming.groups);

    const existing = await prisma.skillPackage.findUnique({
        where: { id: incoming.id },
        include: { groups: true, skills: true },
    });

    if (existing && existing.organizationId !== targetOrganizationId) {
        throw new TRPCError({
            code: "CONFLICT",
            message: `Skill package ${incoming.id} already exists under a different organization. A package ID belongs to exactly one organization per instance.`,
        });
    }

    const packageAction: "Create" | "Update" = existing ? "Update" : "Create";

    const existingGroups = new Map((existing?.groups ?? []).map((g) => [g.id, g]));
    const existingSkills = new Map((existing?.skills ?? []).map((s) => [s.id, s]));

    const fileGroupIds = new Set<string>();
    const fileSkillIds = new Set<string>();
    const groupNodes: ImportPlanNode[] = [];
    const skillNodes: ImportPlanNode[] = [];

    for (const group of incoming.groups) {
        fileGroupIds.add(group.id);
        const current = existingGroups.get(group.id);
        groupNodes.push({
            kind: "group",
            id: group.id,
            name: group.name,
            action: !current
                ? "create"
                : diffObject(pick(current, GROUP_COMPARE_KEYS), pick(group, GROUP_COMPARE_KEYS))
                        .length > 0 || current.status !== "Active"
                  ? "update"
                  : "unchanged",
        });

        for (const skill of group.skills) {
            fileSkillIds.add(skill.id);
            const currentSkill = existingSkills.get(skill.id);
            const groupChanged = currentSkill?.skillGroupId !== group.id;
            skillNodes.push({
                kind: "skill",
                id: skill.id,
                name: skill.name,
                action: !currentSkill
                    ? "create"
                    : groupChanged ||
                        currentSkill.status !== "Active" ||
                        diffObject(
                            pick(currentSkill, SKILL_COMPARE_KEYS),
                            pick(skill, SKILL_COMPARE_KEYS),
                        ).length > 0
                      ? "update"
                      : "unchanged",
            });
        }
    }

    // Sweep: active rows under this package that the file omits get archived.
    for (const group of existingGroups.values()) {
        if (!fileGroupIds.has(group.id) && group.status === "Active") {
            groupNodes.push({ kind: "group", id: group.id, name: group.name, action: "archive" });
        }
    }
    for (const skill of existingSkills.values()) {
        if (!fileSkillIds.has(skill.id) && skill.status === "Active") {
            skillNodes.push({ kind: "skill", id: skill.id, name: skill.name, action: "archive" });
        }
    }

    const packageNode: ImportPlanNode = {
        kind: "package",
        id: incoming.id,
        name: incoming.name,
        action: !existing
            ? "create"
            : existing.status !== "Active" ||
                existing.published ||
                diffObject(
                    pick(existing, ["name", "description", "tags", "properties"]),
                    pick(incoming, ["name", "description", "tags", "properties"]),
                ).length > 0
              ? "update"
              : "unchanged",
    };

    const allNodes = [packageNode, ...groupNodes, ...skillNodes];
    const counts = {
        created: allNodes.filter((n) => n.action === "create").length,
        updated: allNodes.filter((n) => n.action === "update").length,
        archived: allNodes.filter((n) => n.action === "archive").length,
        unchanged: allNodes.filter((n) => n.action === "unchanged").length,
    };

    const plan: ImportPlan = {
        targetOrganizationId,
        packageAction,
        package: packageNode,
        groups: groupNodes,
        skills: skillNodes,
        counts,
    };

    const buildWrites = (db: SkillPackagePrisma): Prisma.PrismaPromise<unknown>[] => {
        const writes: Prisma.PrismaPromise<unknown>[] = [];

        writes.push(
            db.skillPackage.upsert({
                where: { id: incoming.id },
                create: {
                    id: incoming.id,
                    organizationId: targetOrganizationId,
                    name: incoming.name,
                    description: incoming.description,
                    tags: incoming.tags,
                    properties: incoming.properties,
                    published: false,
                    status: "Active",
                },
                update: {
                    name: incoming.name,
                    description: incoming.description,
                    tags: incoming.tags,
                    properties: incoming.properties,
                    published: false,
                    status: "Active",
                },
            }),
        );

        for (const group of incoming.groups) {
            writes.push(
                db.skillGroup.upsert({
                    where: { id: group.id },
                    create: {
                        id: group.id,
                        skillPackageId: incoming.id,
                        name: group.name,
                        description: group.description,
                        tags: group.tags,
                        properties: group.properties,
                        sequence: group.sequence,
                        defaultInclude: group.defaultInclude,
                        status: "Active",
                    },
                    update: {
                        skillPackageId: incoming.id,
                        name: group.name,
                        description: group.description,
                        tags: group.tags,
                        properties: group.properties,
                        sequence: group.sequence,
                        defaultInclude: group.defaultInclude,
                        status: "Active",
                    },
                }),
            );
        }

        for (const group of incoming.groups) {
            for (const skill of group.skills) {
                writes.push(
                    db.skill.upsert({
                        where: { id: skill.id },
                        create: {
                            id: skill.id,
                            skillPackageId: incoming.id,
                            skillGroupId: group.id,
                            name: skill.name,
                            description: skill.description,
                            tags: skill.tags,
                            properties: skill.properties,
                            sequence: skill.sequence,
                            frequency: skill.frequency,
                            defaultInclude: skill.defaultInclude,
                            defaultRequired: skill.defaultRequired,
                            status: "Active",
                        },
                        update: {
                            skillPackageId: incoming.id,
                            skillGroupId: group.id,
                            name: skill.name,
                            description: skill.description,
                            tags: skill.tags,
                            properties: skill.properties,
                            sequence: skill.sequence,
                            frequency: skill.frequency,
                            defaultInclude: skill.defaultInclude,
                            defaultRequired: skill.defaultRequired,
                            status: "Active",
                        },
                    }),
                );
            }
        }

        const skillIdsToArchive = skillNodes.filter((n) => n.action === "archive").map((n) => n.id);
        if (skillIdsToArchive.length > 0) {
            writes.push(
                db.skill.updateMany({
                    where: { id: { in: skillIdsToArchive } },
                    data: { status: "Archived" },
                }),
            );
        }

        const groupIdsToArchive = groupNodes.filter((n) => n.action === "archive").map((n) => n.id);
        if (groupIdsToArchive.length > 0) {
            writes.push(
                db.skillGroup.updateMany({
                    where: { id: { in: groupIdsToArchive } },
                    data: { status: "Archived" },
                }),
            );
        }

        return writes;
    };

    return { plan, buildWrites };
}

function assertNoDuplicateIds(groups: ExportedGroup[]) {
    const groupIds = new Set<string>();
    const skillIds = new Set<string>();
    const dupe = (kind: string, id: string): never => {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Import file repeats ${kind} ID ${id}.`,
        });
    };
    for (const group of groups) {
        if (groupIds.has(group.id)) dupe("group", group.id);
        groupIds.add(group.id);
        for (const skill of group.skills as ExportedSkill[]) {
            if (skillIds.has(skill.id)) dupe("skill", skill.id);
            skillIds.add(skill.id);
        }
    }
}
