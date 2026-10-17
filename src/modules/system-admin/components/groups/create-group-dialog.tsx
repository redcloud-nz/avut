/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { organizationGroupsEffects } from "@/client/organization-groups-effects";
import { CreateNewIcon } from "@/components/icons";
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
import { useActionHotkeys } from "@/hooks/use-action-hotkeys";
import { route } from "@/lib/routes";
import { OrganizationGroupData } from "@/lib/schemas/organization-group";
import { trpc } from "@/trpc/client";

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

/**
 * `?action=create-group` dialog for creating a group from the system-admin groups list.
 * Follows `docs/patterns/mutation-dialog.md`.
 */
export function SystemAdmin_CreateGroup_Dialog() {
    const router = useRouter();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["create-group"] as const),
    );
    const dialogOpen = action === "create-group";

    useActionHotkeys([
        {
            verb: "create",
            run: () => void setAction("create-group", { history: "push" }),
            name: "Create group",
            category: "Groups",
        },
    ]);

    const form = useForm({
        resolver: zodResolver(OrganizationGroupData.createSchema),
        defaultValues: { name: "", slug: "" },
    });

    const mutation = useMutation(
        trpc.organizationGroups.createGroup.mutationOptions({
            meta: { effects: organizationGroupsEffects.createGroup, navigates: true },
            onError(error) {
                if (error.data?.code === "CONFLICT") {
                    form.setError("slug", { message: error.message });
                } else {
                    toast.error(`Failed to create group: ${error.message}`);
                    console.error("Failed to create group:", error);
                }
            },
            onSuccess({ id }) {
                router.push(route("/system/admin/groups/[groupId]", { groupId: id }));
            },
        }),
    );

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ name: "", slug: "" });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        (formData) => mutation.mutate({ name: formData.name, slug: formData.slug }),
        (errors) => console.error("Form validation errors:", errors),
    );

    function handleOpenChange(open: boolean) {
        void setAction(open ? "create-group" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <CreateNewIcon /> <span className="hidden md:inline">Create Group</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Group</DialogTitle>
                    <DialogDescription>
                        Create a group to bind organisations together. Add its members afterwards
                        from the group page.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id="create-group-form" onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Controller
                                name="name"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="group-name">Name</FieldLabel>
                                        <Input
                                            id="group-name"
                                            autoFocus
                                            autoComplete="off"
                                            aria-invalid={fieldState.invalid}
                                            {...field}
                                            onChange={(ev) => {
                                                field.onChange(ev);
                                                if (!form.getFieldState("slug").isDirty) {
                                                    form.setValue("slug", slugify(ev.target.value));
                                                }
                                            }}
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
                                        <FieldLabel htmlFor="group-slug">Slug</FieldLabel>
                                        <Input
                                            id="group-slug"
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
                        form="create-group-form"
                        status={mutation.status}
                        text={{ idle: "Create", pending: "Creating", success: "Created" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
