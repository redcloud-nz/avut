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
import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";

/**
 * The role half of any invitation/role-assignment form. Every membership carries a freely
 * combinable, non-empty set of roles (`owner` excluded — see `makeOwner`/`removeOwner`), so
 * every dialog that assigns roles shares this shape.
 */
export const invitationRolesSchema = z.object({
    roles: OrganizationRole.assignmentSchema,
});

export type InvitationRolesFormValues = z.infer<typeof invitationRolesSchema>;

/** The roles a role-assignment form submits. */
export function invitationRoles(values: InvitationRolesFormValues): OrganizationRole[] {
    return values.roles;
}

/**
 * The roles gated on an organization module being enabled, and whether each is currently
 * available. `admin`/`member` are always available and don't appear here.
 */
export type ModuleGatedRoleOptions = readonly {
    role: OrganizationRole;
    enabled: boolean;
}[];

/**
 * Primary-role radios and secondary-role checkboxes for an invitation form.
 *
 * Reached through `useFormContext` rather than a `control` prop so it can sit inside forms with
 * different overall shapes (the Invitations page adds an email field; the person page does not)
 * without generic plumbing — the caller wraps its `useForm` in a `<FormProvider>`.
 *
 * The specialty roles are gated on the module that grants them being enabled, so an org that
 * does not run I3, Skill Track or the Skill Package Builder never offers their roles.
 */
export function InvitationRoleFields() {
    const organization = useOrganization();

    return (
        <RoleFields
            moduleGatedRoles={[
                { role: "i3-editor", enabled: organization.settings.modules.i3.enabled },
                { role: "i3-admin", enabled: organization.settings.modules.i3.enabled },
                {
                    role: "skills-assessor",
                    enabled: organization.settings.modules["skill-track"].enabled,
                },
                {
                    role: "skills-admin",
                    enabled: organization.settings.modules["skill-track"].enabled,
                },
                {
                    role: "skills-reporter",
                    enabled: organization.settings.modules["skill-track"].enabled,
                },
                {
                    role: "skills-author",
                    enabled: organization.settings.modules["skill-package-builder"].enabled,
                },
            ]}
        />
    );
}

/**
 * The role fields themselves, with no dependency on an organization provider — the caller says
 * which module-gated roles are available. `InvitationRoleFields` supplies them from the current
 * organization's settings; the system-admin screens, which sit outside any one organization,
 * supply them from the organization they are acting on.
 *
 * A single flat multi-select over every role — `admin` and `member` are no longer mutually
 * exclusive, so both can be checked at once; the only invariant is at least one role checked
 * (`OrganizationRole.assignmentSchema`'s non-empty refinement). `owner` is never offered here —
 * it's granted/revoked separately (see `makeOwner`/`removeOwner`).
 */
export function RoleFields({ moduleGatedRoles }: { moduleGatedRoles: ModuleGatedRoleOptions }) {
    const { control } = useFormContext<InvitationRolesFormValues>();

    const gated = new Map(moduleGatedRoles.map(({ role, enabled }) => [role, enabled]));

    return (
        <Controller
            name="roles"
            control={control}
            render={({ field, fieldState }) => (
                <>
                    <FieldLegend variant="label">Roles</FieldLegend>
                    {OrganizationRole.values.map((role) => (
                        <Show key={role} when={gated.get(role) ?? true}>
                            <Field orientation="horizontal">
                                <Checkbox
                                    id={`role-${role}`}
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
                                    <FieldLabel htmlFor={`role-${role}`}>
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
    );
}
