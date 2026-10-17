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
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

import { SkillPackageBuilder_ArchiveGroup_Dialog } from "./archive-group";
import { SkillPackageBuilder_DeleteSkillGroup_Dialog } from "./delete-group";
import { SkillPackageBuilder_RecoverGroup_Dialog } from "./recover-group";
import { SkillPackageBuilder_RestoreGroup_Dialog } from "./restore-group";

interface SkillPackageBuilder_Group_MenuProps {
    skillGroup: SkillGroup & { skillPackage: SkillPackage };
}

export function SkillPackageBuilder_Group_Menu({
    skillGroup,
}: SkillPackageBuilder_Group_MenuProps) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "archive", "restore", "recover"] as const),
    );

    const canUpdate = useHasPermission({ skillPackage: ["update"] });
    const canDelete = useHasPermission({ skillPackage: ["delete"] });

    const actions: MenuActionProps[] = [];
    if (skillGroup.status == "Active") {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            onSelect: () => setAction("archive", { history: "push" }),
            disabled: !canUpdate,
        });
    }
    if (skillGroup.status == "Archived") {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
            disabled: !canUpdate,
        });
    }
    if (skillGroup.status == "Deleted") {
        actions.push({
            verb: "recover",
            label: "Recover from rubbish",
            icon: <ObjectIcons.Recover />,
            onSelect: () => setAction("recover", { history: "push" }),
            disabled: !canDelete,
        });
    }
    if (skillGroup.status != "Deleted") {
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
                category="Groups"
                width="w-40"
                before={
                    <>
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link
                                    href={route(
                                        "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/history",
                                        {
                                            slug: organization.slug,
                                            package_id: skillGroup.skillPackageId,
                                            group_id: skillGroup.id,
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

            <SkillPackageBuilder_DeleteSkillGroup_Dialog
                skillGroup={skillGroup}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillPackageBuilder_RecoverGroup_Dialog
                skillGroup={skillGroup}
                open={action === "recover"}
                onOpenChange={(open) =>
                    setAction(open ? "recover" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillPackageBuilder_ArchiveGroup_Dialog skillGroup={skillGroup} />
            <SkillPackageBuilder_RestoreGroup_Dialog skillGroup={skillGroup} />
        </>
    );
}
