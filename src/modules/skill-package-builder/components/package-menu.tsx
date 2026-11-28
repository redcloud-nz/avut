/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { ActionsCard, RecordCardMenu } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_ArchivePackage_Dialog } from "./archive-package";
import { SkillPackageBuilder_DeletePackage_Dialog } from "./delete-package";
import { SkillPackageBuilder_PublishPackage_Dialog } from "./publish-package";
import { SkillPackageBuilder_RecoverPackage_Dialog } from "./recover-package";
import { SkillPackageBuilder_RestorePackage_Dialog } from "./restore-package";
import { SkillPackageBuilder_UnpublishPackage_Dialog } from "./unpublish-package";

/** Every `?action=` the package page's dialogs answer to. Edit's dialog owns `update` itself. */
const packageActions = parseAsStringLiteral([
    "update",
    "delete",
    "archive",
    "restore",
    "recover",
    "publish",
    "unpublish",
] as const);

function slugify(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "skill-package"
    );
}

/**
 * The Skill Package card's ⋮ (the page's primary record card): Export .json, Archive, Restore or
 * Recover, and Delete. Edit is the card's pencil, History its "Updated" footer, Publish and
 * Unpublish the {@link SkillPackageBuilder_Package_PublishingCard}.
 *
 * Mounts every dialog on the page, whichever card or button opens it.
 */
export function SkillPackageBuilder_Package_Menu({ skillPackage }: { skillPackage: SkillPackage }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [action, setAction] = useQueryState("action", packageActions);

    const canView = useHasPermission({ skillPackage: ["view"] });
    const canUpdate = useHasPermission({ skillPackage: ["update"] });
    const canDelete = useHasPermission({ skillPackage: ["delete"] });

    // Publish's and Unpublish's buttons are gone once they succeed, so their dialogs return focus
    // here instead. Anyone who can publish can view, so this ⋮ (with Export) is always there.
    const triggerRef = useRef<HTMLButtonElement>(null);

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

    const actions: MenuActionProps[] = [];
    if (canView) {
        actions.push({
            verb: "export",
            label: "Export .json",
            icon: <ObjectIcons.Export />,
            onSelect: () => void exportPackage(),
            disabled: exporting,
        });
    }
    if (skillPackage.status === "Active" && canUpdate) {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            onSelect: () => setAction("archive", { history: "push" }),
        });
    }
    if (skillPackage.status === "Archived" && canUpdate) {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
        });
    }
    if (skillPackage.status === "Deleted" && canDelete) {
        actions.push({
            verb: "recover",
            label: "Recover from rubbish",
            icon: <ObjectIcons.Recover />,
            onSelect: () => setAction("recover", { history: "push" }),
        });
    }
    if (skillPackage.status !== "Deleted" && canDelete) {
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
            <RecordCardMenu actions={actions} category="Packages" primary triggerRef={triggerRef} />
            <SkillPackageBuilder_DeletePackage_Dialog
                skillPackage={skillPackage}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillPackageBuilder_RecoverPackage_Dialog
                skillPackage={skillPackage}
                open={action === "recover"}
                onOpenChange={(open) =>
                    setAction(open ? "recover" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <SkillPackageBuilder_ArchivePackage_Dialog skillPackage={skillPackage} />
            <SkillPackageBuilder_RestorePackage_Dialog skillPackage={skillPackage} />
            <SkillPackageBuilder_PublishPackage_Dialog
                skillPackage={skillPackage}
                returnFocusRef={triggerRef}
            />
            <SkillPackageBuilder_UnpublishPackage_Dialog
                skillPackage={skillPackage}
                returnFocusRef={triggerRef}
            />
        </>
    );
}

/**
 * The titled Publishing card at the top of the package's secondary column, for a viewer who can
 * publish: whether the package is published and what that means for subscribers, then Publish
 * (an Active, unpublished package) or Unpublish. Renders nothing when neither applies. The
 * dialogs are in {@link SkillPackageBuilder_Package_Menu}.
 */
export function SkillPackageBuilder_Package_PublishingCard({
    skillPackage,
}: {
    skillPackage: SkillPackage;
}) {
    const [, setAction] = useQueryState("action", packageActions);

    const canPublish = useHasPermission({ skillPackage: ["publish"] });

    return (
        <ActionsCard
            title="Publishing"
            description={
                skillPackage.published
                    ? "Published: other organisations can subscribe, and its skills are in subscribers' sessions and reports."
                    : "Not published: no one can subscribe, and subscribers' sessions and reports leave its skills out."
            }
        >
            {canPublish && skillPackage.status === "Active" && !skillPackage.published ? (
                <Button onClick={() => setAction("publish", { history: "push" })}>
                    <ObjectIcons.Publish /> Publish
                </Button>
            ) : null}
            {canPublish && skillPackage.published ? (
                <Button
                    variant="outline"
                    onClick={() => setAction("unpublish", { history: "push" })}
                >
                    <ObjectIcons.Unpublish /> Unpublish
                </Button>
            ) : null}
        </ActionsCard>
    );
}
