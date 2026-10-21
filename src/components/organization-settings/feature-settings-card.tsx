/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, type ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { OrganizationId } from "@/lib/schemas/organization";

import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

/** The settings slices that are switched on and off as a whole, by an `enabled` flag. */
export type FeatureSliceId =
    | "integrations.d4h"
    | "integrations.email"
    | "modules.d4h-views"
    | "modules.i3"
    | "modules.notes"
    | "modules.skill-package-builder"
    | "modules.skill-track";

const DISABLE_CONSEQUENCES: Record<"module" | "integration", string> = {
    module: "It will disappear from the navigation for everyone in your organisation. Nothing is deleted, and enabling it again brings everything back.",
    integration:
        "Features that rely on it stop working for everyone in your organisation until it's enabled again. Its settings are kept.",
};

/**
 * The card for a module or integration on the organization-settings page.
 *
 * An h3 heading row carries the title and, for editors, Enable or Disable; the description sits
 * below it in an info `Alert`. Disabled, the heading gets a "Disabled" badge and Enable saves
 * straight away, since enabling is harmless. Enabled, `children` (its own settings, if it has
 * any) render in a `Card`, and Disable confirms first since turning it off affects everyone in
 * the organisation.
 *
 * The card owns the `?action=disable-<key>` param rather than the dialog (Recipe C in
 * `docs/patterns/mutation-dialog.md`): a successful disable swaps the Disable trigger for Enable,
 * and the close has to come from something that stays mounted.
 */
export function Feature_SettingsCard({
    organizationId,
    canEdit,
    slice,
    enabled,
    kind,
    title,
    description,
    children,
}: {
    organizationId: OrganizationId;
    canEdit: boolean;
    slice: FeatureSliceId;
    /** The slice's current `enabled` flag. */
    enabled: boolean;
    kind: "module" | "integration";
    title: string;
    description?: ReactNode;
    /** Its settings, shown only while it's enabled. */
    children?: ReactNode;
}) {
    // `modules.notes` → `disable-notes`, `integrations.d4h` → `disable-d4h`.
    const disableAction = `disable-${slice.slice(slice.indexOf(".") + 1)}`;

    const [action, setAction] = useQueryState("action", parseAsStringLiteral([disableAction]));
    const disableOpen = canEdit && enabled && action === disableAction;

    function handleDisableOpenChange(open: boolean) {
        void setAction(open ? disableAction : null, { history: open ? "push" : "replace" });
    }

    const enableMutation = useOrganizationSettingsMutation({
        errorMessage: `Failed to enable "${title}"`,
        onSaved: () => {},
    });

    const disableMutation = useOrganizationSettingsMutation({
        errorMessage: `Failed to disable "${title}"`,
        onSaved: () => handleDisableOpenChange(false),
    });

    useEffect(() => {
        if (disableOpen) disableMutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [disableOpen]);

    function setEnabled(mutation: typeof enableMutation, next: boolean) {
        mutation.mutate({ organizationId, update: { slice, patch: { enabled: next } } });
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-4">
                <h3 className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold">
                    {title}
                    {!enabled && <Badge variant="outline">Disabled</Badge>}
                </h3>
                {canEdit &&
                    (enabled ? (
                        <Button variant="outline" onClick={() => handleDisableOpenChange(true)}>
                            Disable
                        </Button>
                    ) : (
                        <MutationButton
                            type="button"
                            status={enableMutation.status}
                            text={{
                                idle: "Enable",
                                pending: "Enabling...",
                                success: "Enabled",
                            }}
                            onClick={() => setEnabled(enableMutation, true)}
                        />
                    ))}
            </div>
            {description && (
                // A static note, not an announcement: override Alert's role="alert".
                <Alert variant="default" role="note" className="px-3 py-2.5">
                    <AlertDescription className="text-sm/relaxed">{description}</AlertDescription>
                </Alert>
            )}
            {enabled && children && (
                <Card>
                    <CardContent>{children}</CardContent>
                </Card>
            )}

            {canEdit && (
                <Dialog open={disableOpen} onOpenChange={handleDisableOpenChange}>
                    {/* A successful disable unmounts the Disable trigger, so there's nothing to
                        return focus to; stop Radix jumping it to <body>. */}
                    <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                        <DialogHeader>
                            <DialogTitle>Disable the {title}?</DialogTitle>
                            <DialogDescription>{DISABLE_CONSEQUENCES[kind]}</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                            <MutationButton
                                type="button"
                                status={disableMutation.status}
                                text={{
                                    idle: "Disable",
                                    pending: "Disabling...",
                                    success: "Disabled",
                                }}
                                onClick={() => setEnabled(disableMutation, false)}
                            />
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </section>
    );
}
