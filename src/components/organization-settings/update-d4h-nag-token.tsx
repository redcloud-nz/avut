/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";

import { useSuspenseQueries } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

/** The select's value for "no token": Radix's `SelectItem` can't take an empty string. */
const NONE = "none";

/**
 * `?action=update-d4h-nag-token` — self-triggered (Recipe A): the trigger button lives here. Safe
 * because saving the token leaves the module enabled, so its card keeps rendering this row and
 * the dialog stays mounted through the save.
 *
 * Offers the org's own D4H access tokens on the server its D4H link uses (decision 3 of the
 * d4h-nag plan), plus None. Patches only `d4hTokenId` on the `modules.d4h-nag` slice.
 */
export function OrganizationSettings_UpdateD4HNagToken_Dialog({
    organizationId,
    d4hTokenId,
    description,
}: {
    organizationId: OrganizationId;
    /** The stored setting, which may name a token that has since gone. */
    d4hTokenId: string | null;
    /** The setting's explanation, shared with the card's row. */
    description: string;
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-d4h-nag-token"] as const),
    );
    const dialogOpen = action === "update-d4h-nag-token";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-d4h-nag-token" : null, {
            history: open ? "push" : "replace",
        });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit D4H token">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>D4H Token</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <UpdateD4HNagToken_Body
                        organizationId={organizationId}
                        d4hTokenId={d4hTokenId}
                        onDone={() => handleDialogOpenChange(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function UpdateD4HNagToken_Body({
    organizationId,
    d4hTokenId,
    onDone,
}: {
    organizationId: OrganizationId;
    d4hTokenId: string | null;
    onDone: () => void;
}) {
    const [{ data: tokens }, { data: orgD4H }] = useSuspenseQueries({
        queries: [
            trpc.d4hAccessTokens.listOrganizationAccessTokens.queryOptions({ organizationId }),
            trpc.teams.getOrganizationD4H.queryOptions({ organizationId }),
        ],
    });

    // Without an org-level D4H link there's no server to match, and no team to remind either.
    const options = orgD4H ? tokens.filter((token) => token.serverCode === orgD4H.serverCode) : [];
    const storedIsOption = options.some((token) => token.id === d4hTokenId);

    const selectId = useId();
    const formId = useId();
    const form = useForm<{ tokenId: string }>({
        defaultValues: { tokenId: storedIsOption && d4hTokenId ? d4hTokenId : NONE },
    });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update the D4H token",
        onSaved: onDone,
    });

    const handleSubmit = form.handleSubmit(
        ({ tokenId }) =>
            mutation.mutate({
                organizationId,
                update: {
                    slice: "modules.d4h-nag",
                    patch: { d4hTokenId: tokenId === NONE ? null : tokenId },
                },
            }),
        (errors) => console.warn("Form validation errors:", errors),
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="tokenId"
                            render={({ field }) => (
                                <Field>
                                    <FieldLabel htmlFor={selectId}>D4H Token</FieldLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger id={selectId}>
                                            <SelectValue placeholder="Select a token" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NONE}>None</SelectItem>
                                            {options.map((token) => (
                                                <SelectItem key={token.id} value={token.id}>
                                                    {token.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {d4hTokenId !== null && !storedIsOption && (
                                        <FieldDescription>
                                            The saved token can no longer be used here. Choose
                                            another, or None.
                                        </FieldDescription>
                                    )}
                                    {options.length === 0 && (
                                        <FieldDescription>
                                            {orgD4H
                                                ? "This organisation has no D4H access tokens on its D4H server."
                                                : "This organisation isn't linked to D4H yet."}
                                        </FieldDescription>
                                    )}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form={formId}
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                />
            </DialogFooter>
        </>
    );
}
