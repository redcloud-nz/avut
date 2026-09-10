/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation, useQuery } from "@tanstack/react-query";

import { D4HIcons, DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { teamsEffects } from "@/client/teams-effects";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function AdminModule_OrganizationMenu({ slug }: { slug: string }) {
    const organization = useOrganization();
    const d4hEnabled = organization.settings.integrations.d4h.enabled;
    const canUpdate = useHasPermission({ organization: ["update"] });

    const { data: orgD4H } = useQuery(
        trpc.teams.getOrganizationD4H.queryOptions(
            { organizationId: organization.id },
            { enabled: d4hEnabled },
        ),
    );

    const [, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["d4h-org-unlink"] as const),
    );

    const syncMutation = useMutation(
        trpc.teams.syncOrganizationD4H.mutationOptions({
            meta: { effects: teamsEffects.syncOrganizationD4H },
            onError: (error) => toast.error(`Sync failed: ${error.message}`),
            onSuccess: () => toast.success("D4H organisation details refreshed"),
        }),
    );

    const linked = orgD4H != null;
    const canSyncOrg = linked && orgD4H.d4hOrganisationId != null && orgD4H.linkedTeamCount > 0;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <DropdownMenuTriggerIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem disabled={!canUpdate} asChild>
                    <Link href={route("/orgs/[slug]/admin/organization/--update", { slug })}>
                        <ObjectIcons.Edit /> Edit
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-destructive focus:text-destructive">
                    <ObjectIcons.Delete /> Delete
                </DropdownMenuItem>

                {d4hEnabled && (linked || canSyncOrg) && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>D4H</DropdownMenuLabel>
                        <DropdownMenuGroup>
                            {canSyncOrg && (
                                <DropdownMenuItem
                                    disabled={!canUpdate || syncMutation.isPending}
                                    onClick={() =>
                                        syncMutation.mutate({ organizationId: organization.id })
                                    }
                                >
                                    <D4HIcons.Sync /> Sync with D4H
                                </DropdownMenuItem>
                            )}
                            {linked && (
                                <DropdownMenuItem
                                    disabled={!canUpdate || orgD4H.linkedTeamCount > 0}
                                    className="text-destructive focus:text-destructive"
                                    onClick={() =>
                                        void setAction("d4h-org-unlink", { history: "push" })
                                    }
                                >
                                    <D4HIcons.Unlink /> Unlink from D4H
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
