/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MenuAction,
    useMenuActionHotkeys,
    type MenuActionProps,
} from "@/components/ui/menu-action";
import { useOrganization } from "@/hooks/use-organization";
import { useHasPermission } from "@/hooks/use-has-permission";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";

import { SkillPackageBuilder_ArchivePackage_Dialog } from "./archive-package";
import { SkillPackageBuilder_DeletePackage_Dialog } from "./delete-package";
import { SkillPackageBuilder_PublishPackage_Dialog } from "./publish-package";
import { SkillPackageBuilder_RestorePackage_Dialog } from "./restore-package";
import { SkillPackageBuilder_UnpublishPackage_Dialog } from "./unpublish-package";

export function SkillPackageBuilder_Package_Menu({ skillPackage }: { skillPackage: SkillPackage }) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "archive", "restore", "publish", "unpublish"] as const),
    );

    const canUpdate = useHasPermission({ skillPackageBuilder: ["update"] });
    const canPublish = useHasPermission({ skillPackageBuilder: ["publish"] });
    const canDelete = useHasPermission({ skillPackageBuilder: ["delete"] });

    const actions: MenuActionProps[] = [];
    if (skillPackage.status == "Active") {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            onSelect: () => setAction("archive", { history: "push" }),
            disabled: !canUpdate,
        });
    }
    if (skillPackage.status == "Archived") {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
            disabled: !canUpdate,
        });
    }
    if (!skillPackage.published) {
        actions.push({
            verb: "publish",
            label: "Publish",
            icon: <ObjectIcons.Publish />,
            onSelect: () => setAction("publish", { history: "push" }),
            disabled: !canPublish,
        });
    }
    if (skillPackage.published) {
        actions.push({
            verb: "unpublish",
            label: "Unpublish",
            icon: <ObjectIcons.Unpublish />,
            onSelect: () => setAction("unpublish", { history: "push" }),
            disabled: !canPublish,
        });
    }
    actions.push({
        verb: "delete",
        label: "Delete",
        icon: <ObjectIcons.Delete />,
        onSelect: () => setAction("delete", { history: "push" }),
        disabled: !canDelete,
        destructive: true,
    });

    useMenuActionHotkeys(actions, "Packages");

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                    <DropdownMenuGroup>
                        <DropdownMenuItem asChild disabled>
                            <Link
                                href={route(
                                    "/orgs/[slug]/skill-package-builder/packages/[package_id]/history",
                                    { slug: organization.slug, package_id: skillPackage.id },
                                )}
                            >
                                <ObjectIcons.History /> History
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {actions.map((a) => (
                            <MenuAction key={a.verb} {...a} />
                        ))}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <SkillPackageBuilder_DeletePackage_Dialog
                skillPackage={skillPackage}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillPackageBuilder_ArchivePackage_Dialog skillPackage={skillPackage} />
            <SkillPackageBuilder_RestorePackage_Dialog skillPackage={skillPackage} />
            <SkillPackageBuilder_PublishPackage_Dialog skillPackage={skillPackage} />
            <SkillPackageBuilder_UnpublishPackage_Dialog skillPackage={skillPackage} />
        </>
    );
}
