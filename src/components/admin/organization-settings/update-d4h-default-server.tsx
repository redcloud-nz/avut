/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { D4HServerList } from "@/lib/d4h-servers";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

const defaultServerFormSchema = OrganizationSettings.schema.shape.integrations.shape.d4h.pick({
    defaultServer: true,
});

/**
 * `?action=update-d4h-default-server` — self-triggered (Recipe A): the trigger button lives here.
 * Safe because saving the server leaves the D4H integration enabled, so its card keeps rendering
 * this row and the dialog stays mounted through the save.
 *
 * Patches only `defaultServer`, leaving `enabled`, `syncToken` and the sync settings alone.
 */
export function OrganizationSettings_UpdateD4HDefaultServer_Dialog({
    organizationId,
    settings,
    description,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    /** The default-server explanation, shared with the card's row. */
    description: string;
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-d4h-default-server"] as const),
    );
    const dialogOpen = action === "update-d4h-default-server";

    const form = useForm({
        resolver: zodResolver(defaultServerFormSchema),
        defaultValues: { defaultServer: settings.integrations.d4h.defaultServer },
    });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update the D4H default server",
        onSaved: (updated) => {
            form.reset({ defaultServer: updated.integrations.d4h.defaultServer });
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-d4h-default-server" : null, {
            history: open ? "push" : "replace",
        });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ defaultServer: settings.integrations.d4h.defaultServer });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        ({ defaultServer }) => {
            mutation.mutate({
                organizationId,
                update: { slice: "integrations.d4h", patch: { defaultServer } },
            });
        },
        (errors) => console.error("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit D4H default server">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>D4H Default Server</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id="update-d4h-default-server-form" onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Controller
                                control={form.control}
                                name="defaultServer"
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="d4h-default-server">
                                            Default Server
                                        </FieldLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger
                                                id="d4h-default-server"
                                                aria-invalid={fieldState.invalid}
                                            >
                                                <SelectValue placeholder="Select a server" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {D4HServerList.map((server) => (
                                                    <SelectItem
                                                        key={server.code}
                                                        value={server.code}
                                                    >
                                                        {server.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
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
                        form="update-d4h-default-server-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
