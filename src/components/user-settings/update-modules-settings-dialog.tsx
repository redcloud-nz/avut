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
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useUserSettingsMutation } from "@/components/user-settings/use-user-settings-mutation";
import { userModules as allUserModules, configurableUserModuleIds } from "@/lib/modules";
import { UserSettings } from "@/lib/schemas/user-settings";

const userModules = allUserModules.filter((m) => configurableUserModuleIds.includes(m.id));

/** `?action=update-modules` — self-triggered (Recipe A): the trigger button lives in this dialog. */
export function UserModules_UpdateSettings_Dialog({ settings }: { settings: UserSettings }) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-modules"] as const),
    );
    const dialogOpen = action === "update-modules";

    const form = useForm({
        resolver: zodResolver(UserSettings.schema.shape.modules),
        defaultValues: settings.modules,
    });

    const mutation = useUserSettingsMutation({
        errorMessage: "Failed to update module settings",
        onSaved: (updated) => {
            form.reset(updated.modules);
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-modules" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset(settings.modules);
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({ update: { slice: "modules", patch: formData } });
    });

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit module settings">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Modules</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <form id="update-modules-settings-form" onSubmit={handleSubmit}>
                        <FieldGroup>
                            {userModules.map((module) => (
                                <Field key={module.id} orientation="horizontal">
                                    <FieldContent>
                                        <FieldLabel htmlFor={`${module.id}-module-enabled`}>
                                            {module.label}
                                        </FieldLabel>
                                    </FieldContent>
                                    <Controller
                                        control={form.control}
                                        name={`${module.id}.enabled`}
                                        render={({ field }) => (
                                            <Switch
                                                id={`${module.id}-module-enabled`}
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        )}
                                    />
                                </Field>
                            ))}
                        </FieldGroup>
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-modules-settings-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
