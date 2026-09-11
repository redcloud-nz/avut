/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

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
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_ArchivePackage_Dialog } from "./archive-package";
import { SkillPackageBuilder_DeletePackage_Dialog } from "./delete-package";
import { SkillPackageBuilder_PublishPackage_Dialog } from "./publish-package";
import { SkillPackageBuilder_RestorePackage_Dialog } from "./restore-package";
import { SkillPackageBuilder_UnpublishPackage_Dialog } from "./unpublish-package";

function slugify(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "skill-package"
    );
}

export function SkillPackageBuilder_Package_Menu({ skillPackage }: { skillPackage: SkillPackage }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "archive", "restore", "publish", "unpublish"] as const),
    );

    const canView = useHasPermission({ skillPackageBuilder: ["view"] });
    const canUpdate = useHasPermission({ skillPackageBuilder: ["update"] });
    const canPublish = useHasPermission({ skillPackageBuilder: ["publish"] });
    const canDelete = useHasPermission({ skillPackageBuilder: ["delete"] });

    const [exporting, setExporting] = useState(false);

    async function exportPackage() {
        if (exporting) return;
        setExporting(true);
        try {
            const envelope = await queryClient.fetchQuery({
                ...trpc.skillPackageBuilder.exportPackage.queryOptions({
                    organizationId: organization.id,
                    skillPackageId: skillPackage.id,
                }),
                // Always export the current state — never a cached envelope.
                staleTime: 0,
            });

            const blob = new Blob([JSON.stringify(envelope, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${slugify(skillPackage.name)}.json`;
            anchor.click();
            // Defer the revoke — revoking in the same tick as click() aborts
            // the download in Firefox and intermittently elsewhere.
            setTimeout(() => URL.revokeObjectURL(url), 0);
        } catch (error) {
            toast.error(
                `Export failed: ${error instanceof Error ? error.message : "unknown error"}`,
            );
        } finally {
            setExporting(false);
        }
    }

    const actions: MenuActionProps[] = [
        {
            verb: "export",
            label: "Export .json",
            icon: <ObjectIcons.Export />,
            onSelect: () => void exportPackage(),
            disabled: !canView || exporting,
        },
    ];
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
