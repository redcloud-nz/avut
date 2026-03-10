/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, Watch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ExternalLink, Link } from "@/components/ui/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { D4HServerList } from "@/lib/d4h-api/servers";
import {
    D4HAccessToken,
    D4hAccessTokenId,
} from "@/lib/schemas/d4h-access-token";
import { OrganizationData } from "@/lib/schemas/organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface CreateD4hAccessTokenFormProps {
    organization: OrganizationData;
}

export function AdminModule_CreateD4hAccessToken_Form({
    organization,
}: CreateD4hAccessTokenFormProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            D4HAccessToken.schema
                .pick({
                    label: true,
                    serverCode: true,
                })
                .extend({ token: z.string() }),
        ),
        defaultValues: {
            label: "",
            serverCode: "ap" as const,
            token: "",
        },
    });

    const createTokenMutation = useMutation(
        trpc.d4hAccessTokens.createOrganizationAccessToken.mutationOptions({
            onError(error) {
                console.error("Error creating D4H access token:", error);
                toast.error(
                    `Failed to create D4H access token: ${error.message || "Unknown error"}`,
                );
            },
            async onSuccess({ created }) {
                await queryClient.invalidateQueries(
                    trpc.d4hAccessTokens.listOrganizationAccessTokens.queryFilter(
                        {
                            organizationId: organization.id,
                        },
                    ),
                );

                router.push(
                    Paths.main(organization.slug).admin.d4hAccessToken(
                        created.id,
                    ).href,
                );
            },
        }),
    );

    const handleCreate = form.handleSubmit((formData) => {
        createTokenMutation.mutate({
            organizationId: organization.id,
            tokenId: D4hAccessTokenId.create(),
            create: formData,
        });
    });

    return (
        <form id="create-d4h-access-token-form" onSubmit={handleCreate}>
            <FieldGroup>
                <Controller
                    name="serverCode"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldLabel htmlFor="access-token-server-code">
                                D4H Server
                            </FieldLabel>
                            <Select {...field}>
                                <SelectTrigger
                                    id="access-token-server-code"
                                    className="min-w-1/2"
                                    aria-invalid={fieldState.invalid}
                                >
                                    <SelectValue placeholder="Select D4H server" />
                                </SelectTrigger>
                                <SelectContent>
                                    {D4HServerList.map((server) => (
                                        <SelectItem
                                            key={server.code}
                                            value={server.code}
                                        >
                                            {server.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Watch
                    control={form.control}
                    names={["serverCode"]}
                    render={([serverCode]) => {
                        const server = D4HServerList.find(
                            (s) => s.code === serverCode,
                        );

                        return server ? (
                            <div className="text-xs/relaxed text-muted-foreground">
                                Create your D4H access token at:{" "}
                                <ExternalLink
                                    className="text-xs pl-1"
                                    href={server?.tokensUrl}
                                >
                                    {server?.tokensUrl}
                                </ExternalLink>
                            </div>
                        ) : null;
                    }}
                />

                <FieldSeparator />

                <Controller
                    name="label"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldLabel htmlFor="access-token-label">
                                Label
                            </FieldLabel>
                            <Input
                                id="access-token-label"
                                placeholder="e.g. My Access Tokens"
                                aria-invalid={fieldState.invalid}
                                className="min-w-1/2"
                                {...field}
                            />
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="token"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="access-token">
                                Token
                            </FieldLabel>
                            <Textarea
                                id="access-token"
                                aria-invalid={fieldState.invalid}
                                placeholder="Your D4H API token"
                                {...field}
                            />
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Field orientation="horizontal">
                    <MutationButton
                        type="submit"
                        form="create-d4h-access-token-form"
                        status={createTokenMutation.status}
                        text={{
                            idle: "Create",
                            pending: "Creating",
                            success: "Created",
                        }}
                    />
                    <Show when={createTokenMutation.isIdle}>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => form.reset()}
                            asChild
                        >
                            <Link
                                to={
                                    Paths.main(organization.slug).admin
                                        .d4hAccessTokens
                                }
                            >
                                Cancel
                            </Link>
                        </Button>
                    </Show>
                </Field>
            </FieldGroup>
        </form>
    );
}
