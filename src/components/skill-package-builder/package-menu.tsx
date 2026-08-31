/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
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
import { useOrganization } from "@/hooks/use-organization";
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
                        {/* Show the archive option if the skill package is active */}
                        {skillPackage.status == "Active" && (
                            <Protect
                                permissions={{ skillPackageBuilder: ["update"] }}
                                render={(allowed) => (
                                    <DropdownMenuItem
                                        onClick={() => setAction("archive", { history: "push" })}
                                        disabled={!allowed}
                                    >
                                        <ObjectIcons.Archive /> Archive
                                    </DropdownMenuItem>
                                )}
                            />
                        )}
                        {/* Show the restore option if the skill package is archived */}
                        {skillPackage.status == "Archived" && (
                            <Protect
                                permissions={{ skillPackageBuilder: ["update"] }}
                                render={(allowed) => (
                                    <DropdownMenuItem
                                        onClick={() => setAction("restore", { history: "push" })}
                                        disabled={!allowed}
                                    >
                                        <ObjectIcons.Restore /> Restore
                                    </DropdownMenuItem>
                                )}
                            />
                        )}
                        {/* Show the publish option if the skill package is not published */}
                        {!skillPackage.published && (
                            <Protect
                                permissions={{ skillPackageBuilder: ["publish"] }}
                                render={(allowed) => (
                                    <DropdownMenuItem
                                        onClick={() => setAction("publish", { history: "push" })}
                                        disabled={!allowed}
                                    >
                                        <ObjectIcons.Publish /> Publish
                                    </DropdownMenuItem>
                                )}
                            />
                        )}
                        {/* Show the unpublish option if the skill package is published */}
                        {skillPackage.published && (
                            <Protect
                                permissions={{ skillPackageBuilder: ["publish"] }}
                                render={(allowed) => (
                                    <DropdownMenuItem
                                        onClick={() => setAction("unpublish", { history: "push" })}
                                        disabled={!allowed}
                                    >
                                        <ObjectIcons.Unpublish /> Unpublish
                                    </DropdownMenuItem>
                                )}
                            />
                        )}
                        <Protect
                            permissions={{
                                skillPackageBuilder: ["delete"],
                            }}
                            render={(allowed) => (
                                <DropdownMenuItem
                                    onSelect={() => setAction("delete", { history: "push" })}
                                    className="text-destructive focus:text-destructive"
                                    disabled={!allowed}
                                >
                                    <ObjectIcons.Delete /> Delete
                                </DropdownMenuItem>
                            )}
                        />
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
