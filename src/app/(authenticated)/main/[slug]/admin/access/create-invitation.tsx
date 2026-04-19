/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { MutationButton } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { useOrganization } from "@/hooks/use-organization";
import { PersonId } from "@/lib/schemas/person";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";

const schema = z.object({
    personId: z.string().min(1, "Please select a person."),
    email: z.email({ message: "Please enter a valid email address." }),
    primaryRole: z.enum(["owner", "admin", "member"]),
    i3Role: z.enum(["i3-admin", "i3-user"]).nullable(),
    skillsRole: z.enum(["skills-admin", "skills-assessor"]).nullable(),
    skillPackageRole: z.enum(["skill-package-author"]).nullable(),
});

export function AdminModule_CreateInvitation_Dialog(props: DialogProps) {
    const organization = useOrganization();

    const { data: personnel } = useSuspenseQuery(
        trpc.accessControl.listPersonnelWithAccess.queryOptions({
            organizationId: organization.id,
        }),
    );

    const uninvitedPersonnel = personnel.filter((p) => p.accessStatus === "None");

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            personId: "",
            email: "",
            primaryRole: "member",
            i3Role: null,
            skillsRole: null,
            skillPackageRole: null,
        },
    });

    const [personPickerOpen, setPersonPickerOpen] = useState(false);

    const mutation = useMutation(
        trpc.accessControl.createInvitation.mutationOptions({
            onError(error) {
                if (error.data?.conflict) {
                    form.setError(error.data.conflict.fieldName as keyof z.infer<typeof schema>, {
                        message: error.data.conflict.message,
                    });
                } else {
                    toast.error(`Failed to create invitation: ${error.message}`);
                    console.error("Failed to create invitation:", error);
                }
            },
            async onSuccess({ created }, _variables, _onMutateResult, context) {
                toast.success(`Invitation sent to ${created.email}`);

                props.onOpenChange?.(false);

                await context.client.invalidateQueries(
                    trpc.accessControl.listPersonnelWithAccess.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
        }
        props.onOpenChange?.(open);
    }

    const primaryRole = useWatch({
        control: form.control,
        name: "primaryRole",
    });

    const selectedPersonId = useWatch({
        control: form.control,
        name: "personId",
    });

    const selectedPerson = uninvitedPersonnel.find((p) => p.id === selectedPersonId);

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Invitation</DialogTitle>
                    <DialogDescription>Invite a new user to the organization.</DialogDescription>
                </DialogHeader>
                <form
                    id="create-invitation-form"
                    onSubmit={form.handleSubmit((formData) => {
                        mutation.mutate({
                            organizationId: organization.id,
                            personId: formData.personId as PersonId,
                            email: formData.email,
                            roles: [
                                formData.primaryRole,
                                formData.i3Role,
                                formData.skillsRole,
                                formData.skillPackageRole,
                            ].filter((r): r is OrganizationRole => r !== null),
                        });
                    })}
                >
                    <FieldGroup>
                        <Controller
                            name="personId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid} orientation="responsive">
                                    <FieldLabel>Person</FieldLabel>
                                    <Popover
                                        open={personPickerOpen}
                                        onOpenChange={setPersonPickerOpen}
                                    >
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                role="combobox"
                                                aria-expanded={personPickerOpen}
                                                aria-invalid={fieldState.invalid}
                                                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full min-w-1/2 items-center justify-between rounded-none border px-3 py-2 text-xs focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {selectedPerson?.name ?? "Select a person..."}
                                                <ChevronsUpDownIcon className="ml-2 size-3.5 shrink-0 opacity-50" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-0">
                                            <Command>
                                                <CommandInput placeholder="Search personnel..." />
                                                <CommandList>
                                                    <CommandEmpty>No personnel found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {uninvitedPersonnel.map((person) => (
                                                            <CommandItem
                                                                key={person.id}
                                                                value={person.name}
                                                                data-checked={
                                                                    field.value === person.id
                                                                }
                                                                onSelect={() => {
                                                                    field.onChange(person.id);
                                                                    form.setValue(
                                                                        "email",
                                                                        person.email ?? "",
                                                                    );
                                                                    setPersonPickerOpen(false);
                                                                }}
                                                            >
                                                                <span>{person.name}</span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />

                        <Controller
                            name="email"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid} orientation="responsive">
                                    <FieldLabel htmlFor="email">Email Address</FieldLabel>
                                    <Input
                                        id="email"
                                        className="min-w-1/2"
                                        placeholder="example@email.com"
                                        autoComplete="off"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />

                        <Controller
                            name="primaryRole"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel>Primary Role</FieldLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger aria-invalid={fieldState.invalid}>
                                            <SelectValue placeholder="Select primary role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="owner">Owner</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="member">Member</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />

                        <Show when={primaryRole == "member"}>
                            <FieldLegend>Module-specific Roles</FieldLegend>

                            {organization.settings.modules.i3.enabled && (
                                <Controller
                                    name="i3Role"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field orientation="responsive">
                                            <FieldLabel>I3 Module</FieldLabel>
                                            <Select
                                                value={field.value ?? "NONE"}
                                                onValueChange={(newValue) =>
                                                    field.onChange(
                                                        newValue === "NONE" ? null : newValue,
                                                    )
                                                }
                                            >
                                                <SelectTrigger aria-invalid={fieldState.invalid}>
                                                    <SelectValue placeholder="Select I3 module role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">None</SelectItem>
                                                    <SelectItem value="i3-admin">
                                                        I3 Admin
                                                    </SelectItem>
                                                    <SelectItem value="i3-user">I3 User</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            )}
                            {organization.settings.modules.skills.enabled && (
                                <Controller
                                    name="skillsRole"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field orientation="responsive">
                                            <FieldLabel>Skills Module</FieldLabel>
                                            <Select
                                                value={field.value ?? "NONE"}
                                                onValueChange={(newValue) =>
                                                    field.onChange(
                                                        newValue === "NONE" ? null : newValue,
                                                    )
                                                }
                                            >
                                                <SelectTrigger aria-invalid={fieldState.invalid}>
                                                    <SelectValue placeholder="Select Skills module role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">None</SelectItem>
                                                    <SelectItem value="skills-admin">
                                                        Skills Admin
                                                    </SelectItem>
                                                    <SelectItem value="skills-assessor">
                                                        Skills Assessor
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            )}
                            {organization.settings.modules["skill-package-builder"].enabled && (
                                <Controller
                                    name="skillPackageRole"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field orientation="responsive">
                                            <FieldLabel>Skill Package Builder Module</FieldLabel>
                                            <Select
                                                value={field.value ?? "NONE"}
                                                onValueChange={(newValue) =>
                                                    field.onChange(
                                                        newValue === "NONE" ? null : newValue,
                                                    )
                                                }
                                            >
                                                <SelectTrigger aria-invalid={fieldState.invalid}>
                                                    <SelectValue placeholder="Select Skill Package module role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">None</SelectItem>
                                                    <SelectItem value="skill-package-author">
                                                        Skill Package Author
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            )}
                        </Show>

                        <Field orientation="horizontal">
                            <MutationButton
                                type="submit"
                                form="create-invitation-form"
                                status={mutation.status}
                                text={{
                                    idle: "Send",
                                    pending: "Sending",
                                    success: "Sent",
                                }}
                            />
                            <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                        </Field>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
