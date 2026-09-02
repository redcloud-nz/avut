/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { CreateNewIcon } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { systemAdminEffects } from "@/client/system-admin-effects";
import { route } from "@/lib/routes";
import { OrganizationData } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

const createOrganizationFormSchema = OrganizationData.createSchema.extend({
    addSelfAsOwner: z.boolean(),
});

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

/**
 * `?action=create` dialog for provisioning a new organization from the system-admin
 * organizations list. Follows `docs/patterns/mutation-dialog.md`.
 */
export function SystemAdmin_CreateOrganization_Dialog() {
    const router = useRouter();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const));
    const dialogOpen = action === "create";

    const form = useForm({
        resolver: zodResolver(createOrganizationFormSchema),
        defaultValues: { name: "", slug: "", addSelfAsOwner: false },
    });

    const mutation = useMutation(
        trpc.systemAdmin.createOrganization.mutationOptions({
            meta: { effects: systemAdminEffects.createOrganization },
            onError(error) {
                if (error.data?.code === "CONFLICT") {
                    form.setError("slug", { message: error.message });
                } else {
                    toast.error(`Failed to create organization: ${error.message}`);
                    console.error("Failed to create organization:", error);
                }
            },
            onSuccess({ id }) {
                router.push(
                    route("/system-admin/organizations/[organizationId]", { organizationId: id }),
                );
            },
        }),
    );

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ name: "", slug: "", addSelfAsOwner: false });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        (formData) =>
            mutation.mutate({
                name: formData.name,
                slug: formData.slug,
                addSelfAsOwner: formData.addSelfAsOwner,
            }),
        (errors) => console.error("Form validation errors:", errors),
    );

    function handleOpenChange(open: boolean) {
        void setAction(open ? "create" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <CreateNewIcon /> <span className="hidden md:inline">Create Organization</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>
                        Provision a new organization. Default module and integration settings are
                        seeded automatically.
                    </DialogDescription>
                </DialogHeader>
                <form id="create-organization-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="organization-name">Name</FieldLabel>
                                    <Input
                                        id="organization-name"
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
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="slug"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="organization-slug">Slug</FieldLabel>
                                    <Input
                                        id="organization-slug"
                                        autoComplete="off"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                        onChange={(ev) => field.onChange(slugify(ev.target.value))}
                                    />
                                    <FieldDescription>
                                        Identifier used in URLs. Lowercase letters, numbers, and
                                        hyphens only.
                                    </FieldDescription>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="addSelfAsOwner"
                            control={form.control}
                            render={({ field }) => (
                                <Field orientation="horizontal">
                                    <Checkbox
                                        id="organization-add-self-as-owner"
                                        checked={field.value}
                                        onCheckedChange={(checked) =>
                                            field.onChange(checked === true)
                                        }
                                    />
                                    <FieldContent>
                                        <FieldLabel htmlFor="organization-add-self-as-owner">
                                            Add me as owner
                                        </FieldLabel>
                                        <FieldDescription>
                                            Join the new organization as its owner. Leave unchecked
                                            to provision it without a membership.
                                        </FieldDescription>
                                    </FieldContent>
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="create-organization-form"
                        status={mutation.status}
                        text={{ idle: "Create", pending: "Creating", success: "Created" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
