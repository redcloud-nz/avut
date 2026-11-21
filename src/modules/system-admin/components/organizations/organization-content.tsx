/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { UserLink } from "@/components/entity-links/user-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { isModuleUsable, type ModuleFlagState } from "@/lib/module-flags";
import { Modules, type ModuleId } from "@/lib/modules";
import { hasOwnerRole } from "@/lib/permissions";
import { route } from "@/lib/routes";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationGroupMembershipStatus,
    OrganizationGroupRole,
} from "@/lib/schemas/organization-group";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

import { SystemAdmin_AddMember_Dialog } from "./add-member-dialog";
import { SystemAdmin_MemberActionsMenu } from "./member-actions-menu";

const RECORD_COUNT_LABELS: Record<string, string> = {
    personnel: "Personnel",
    skillChecks: "Skill checks",
    skillCheckSessions: "Skill check sessions",
    notes: "Notes",
    skillPackages: "Skill packages",
    formInstances: "Form submissions",
};

export function SystemAdmin_Organization_Content({
    organizationId,
    moduleFlags,
}: {
    organizationId: OrganizationId;
    moduleFlags: ModuleFlagState;
}) {
    const { data: organization } = useSuspenseQuery(
        trpc.organizations.getOrganizationAsAdmin.queryOptions({ organizationId }),
    );

    const { data: groupMemberships } = useSuspenseQuery(
        trpc.organizationGroups.listGroupsForOrganization.queryOptions({ organizationId }),
    );

    // Which specialty roles are offered follows the organization's enabled modules and the
    // modules' Vercel flags, as it does for the organization's own admins.
    const moduleGatedRoles = OrganizationRole.moduleGatedOptions((id) =>
        isModuleUsable(moduleFlags, id, (moduleId) =>
            organization.enabledModules.includes(moduleId),
        ),
    );
    const ownerCount = organization.members.filter((m) => hasOwnerRole(m.role)).length;
    const groupsHeadingId = useId();
    const recordCountsHeadingId = useId();

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[{ label: "Organizations", href: "/system/admin/organizations" }]}
            />
            <Saratoga.Header>
                <Saratoga.Title>{organization.name}</Saratoga.Title>
                <Saratoga.Actions>
                    <Button asChild variant="outline">
                        <Link
                            href={route("/system/admin/organizations/[organizationId]/settings", {
                                organizationId,
                            })}
                        >
                            Settings
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="icon" title="Open in-org admin">
                        <Link href={route("/orgs/[slug]/admin", { slug: organization.slug })}>
                            <ExternalLinkIcon />
                            <span className="sr-only">Open in-org admin</span>
                        </Link>
                    </Button>
                </Saratoga.Actions>
            </Saratoga.Header>

            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard label="Organisation">
                        <CardContent>
                            <DataList>
                                <RecordCardId label="Organisation ID" id={organization.id} />
                                <DataItem>
                                    <DataItemTitle>Name</DataItemTitle>
                                    <DataItemValue>{organization.name}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Slug</DataItemTitle>
                                    <DataItemValue className="font-mono">
                                        {organization.slug}
                                    </DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </RecordCard>

                    <Card>
                        <CardHeader>
                            <CardTitle>Members</CardTitle>
                            <div className="ml-auto">
                                <SystemAdmin_AddMember_Dialog
                                    organizationId={organizationId}
                                    memberUserIds={organization.members.map((m) => m.userId)}
                                    moduleGatedRoles={moduleGatedRoles}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {ownerCount === 0 && (
                                <Alert variant="warning">
                                    <AlertTitle>No owner</AlertTitle>
                                    <AlertDescription>
                                        Nobody in this organisation can manage its owners. Use
                                        &ldquo;Make owner&rdquo; on a member to appoint one.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {organization.members.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No members.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground">
                                            <th className="py-1 pr-4 font-medium">Name</th>
                                            <th className="py-1 pr-4 font-medium">Email</th>
                                            <th className="py-1 font-medium">Role</th>
                                            <th className="py-1" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {organization.members.map((member) => (
                                            <tr key={member.userId} className="border-t">
                                                <td className="py-1 pr-4">
                                                    <UserLink
                                                        user={{
                                                            id: UserId.schema.parse(member.userId),
                                                            name: member.name,
                                                            email: member.email,
                                                        }}
                                                    />
                                                </td>
                                                <td className="py-1 pr-4">{member.email}</td>
                                                <td className="py-1">
                                                    <div className="flex flex-wrap gap-1">
                                                        {member.role.split(",").map((role) => (
                                                            <Badge key={role} variant="secondary">
                                                                {OrganizationRole.formatList(role)}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-1 text-right">
                                                    <SystemAdmin_MemberActionsMenu
                                                        organizationId={organizationId}
                                                        member={member}
                                                        isLastOwner={
                                                            ownerCount === 1 &&
                                                            hasOwnerRole(member.role)
                                                        }
                                                        moduleGatedRoles={moduleGatedRoles}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Teams</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {organization.teams.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No teams.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground">
                                            <th className="py-1 pr-4 font-medium">Name</th>
                                            <th className="py-1 text-center font-medium">
                                                Members
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {organization.teams.map((team) => (
                                            <tr key={team.id} className="border-t">
                                                <td className="py-1 pr-4">{team.name}</td>
                                                <td className="py-1 text-center tabular-nums">
                                                    {team.memberCount}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                </Saratoga.Column>

                <Saratoga.Column slot="secondary">
                    <section aria-labelledby={groupsHeadingId} className="space-y-2">
                        <div className="flex min-h-8 items-center justify-between gap-2 pl-1">
                            <h2 id={groupsHeadingId} className="text-base font-medium">
                                Groups
                            </h2>
                        </div>
                        {groupMemberships.length === 0 ? (
                            <p className="pl-1 text-sm text-muted-foreground">Not in any group.</p>
                        ) : (
                            <ItemGroup className="gap-2">
                                {groupMemberships.map((membership) => (
                                    <Item
                                        key={membership.id}
                                        variant="outline"
                                        role="listitem"
                                        asChild
                                    >
                                        <Link
                                            href={route("/system/admin/groups/[groupId]", {
                                                groupId: membership.group.id,
                                            })}
                                        >
                                            <ItemContent>
                                                <ItemTitle>{membership.group.name}</ItemTitle>
                                                <ItemDescription>
                                                    {
                                                        OrganizationGroupRole.displayNames[
                                                            membership.role
                                                        ]
                                                    }
                                                    {membership.status !== "Active" &&
                                                        ` · ${OrganizationGroupMembershipStatus.displayNames[membership.status]}`}
                                                </ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                <ChevronRightIcon
                                                    aria-hidden
                                                    className="size-4 text-muted-foreground"
                                                />
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                ))}
                            </ItemGroup>
                        )}
                    </section>

                    <Card>
                        <CardHeader>
                            <CardTitle>Enabled Modules</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {organization.enabledModules.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No modules enabled.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {organization.enabledModules.map((moduleId: ModuleId) => (
                                        <Badge key={moduleId} variant="secondary">
                                            {Modules[moduleId].label}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <section aria-labelledby={recordCountsHeadingId} className="space-y-2">
                        <div className="flex min-h-8 items-center pl-1">
                            <h2 id={recordCountsHeadingId} className="text-base font-medium">
                                Record Counts
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(organization.recordCounts).map(([key, count]) => (
                                <Metric
                                    key={key}
                                    label={RECORD_COUNT_LABELS[key] ?? key}
                                    value={count}
                                />
                            ))}
                            <Metric label="D4H access tokens" value={organization.d4hTokenCount} />
                        </div>
                    </section>
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}

/** A compact count tile: the number over a small muted label. */
function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-2xl leading-tight font-semibold tabular-nums">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}
