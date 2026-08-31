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

import { Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

import { SkillPackageBuilder_ArchiveSkill_Dialog } from "./archive-skill";
import { SkillPackageBuilder_DeleteSkill_Dialog } from "./delete-skill";
import { SkillPackageBuilder_MoveSkill_Dialog } from "./move-skill";
import { SkillPackageBuilder_RestoreSkill_Dialog } from "./restore-skill";

interface SkillPackageBuilder_Skill_MenuProps {
    skill: Skill & {
        skillGroup: SkillGroup;
        skillPackage: SkillPackage;
    };
}

export function SkillPackageBuilder_Skill_Menu({ skill }: SkillPackageBuilder_Skill_MenuProps) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "archive", "restore", "move"] as const),
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
                        {/* Show the archive option if the skill package is active */}
                        {skill.status == "Active" && (
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
                        <Protect
                            permissions={{ skillPackageBuilder: ["update"] }}
                            render={(allowed) => (
                                <DropdownMenuItem
                                    onClick={() => setAction("move", { history: "push" })}
                                    disabled={!allowed}
                                >
                                    <ObjectIcons.Move /> Move
                                </DropdownMenuItem>
                            )}
                        />
                        {/* Show the restore option if the skill package is archived */}
                        {skill.status == "Archived" && (
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
                                    onClick={() => setAction("delete", { history: "push" })}
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

            <SkillPackageBuilder_DeleteSkill_Dialog
                skill={skill}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
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
