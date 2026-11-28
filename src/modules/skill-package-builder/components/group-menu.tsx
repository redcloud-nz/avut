/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { RecordCardMenu } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

import { SkillPackageBuilder_ArchiveGroup_Dialog } from "./archive-group";
import { SkillPackageBuilder_DeleteSkillGroup_Dialog } from "./delete-group";
import { SkillPackageBuilder_RecoverGroup_Dialog } from "./recover-group";
import { SkillPackageBuilder_RestoreGroup_Dialog } from "./restore-group";

interface SkillPackageBuilder_Group_MenuProps {
    skillGroup: SkillGroup & { skillPackage: SkillPackage };
}

/**
 * The Skill Group card's ⋮ (the page's primary record card): Archive, Restore or Recover, and
 * Delete. Edit is the card's pencil, History its "Updated" footer.
 *
 * Mounts the dialogs they open.
 */
export function SkillPackageBuilder_Group_Menu({
    skillGroup,
}: SkillPackageBuilder_Group_MenuProps) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "archive", "restore", "recover"] as const),
    );

    const canUpdate = useHasPermission({ skillPackage: ["update"] });
    const canDelete = useHasPermission({ skillPackage: ["delete"] });

    const actions: MenuActionProps[] = [];
    if (skillGroup.status === "Active" && canUpdate) {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            onSelect: () => setAction("archive", { history: "push" }),
        });
    }
    if (skillGroup.status === "Archived" && canUpdate) {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
        });
    }
    if (skillGroup.status === "Deleted" && canDelete) {
        actions.push({
            verb: "recover",
            label: "Recover from rubbish",
            icon: <ObjectIcons.Recover />,
            onSelect: () => setAction("recover", { history: "push" }),
        });
    }
    if (skillGroup.status !== "Deleted" && canDelete) {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            destructive: true,
        });
    }

    return (
        <>
            <RecordCardMenu actions={actions} category="Groups" primary />

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
