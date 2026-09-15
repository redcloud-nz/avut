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
import { DiffChange, diffObject } from "@/lib/diff";
import { LogAction, LogObjectType } from "@/lib/schemas/log-entry";
import type { SkillId } from "@/lib/schemas/skill";
import type { SkillGroupId } from "@/lib/schemas/skill-group";
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
    // Export only the live tree — archived groups/skills are kept in the DB to
    // preserve SkillCheck history, and the envelope has no `status` field, so
    // importing them would silently reactivate them.
    const activeGroups = groups.filter((group) => group.status === "Active");
    const sortedGroups = [...activeGroups].sort((a, b) => a.sequence - b.sequence);
    const skillsByGroup = new Map<string, Skill[]>();
    for (const skill of skills) {
        if (skill.status !== "Active") continue;
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

/**
 * One row-write plus the `ctx.logEvent` options to pair it with. The caller commits
 * each item as its own `ctx.prisma.$transaction([item.write(ctx.prisma), ctx.logEvent(item.log)])`
 * — see docs/patterns/transactional-writes.md. Keeping each item independently
 * committable means a package with many groups/skills isn't bound by one shared
 * transaction's timeout.
 */
export interface SkillPackageWriteItem {
    write: (prisma: SkillPackagePrisma) => Prisma.PrismaPromise<unknown>;
    log: {
        action: LogAction;
        objectType: LogObjectType;
        objectId: string;
        changes?: DiffChange[];
        description?: string;
    };
}

export interface PreparedSkillPackageImport {
    plan: ImportPlan;
    /**
     * The writes for the import, in FK-safe order (package, groups, skills, then
     * archives) — one item per node whose `action` isn't `"unchanged"`. Empty when
     * the import is a byte-for-byte re-sync of what's already stored.
     */
    writeItems: SkillPackageWriteItem[];
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
            message: `Skill package ${incoming.id} already exists under a different organisation. A package ID belongs to exactly one organisation per instance.`,
        });
    }

    const packageAction: "Create" | "Update" = existing ? "Update" : "Create";

    const existingGroups = new Map((existing?.groups ?? []).map((g) => [g.id, g]));
    const existingSkills = new Map((existing?.skills ?? []).map((s) => [s.id, s]));

    const fileGroupIds = new Set<string>();
    const fileSkillIds = new Set<string>();
    const groupNodes: ImportPlanNode[] = [];
    const skillNodes: ImportPlanNode[] = [];
    // Diffs computed while planning, kept so `writeItems` doesn't recompute them.
    const groupChanges = new Map<string, DiffChange[]>();
    const skillChanges = new Map<string, DiffChange[]>();

    for (const group of incoming.groups) {
        fileGroupIds.add(group.id);
        const current = existingGroups.get(group.id);
        const diff = current
            ? diffObject(pick(current, GROUP_COMPARE_KEYS), pick(group, GROUP_COMPARE_KEYS))
            : diffObject({}, pick(group, GROUP_COMPARE_KEYS));
        groupChanges.set(group.id, diff);
        groupNodes.push({
            kind: "group",
            id: group.id,
            name: group.name,
            action: !current
                ? "create"
                : diff.length > 0 || current.status !== "Active"
                  ? "update"
                  : "unchanged",
        });

        for (const skill of group.skills) {
            fileSkillIds.add(skill.id);
            const currentSkill = existingSkills.get(skill.id);
            const groupChanged = currentSkill?.skillGroupId !== group.id;
            const skillDiff = currentSkill
                ? diffObject(
                      pick(currentSkill, SKILL_COMPARE_KEYS),
                      pick(skill, SKILL_COMPARE_KEYS),
                  )
                : diffObject({}, pick(skill, SKILL_COMPARE_KEYS));
            skillChanges.set(skill.id, skillDiff);
            skillNodes.push({
                kind: "skill",
                id: skill.id,
                name: skill.name,
                action: !currentSkill
                    ? "create"
                    : groupChanged || currentSkill.status !== "Active" || skillDiff.length > 0
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

    const PACKAGE_COMPARE_KEYS = ["name", "description", "tags", "properties"] as const;
    const packageDiff = existing
        ? diffObject(pick(existing, PACKAGE_COMPARE_KEYS), pick(incoming, PACKAGE_COMPARE_KEYS))
        : diffObject({}, pick(incoming, PACKAGE_COMPARE_KEYS));
    const packageNode: ImportPlanNode = {
        kind: "package",
        id: incoming.id,
        name: incoming.name,
        action: !existing
            ? "create"
            : existing.status !== "Active" || existing.published || packageDiff.length > 0
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

    const groupsById = new Map(incoming.groups.map((g) => [g.id, g]));
    const skillsById = new Map(incoming.groups.flatMap((g) => g.skills.map((s) => [s.id, s])));

    const writeItems: SkillPackageWriteItem[] = [];

    if (packageNode.action !== "unchanged") {
        writeItems.push({
            write: (db) =>
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
            log: {
                action: packageNode.action === "create" ? "Create" : "Update",
                objectType: "SkillPackage",
                objectId: incoming.id,
                changes: packageDiff,
            },
        });
    }

    // Groups, in FK-safe order ahead of their skills.
    for (const node of groupNodes) {
        if (node.action === "unchanged") continue;
        if (node.action === "archive") {
            writeItems.push({
                write: (db) =>
                    db.skillGroup.update({ where: { id: node.id }, data: { status: "Archived" } }),
                log: {
                    action: "Archive",
                    objectType: "SkillGroup",
                    objectId: node.id,
                    description: `No longer present in re-imported skill package "${incoming.name}".`,
                },
            });
            continue;
        }
        const group = groupsById.get(node.id as SkillGroupId)!;
        writeItems.push({
            write: (db) =>
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
            log: {
                action: node.action === "create" ? "Create" : "Update",
                objectType: "SkillGroup",
                objectId: node.id,
                changes: groupChanges.get(node.id),
            },
        });
    }

    for (const node of skillNodes) {
        if (node.action === "unchanged") continue;
        if (node.action === "archive") {
            writeItems.push({
                write: (db) =>
                    db.skill.update({ where: { id: node.id }, data: { status: "Archived" } }),
                log: {
                    action: "Archive",
                    objectType: "Skill",
                    objectId: node.id,
                    description: `No longer present in re-imported skill package "${incoming.name}".`,
                },
            });
            continue;
        }
        const skill = skillsById.get(node.id as SkillId)!;
        const group = incoming.groups.find((g) => g.skills.some((s) => s.id === skill.id))!;
        writeItems.push({
            write: (db) =>
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
            log: {
                action: node.action === "create" ? "Create" : "Update",
                objectType: "Skill",
                objectId: node.id,
                changes: skillChanges.get(node.id),
            },
        });
    }

    return { plan, writeItems };
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
