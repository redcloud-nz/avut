/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Building2Icon } from "lucide-react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { useSession } from "@/client/auth-queries";
import { Alert } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import { RainbowSpinner } from "@/components/ui/loading";

import { trpc } from "@/trpc/client";

export function UserOrganizationsSettings() {
    const queryClient = useQueryClient();
    const sessionQuery = useSession();

    const membershipsQuery = useQuery(trpc.users.listMemberships.queryOptions());

    const leaveMutation = useMutation({
        mutationFn: async (organizationId: string) => {
            await authClient.organization.leave({ organizationId });
        },
        onSuccess() {
            queryClient.invalidateQueries(trpc.users.listMemberships.queryFilter());
        },
    });

    if (!sessionQuery.data) {
        return <Alert variant="error">No user data available</Alert>;
    }

    if (membershipsQuery.isPending) {
        return (
            <div className="p-4">
                <RainbowSpinner className="mx-auto" />
            </div>
        );
    }
    if (membershipsQuery.isError) {
        return (
            <Alert variant="error">
                Failed to load organizations: {membershipsQuery.error.message}
            </Alert>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Organizations</CardTitle>
                </CardHeader>
                <CardContent>
                    {membershipsQuery.data.map((membership) => (
                        <Item key={membership.organization.id}>
                            <ItemMedia>
                                <Avatar className="size-12 rounded-full">
                                    {membership.organization.logo && (
                                        <AvatarImage
                                            src={membership.organization.logo}
                                            alt={membership.organization.name}
                                        />
                                    )}
                                    <AvatarFallback>
                                        <Building2Icon className="size-5" />
                                    </AvatarFallback>
                                </Avatar>
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle>
                                    {membership.organization.name}{" "}
                                    <Badge variant="secondary">{membership.roles.join(", ")}</Badge>
                                </ItemTitle>
                                <ItemDescription>{membership.organization.slug}</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">Leave</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Leave Organization</AlertDialogTitle>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <MutationButton
                                                type="button"
                                                variant="destructive"
                                                onClick={() =>
                                                    leaveMutation.mutate(membership.organization.id)
                                                }
                                                status={leaveMutation.status}
                                                text={{
                                                    idle: "Leave",
                                                    pending: "Leaving",
                                                    success: "Left",
                                                }}
                                            />
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </ItemActions>
                        </Item>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
