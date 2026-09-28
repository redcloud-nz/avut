/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { toast } from "sonner";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    LinkedAccount,
    linkedAccountsQueryOptions,
    linkSocialMutationOptions,
    SessionNotFreshError,
    unlinkAccountMutationOptions,
} from "@/client/auth-queries";
import { SocialProvider, SocialProviders } from "@/components/auth/social-providers";
import { Alert } from "@/components/ui/alert";
import { MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogger } from "@/hooks/use-logger";
import { authQueryKeys } from "@/lib/auth-query-keys";

export function UserSettings_LinkedAccounts_Card() {
    const accountsQuery = useQuery(linkedAccountsQueryOptions());

    return (
        <Card>
            <CardHeader>
                <CardTitle>Linked Accounts</CardTitle>
            </CardHeader>
            <CardContent>
                {accountsQuery.isPending ? (
                    SocialProviders.map((provider) => <RowSkeleton key={provider.id} />)
                ) : accountsQuery.isError ? (
                    <Alert variant="error">
                        Failed to load linked accounts: {accountsQuery.error.message}
                    </Alert>
                ) : (
                    SocialProviders.map((provider) => (
                        <LinkedAccount_Item
                            key={provider.id}
                            provider={provider}
                            account={accountsQuery.data.find(
                                (account) => account.providerId === provider.id,
                            )}
                            // Better Auth refuses to unlink a user's last remaining account,
                            // so the button is disabled rather than left to fail on click.
                            canUnlink={accountsQuery.data.length > 1}
                        />
                    ))
                )}
            </CardContent>
        </Card>
    );
}

function RowSkeleton() {
    return (
        <Item>
            <ItemMedia>
                <Skeleton className="size-6 rounded-md" />
            </ItemMedia>
            <ItemContent>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-1 h-3 w-40" />
            </ItemContent>
        </Item>
    );
}

function LinkedAccount_Item({
    provider,
    account,
    canUnlink,
}: {
    provider: SocialProvider;
    account: LinkedAccount | undefined;
    canUnlink: boolean;
}) {
    const logger = useLogger("Common", "LinkedAccounts_Card");
    const queryClient = useQueryClient();

    const linkMutation = useMutation({
        ...linkSocialMutationOptions(),
        onError(error: Error) {
            logger.error(`Failed to link ${provider.name} account`, error);
            toast.error(error.message);
        },
        onSuccess(data) {
            // The client navigates on its own when it can; fall back to a manual redirect.
            if (data && "url" in data && typeof data.url === "string") {
                window.location.href = data.url;
            }
        },
    });

    const unlinkMutation = useMutation({
        ...unlinkAccountMutationOptions(),
        onError(error: Error) {
            // A stale session is expected and explained inline, not shouted about.
            if (error instanceof SessionNotFreshError) return;

            logger.error(`Failed to unlink ${provider.name} account`, error);
            toast.error(error.message);
        },
        async onSuccess() {
            await queryClient.invalidateQueries({ queryKey: authQueryKeys.linkedAccounts });
            toast.success(`Unlinked your ${provider.name} account.`);
        },
    });

    const { Icon } = provider;

    return (
        <>
            <Item>
                <ItemMedia>
                    <Icon />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle>{provider.name}</ItemTitle>
                    <ItemDescription>
                        {account ? "Linked" : `Link your ${provider.name} account`}
                    </ItemDescription>
                </ItemContent>
                <ItemActions>
                    {account ? (
                        <MutationButton
                            variant="outline"
                            status={unlinkMutation.status}
                            text={{ idle: "Unlink", pending: "Unlinking", success: "Unlinked" }}
                            disabled={!canUnlink}
                            title={
                                canUnlink
                                    ? undefined
                                    : "You can't unlink your only sign-in method. Set a password or link another provider first."
                            }
                            onClick={() =>
                                unlinkMutation.mutate({
                                    accountId: account.id,
                                    providerName: provider.name,
                                })
                            }
                        />
                    ) : (
                        <MutationButton
                            variant="outline"
                            status={linkMutation.status}
                            text={{ idle: "Link", pending: "Redirecting", success: "Redirecting" }}
                            onClick={() =>
                                linkMutation.mutate({
                                    provider: provider.id,
                                    providerName: provider.name,
                                    callbackURL: window.location.href,
                                })
                            }
                        />
                    )}
                </ItemActions>
            </Item>
            {unlinkMutation.error instanceof SessionNotFreshError && (
                <Alert variant="warning">
                    For security, unlinking an account needs a recent sign-in. Sign out and sign
                    back in, then try again.
                </Alert>
            )}
        </>
    );
}
