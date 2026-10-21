/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { organizationGroupsEffects } from "@/client/organization-groups-effects";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OrganizationGroupData, OrganizationGroupId } from "@/lib/schemas/organization-group";
import { slugify } from "@/modules/system-admin/lib/slugify";
import { trpc } from "@/trpc/client";

/**
 * `?action=edit` dialog for changing a group's name and slug. Follows
 * `docs/patterns/mutation-dialog.md`. A slug held by another group shows inline on the field.
 */
export function SystemAdmin_EditGroup_Dialog({
    group,
}: {
    group: { id: OrganizationGroupId; name: string; slug: string };
}) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["edit"] as const));
    const dialogOpen = action === "edit";

    const form = useForm({
        resolver: zodResolver(OrganizationGroupData.createSchema),
        defaultValues: { name: group.name, slug: group.slug },
    });

    const mutation = useMutation(
        trpc.organizationGroups.updateGroup.mutationOptions({
            meta: { effects: organizationGroupsEffects.updateGroup },
            onError(error) {
                if (error.data?.code === "CONFLICT") {
                    form.setError("slug", { message: error.message });
                } else {
                    toast.error(`Failed to update group: ${error.message}`);
                    console.error("Failed to update group:", error);
                }
            },
            onSuccess() {
                toast.success("Group updated");
                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        void setAction(open ? "edit" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ name: group.name, slug: group.slug });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        (formData) =>
            mutation.mutate({ groupId: group.id, name: formData.name, slug: formData.slug }),
        (errors) => console.warn("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit group">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Group</DialogTitle>
                    <DialogDescription>Change the group&rsquo;s name or slug.</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id="edit-group-form" onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Controller
                                name="name"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="edit-group-name">Name</FieldLabel>
                                        <Input
                                            id="edit-group-name"
                                            autoFocus
                                            autoComplete="off"
                                            aria-invalid={fieldState.invalid}
                                            {...field}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="slug"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="edit-group-slug">Slug</FieldLabel>
                                        <Input
                                            id="edit-group-slug"
                                            autoComplete="off"
                                            aria-invalid={fieldState.invalid}
                                            {...field}
                                            onChange={(ev) =>
                                                field.onChange(slugify(ev.target.value))
                                            }
                                        />
                                        <FieldDescription>
                                            Unique identifier. Lowercase letters, numbers, and
                                            hyphens only.
                                        </FieldDescription>
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
                        form="edit-group-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
