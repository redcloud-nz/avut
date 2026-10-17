/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { organizationGroupsEffects } from "@/client/organization-groups-effects";
import { CreateNewIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationGroupId, OrganizationGroupRole } from "@/lib/schemas/organization-group";
import { trpc } from "@/trpc/client";

const addGroupMemberFormSchema = z.object({
    organizationId: OrganizationId.schema,
    role: OrganizationGroupRole.schema,
});

/**
 * `?action=add-member` dialog for adding an organization to a group from the system-admin group
 * detail page. Follows `docs/patterns/mutation-dialog.md` (Recipe A — self-triggered, owns its own
 * param). An organization whose membership was revoked can be picked again; the service
 * reactivates its old membership.
 */
export function SystemAdmin_AddGroupMember_Dialog({
    groupId,
    activeOrganizationIds,
}: {
    groupId: OrganizationGroupId;
    /** Organizations already active in the group, left out of the picker. */
    activeOrganizationIds: string[];
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-member"] as const),
    );
    const dialogOpen = action === "add-member";

    function handleOpenChange(open: boolean) {
        void setAction(open ? "add-member" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <CreateNewIcon /> <span className="hidden md:inline">Add Organisation</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Organisation</DialogTitle>
                    <DialogDescription>Add an organisation to this group.</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <AddGroupMember_Body
                        groupId={groupId}
                        activeOrganizationIds={activeOrganizationIds}
                        onDone={() => handleOpenChange(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function AddGroupMember_Body({
    groupId,
    activeOrganizationIds,
    onDone,
}: {
    groupId: OrganizationGroupId;
    activeOrganizationIds: string[];
    onDone: () => void;
}) {
    const { data } = useSuspenseQuery(trpc.organizations.listOrganizations.queryOptions());

    const active = new Set(activeOrganizationIds);
    const options = data.organizations
        .filter((o) => !active.has(o.id))
        .map((o) => ({ value: o.id, label: o.name, subtitle: o.slug }));

    const form = useForm({
        resolver: zodResolver(addGroupMemberFormSchema),
        defaultValues: { organizationId: undefined, role: "Member" },
    });

    const mutation = useMutation(
        trpc.organizationGroups.addMember.mutationOptions({
            meta: { effects: organizationGroupsEffects.addMember },
            onError(error) {
                console.error("Failed to add organisation:", error);
                // A conflict (already a member, or a second overseer) shows in the dialog.
                if (error.data?.code !== "CONFLICT") {
                    toast.error(`Failed to add organisation: ${error.message}`);
                }
            },
            onSuccess() {
                toast.success("Organisation added.");
                onDone();
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => mutation.mutate({ groupId, ...formData }),
        (errors) => console.error("Form validation errors:", errors),
    );

    return (
        <>
            <DialogBody>
                <form id="add-group-member-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="organizationId"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="add-group-member-organization">
                                        Organisation
                                    </FieldLabel>
                                    <SearchableSelect
                                        id="add-group-member-organization"
                                        value={field.value}
                                        onValueChange={(value) => field.onChange(value)}
                                        options={options}
                                        placeholder="Select an organisation"
                                        searchPlaceholder="Search organisations..."
                                        emptyMessage="No eligible organisations."
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="role"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="add-group-member-role">Role</FieldLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger
                                            id="add-group-member-role"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {OrganizationGroupRole.schema.options.map((role) => (
                                                <SelectItem key={role} value={role}>
                                                    {OrganizationGroupRole.displayNames[role]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
                {mutation.error?.data?.code === "CONFLICT" && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertDescription>{mutation.error.message}</AlertDescription>
                    </Alert>
                )}
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form="add-group-member-form"
                    status={mutation.status}
                    text={{ idle: "Add", pending: "Adding", success: "Added" }}
                />
            </DialogFooter>
        </>
    );
}
