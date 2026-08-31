/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

import { SkillPackageBuilder_ArchiveGroup_Dialog } from "./archive-group";
import { SkillPackageBuilder_DeleteSkillGroup_Dialog } from "./delete-group";
import { SkillPackageBuilder_RestoreGroup_Dialog } from "./restore-group";

interface SkillPackageBuilder_Group_MenuProps {
    skillGroup: SkillGroup & { skillPackage: SkillPackage };
}

export function SkillPackageBuilder_Group_Menu({
    skillGroup,
}: SkillPackageBuilder_Group_MenuProps) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "archive", "restore"] as const),
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
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>

                    <DropdownMenuGroup>
                        {/* Show the archive option if the skill group is active */}
                        {skillGroup.status == "Active" && (
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

                        {/* Show the restore option if the skill group is archived */}
                        {skillGroup.status == "Archived" && (
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
                        <Protect
                            permissions={{ skillPackageBuilder: ["update"] }}
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

            <SkillPackageBuilder_DeleteSkillGroup_Dialog
                skillGroup={skillGroup}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillPackageBuilder_ArchiveGroup_Dialog skillGroup={skillGroup} />
            <SkillPackageBuilder_RestoreGroup_Dialog skillGroup={skillGroup} />
        </>
    );
}
