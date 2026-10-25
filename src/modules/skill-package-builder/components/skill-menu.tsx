/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

import { SkillPackageBuilder_ArchiveSkill_Dialog } from "./archive-skill";
import { SkillPackageBuilder_DeleteSkill_Dialog } from "./delete-skill";
import { SkillPackageBuilder_MoveSkill_Dialog } from "./move-skill";
import { SkillPackageBuilder_RecoverSkill_Dialog } from "./recover-skill";
import { SkillPackageBuilder_RestoreSkill_Dialog } from "./restore-skill";

interface SkillPackageBuilder_Skill_MenuProps {
    skill: Skill & {
        skillGroup: SkillGroup;
        skillPackage: SkillPackage;
    };
}

export function SkillPackageBuilder_Skill_Menu({ skill }: SkillPackageBuilder_Skill_MenuProps) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "archive", "restore", "recover", "move"] as const),
    );

    const canUpdate = useHasPermission({ skillPackage: ["update"] });
    const canDelete = useHasPermission({ skillPackage: ["delete"] });

    const actions: MenuActionProps[] = [];
    if (skill.status == "Active") {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            onSelect: () => setAction("archive", { history: "push" }),
            disabled: !canUpdate,
        });
    }
    if (skill.status != "Deleted") {
        actions.push({
            verb: "move",
            label: "Move",
            icon: <ObjectIcons.Move />,
            onSelect: () => setAction("move", { history: "push" }),
            disabled: !canUpdate,
        });
    }
    if (skill.status == "Archived") {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
            disabled: !canUpdate,
        });
    }
    if (skill.status == "Deleted") {
        actions.push({
            verb: "recover",
            label: "Recover from rubbish",
            icon: <ObjectIcons.Recover />,
            onSelect: () => setAction("recover", { history: "push" }),
            disabled: !canDelete,
        });
    } else {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            disabled: !canDelete,
            destructive: true,
        });
    }

    return (
        <>
            <EntityActionMenu
                actions={actions}
                category="Skills"
                before={
                    <>
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link
                                    href={route(
                                        "/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/history",
                                        {
                                            slug: organization.slug,
                                            package_id: skill.skillPackageId,
                                            skill_id: skill.id,
                                        },
                                    )}
                                >
                                    <ObjectIcons.History /> History
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                    </>
                }
            />

            <SkillPackageBuilder_DeleteSkill_Dialog
                skill={skill}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillPackageBuilder_RecoverSkill_Dialog
                skill={skill}
                open={action === "recover"}
                onOpenChange={(open) =>
                    setAction(open ? "recover" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillPackageBuilder_ArchiveSkill_Dialog skill={skill} />
            <SkillPackageBuilder_RestoreSkill_Dialog skill={skill} />
            <SkillPackageBuilder_MoveSkill_Dialog
                skill={skill}
                open={action === "move"}
                onOpenChange={(open) =>
                    setAction(open ? "move" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
