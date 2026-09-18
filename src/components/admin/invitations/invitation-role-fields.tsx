/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Controller, useFormContext } from "react-hook-form";
import * as z from "zod";

import { Show } from "@/components/show";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
    FieldLegend,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";

/**
 * The role half of any invitation form. Every invitation carries exactly one primary role plus
 * any number of secondary roles, so both dialogs that send invitations share this shape.
 */
export const invitationRolesSchema = z.object({
    primaryRole: OrganizationRole.primaryRoleSchema,
    secondaryRoles: z.array(OrganizationRole.secondaryRoleSchema),
});

export type InvitationRolesFormValues = z.infer<typeof invitationRolesSchema>;

/** The roles an invitation form submits: the primary first, then the secondaries. */
export function invitationRoles(values: InvitationRolesFormValues): OrganizationRole[] {
    return [values.primaryRole, ...values.secondaryRoles];
}

const PRIMARY_ROLES = ["owner", "admin", "member"] as const;

/**
 * Primary-role radios and secondary-role checkboxes for an invitation form.
 *
 * Reached through `useFormContext` rather than a `control` prop so it can sit inside forms with
 * different overall shapes (the Invitations page adds an email field; the person page does not)
 * without generic plumbing — the caller wraps its `useForm` in a `<FormProvider>`.
 *
 * Secondary roles are gated on the module that grants them being enabled, so an org that does not
 * run I3, Skill Track or the Skill Package Builder never offers their roles.
 */
export function InvitationRoleFields() {
    const organization = useOrganization();
    const { control } = useFormContext<InvitationRolesFormValues>();

    const secondaryRoles = [
        { role: "i3-editor", enabled: organization.settings.modules.i3.enabled },
        {
            role: "skills-assessor",
            enabled: organization.settings.modules["skill-track"].enabled,
        },
        {
            role: "skill-package-author",
            enabled: organization.settings.modules["skill-package-builder"].enabled,
        },
    ] as const;

    return (
        <>
            <Controller
                name="primaryRole"
                control={control}
                render={({ field, fieldState }) => (
                    <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="w-fit"
                    >
                        <FieldLegend variant="label">Primary Role</FieldLegend>
                        {PRIMARY_ROLES.map((role) => (
                            <Field key={role} orientation="horizontal">
                                <RadioGroupItem value={role} id={`primary-role-${role}`} />
                                <FieldContent>
                                    <FieldLabel htmlFor={`primary-role-${role}`}>
                                        {OrganizationRole.roles[role].displayName}
                                    </FieldLabel>
                                    <FieldDescription>
                                        {OrganizationRole.roles[role].description}
                                    </FieldDescription>
                                </FieldContent>
                            </Field>
                        ))}
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                    </RadioGroup>
                )}
            />
            <Controller
                name="secondaryRoles"
                control={control}
                render={({ field, fieldState }) => (
                    <>
                        <FieldLegend variant="label">Secondary Roles</FieldLegend>
                        {secondaryRoles.map(({ role, enabled }) => (
                            <Show key={role} when={enabled}>
                                <Field orientation="horizontal">
                                    <Checkbox
                                        id={`secondary-role-${role}`}
                                        checked={field.value.includes(role)}
                                        onCheckedChange={(checked) =>
                                            field.onChange(
                                                checked
                                                    ? [...field.value, role]
                                                    : field.value.filter((r) => r !== role),
                                            )
                                        }
                                    />
                                    <FieldContent>
                                        <FieldLabel htmlFor={`secondary-role-${role}`}>
                                            {OrganizationRole.roles[role].displayName}
                                        </FieldLabel>
                                        <FieldDescription>
                                            {OrganizationRole.roles[role].description}
                                        </FieldDescription>
                                    </FieldContent>
                                </Field>
                            </Show>
                        ))}
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                    </>
                )}
            />
        </>
    );
}
