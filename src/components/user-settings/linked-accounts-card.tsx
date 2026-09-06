/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { toast } from "sonner";

import { SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
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
import { useLogger } from "@/hooks/use-logger";

/** Social providers configured in `src/server/auth.ts`. */
const SocialProviders = [
    { id: "github", name: "GitHub", Icon: SiGithub },
    { id: "google", name: "Google", Icon: SiGoogle },
] as const;

type SocialProviderId = (typeof SocialProviders)[number]["id"];

export function LinkedAccounts_Card({ linkedAccounts }: { linkedAccounts: string[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Linked Accounts</CardTitle>
            </CardHeader>
            <CardContent>
                {SocialProviders.map((provider) => (
                    <LinkedAccount
                        key={provider.id}
                        provider={provider}
                        isLinked={linkedAccounts.includes(provider.id)}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

function LinkedAccount({
    provider,
    isLinked,
}: {
    provider: { id: SocialProviderId; name: string; Icon: typeof SiGithub };
    isLinked: boolean;
}) {
    const logger = useLogger("Common", "LinkedAccounts_Card");
    const queryClient = useQueryClient();

    const linkMutation = useMutation({
        async mutationFn() {
            const { data, error } = await authClient.linkSocial({
                provider: provider.id,
                callbackURL: window.location.href,
            });
            if (error) throw new Error(error.message ?? "Failed to link account");
            // The client redirects automatically when it can; fall back to a manual redirect.
            if (data && "url" in data && typeof data.url === "string") {
                window.location.href = data.url;
            }
        },
        onError(error: Error) {
            logger.error(`Failed to link ${provider.name} account`, error);
            toast.error(`Failed to link ${provider.name} account: ${error.message}`);
        },
    });

    const unlinkMutation = useMutation({
        async mutationFn() {
            const { error } = await authClient.unlinkAccount({ providerId: provider.id });
            if (error) throw new Error(error.message ?? "Failed to unlink account");
        },
        onError(error: Error) {
            logger.error(`Failed to unlink ${provider.name} account`, error);
            toast.error(`Failed to unlink ${provider.name} account: ${error.message}`);
        },
        async onSuccess() {
            await queryClient.invalidateQueries({ queryKey: ["user", "linkedAccounts"] });
            toast.success(`Unlinked ${provider.name} account`);
        },
    });

    const { Icon } = provider;

    return (
        <Item>
            <ItemMedia>
                <Icon />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>{provider.name}</ItemTitle>
                <ItemDescription>
                    {isLinked ? "Linked" : `Link your ${provider.name} account`}
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                {isLinked ? (
                    <MutationButton
                        variant="outline"
                        status={unlinkMutation.status}
                        text={{ idle: "Unlink", pending: "Unlinking", success: "Unlinked" }}
                        onClick={() => unlinkMutation.mutate()}
                    />
                ) : (
                    <MutationButton
                        variant="outline"
                        status={linkMutation.status}
                        text={{ idle: "Link", pending: "Redirecting", success: "Redirecting" }}
                        onClick={() => linkMutation.mutate()}
                    />
                )}
            </ItemActions>
        </Item>
    );
}
