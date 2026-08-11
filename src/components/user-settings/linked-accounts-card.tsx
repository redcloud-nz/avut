/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Link2Icon, Link2OffIcon } from "lucide-react";

import { SiApple, SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";

export function LinkedAccounts_Card({ linkedAccounts }: { linkedAccounts: string[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Linked Accounts</CardTitle>
            </CardHeader>
            <CardContent>
                <LinkedAccount providerId="github" isLinked={linkedAccounts.includes("github")} />
                <LinkedAccount providerId="google" isLinked={linkedAccounts.includes("google")} />
            </CardContent>
        </Card>
    );
}

const providerIcons = {
    github: SiGithub,
    google: SiGoogle,
    apple: SiApple,
};

function LinkedAccount({
    providerId,
    isLinked,
}: {
    providerId: "github" | "google" | "apple";
    isLinked: boolean;
}) {
    const IconComponent = providerIcons[providerId];

    return (
        <Item>
            <ItemMedia>
                <IconComponent />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>{providerId.charAt(0).toUpperCase() + providerId.slice(1)}</ItemTitle>
                <ItemDescription>
                    {isLinked
                        ? "Linked"
                        : `Link your ${providerId.charAt(0).toUpperCase() + providerId.slice(1)} account`}
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                {isLinked ? (
                    <Button variant="outline">
                        <Link2OffIcon /> Unlink
                    </Button>
                ) : (
                    <Button variant="outline">
                        <Link2Icon /> Link
                    </Button>
                )}
            </ItemActions>
        </Item>
    );
}
