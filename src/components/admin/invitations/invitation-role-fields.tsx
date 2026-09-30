/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Controller, useFormContext } from "react-hook-form";
import * as z from "zod";

import { Show } from "@/components/show";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { useOrganization } from "@/hooks/use-organization";
import { roleCovers, type Role } from "@/lib/permissions";
import { OrganizationRole, type ModuleGatedRoleOptions } from "@/lib/schemas/organization-role";

/**
 * The role half of any invitation/role-assignment form. Every membership carries a freely
 * combinable, non-empty set of roles (`owner` excluded — see `makeOwner`/`removeOwner`), so
 * every dialog that assigns roles shares this shape.
 */
export const invitationRolesSchema = z.object({
    roles: OrganizationRole.assignmentSchema,
});

export type InvitationRolesFormValues = z.infer<typeof invitationRolesSchema>;

/**
 * The role form schema for editing an existing member. An owner may hold no other role —
 * `owner` alone is a valid membership, and the picker shows Admin and Member as covered by it —
 * so the non-empty rule applies only to everyone else.
 */
export function memberRolesSchema(isOwner: boolean) {
    return isOwner ? z.object({ roles: OrganizationRole.roleSetSchema }) : invitationRolesSchema;
}

/** The roles a role-assignment form submits. */
export function invitationRoles(values: InvitationRolesFormValues): OrganizationRole[] {
    return values.roles;
}

/**
 * Primary-role radios and secondary-role checkboxes for an invitation form.
 *
 * Reached through `useFormContext` rather than a `control` prop so it can sit inside forms with
 * different overall shapes (the Invitations page adds an email field; the person page does not)
 * without generic plumbing — the caller wraps its `useForm` in a `<FormProvider>`.
 *
 * The specialty roles are gated on the module that grants them being enabled, so an org that
 * does not run I3, Skill Track or the Skill Package Builder never offers their roles — via
 * `organization.isModuleEnabled`, which also accounts for the module's Vercel flag (a module an
 * org has toggled on in its settings can still be unavailable for the deployment).
 */
export function InvitationRoleFields() {
    const organization = useOrganization();

    return (
        <RoleFields
            moduleGatedRoles={OrganizationRole.moduleGatedOptions((id) =>
                organization.isModuleEnabled(id),
            )}
        />
    );
}

/** `roles` with `role` checked or unchecked; checking it drops any role it covers. */
function withRole(
    roles: OrganizationRole[],
    role: OrganizationRole,
    checked: boolean,
): OrganizationRole[] {
    return checked
        ? [...roles.filter((r) => !roleCovers(role, r)), role]
        : roles.filter((r) => r !== role);
}

/**
 * The role fields themselves, with no dependency on an organization provider — the caller says
 * which module-gated roles are available. `InvitationRoleFields` supplies them from the current
 * organization's settings; the system-admin screens, which sit outside any one organization,
 * supply them from the organization they are acting on.
 *
 * A multi-select over every role, in one card per `OrganizationRole.groups` entry (a module
 * with none of its roles available is left out). The only invariant is at least one role
 * checked (`OrganizationRole.assignmentSchema`'s non-empty refinement), which an owner is exempt
 * from (see `memberRolesSchema`). `owner` is never offered here — it's granted/revoked separately
 * (see `makeOwner`/`removeOwner`) — but `isOwner` counts it towards what the member already holds.
 *
 * A role another held role already covers (`roleCovers` — Skills Admin covers Skills Assessor,
 * Owner covers Admin) shows checked and disabled, since holding it adds nothing; checking a
 * role drops any role it covers from the value.
 */
export function RoleFields({
    moduleGatedRoles,
    isOwner = false,
}: {
    moduleGatedRoles: ModuleGatedRoleOptions;
    isOwner?: boolean;
}) {
    const { control } = useFormContext<InvitationRolesFormValues>();

    const gated = new Map(moduleGatedRoles.map(({ role, enabled }) => [role, enabled]));
    const isOffered = (role: OrganizationRole) => gated.get(role) ?? true;

    return (
        <Controller
            name="roles"
            control={control}
            render={({ field, fieldState }) => {
                const held: Role[] = isOwner ? ["owner", ...field.value] : field.value;
                const coveredBy = (role: OrganizationRole) =>
                    held.find((other) => other !== role && roleCovers(other, role));

                return (
                    <>
                        {OrganizationRole.groups.map((group) => (
                            <Show key={group.title} when={group.roles.some(isOffered)}>
                                <Card
                                    size="sm"
                                    // Clear the scrolling `DialogBody`'s top edge, which
                                    // otherwise clips the ring when this card leads the dialog.
                                    className="first:mt-px"
                                    role="group"
                                    aria-labelledby={`role-group-${group.moduleId ?? "organisation"}`}
                                >
                                    <CardHeader>
                                        <CardTitle
                                            id={`role-group-${group.moduleId ?? "organisation"}`}
                                        >
                                            {group.title}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <FieldGroup className="gap-4">
                                            {group.roles.filter(isOffered).map((role) => {
                                                const coveringRole = coveredBy(role);
                                                return (
                                                    <Field
                                                        key={role}
                                                        orientation="horizontal"
                                                        data-disabled={!!coveringRole}
                                                    >
                                                        <Checkbox
                                                            id={`role-${role}`}
                                                            checked={
                                                                !!coveringRole ||
                                                                field.value.includes(role)
                                                            }
                                                            disabled={!!coveringRole}
                                                            onCheckedChange={(checked) =>
                                                                field.onChange(
                                                                    withRole(
                                                                        field.value,
                                                                        role,
                                                                        checked === true,
                                                                    ),
                                                                )
                                                            }
                                                        />
                                                        <FieldContent>
                                                            <FieldLabel htmlFor={`role-${role}`}>
                                                                {
                                                                    OrganizationRole.roles[role]
                                                                        .displayName
                                                                }
                                                            </FieldLabel>
                                                            <FieldDescription>
                                                                {coveringRole
                                                                    ? `Included in ${OrganizationRole.displayNames[coveringRole]}.`
                                                                    : OrganizationRole.roles[role]
                                                                          .description}
                                                            </FieldDescription>
                                                        </FieldContent>
                                                    </Field>
                                                );
                                            })}
                                        </FieldGroup>
                                    </CardContent>
                                </Card>
                            </Show>
                        ))}
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                    </>
                );
            }}
        />
    );
}
