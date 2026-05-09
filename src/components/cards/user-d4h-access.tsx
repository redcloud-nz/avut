/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import { Controller, useForm, Watch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { AlertIcons } from "@/components/icons";
import { Show } from "@/components/show";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { ExternalLink } from "@/components/ui/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { D4HServerCode, D4HServerList, getD4HServer } from "@/lib/d4h-servers";
import { D4HAccessTokenId } from "@/lib/schemas/d4h-access-token";
import { trpc } from "@/trpc/client";

export function UserD4HAccess_Card() {
    const organization = useOrganization();

    const { data: accessToken } = useSuspenseQuery(
        trpc.d4hAccessTokens.getPersonalAccessToken.queryOptions({
            organizationId: organization.id,
        }),
    );

    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>D4H Access Token</CardTitle>
                    <CardAction>
                        <Show when={accessToken != null}>
                            <PersonalD4HAccessToken_Remove_Button />
                        </Show>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <Show
                        when={organization.settings.integrations.d4h.enabled}
                        fallback={
                            <Alert variant="warning">
                                <AlertIcons.NotAllowed />
                                <AlertTitle>Integration Not Enabled</AlertTitle>
                                <AlertDescription>
                                    The D4H integration is not enabled for this organization. Please
                                    contact your administrator to enable it.
                                </AlertDescription>
                            </Alert>
                        }
                    >
                        {accessToken == null ? (
                            <Empty>
                                <EmptyHeader>
                                    <EmptyTitle>No Personal D4H Access</EmptyTitle>
                                    <EmptyDescription>
                                        You do not have a personal D4H access token configured.
                                        Please add one to access your D4H data in AVUT.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button onClick={() => setCreateDialogOpen(true)}>
                                        Add Access Token
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        ) : (
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Token ID</FieldLabel>
                                    <FieldValue value={accessToken.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Server</FieldLabel>
                                    <FieldValue
                                        value={getD4HServer(accessToken.serverCode)?.name!}
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Label</FieldLabel>
                                    <FieldValue value={accessToken.label} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Status</FieldLabel>
                                    <FieldValue value={accessToken.status} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue
                                        value={accessToken.createdAt}
                                        format="dateTimeWithDistance"
                                    />
                                </Field>
                            </FieldGroup>
                        )}
                    </Show>
                </CardContent>
            </Card>
            <PersonalD4HAccessToken_Add_Dialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />
        </>
    );
}

function PersonalD4HAccessToken_Remove_Button() {
    const logger = useLogger("Common", "PersonalD4HAccessToken_Remove_Button");
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.d4hAccessTokens.deletePersonalAccessToken.mutationOptions({
            onError(error) {
                logger.error("Failed to remove personal D4H access token", error);
                toast.error(`Failed to remove personal D4H access token: ${error.message}`);
            },
            onSuccess() {
                queryClient.invalidateQueries(
                    trpc.d4hAccessTokens.getPersonalAccessToken.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                mutation.reset();
            },
        }),
    );

    return (
        <MutationButton
            variant="outline"
            status={mutation.status}
            text={{
                idle: "Remove",
                pending: "Removing",
                success: "Removed",
            }}
            onClick={() =>
                mutation.mutate({
                    organizationId: organization.id,
                })
            }
        />
    );
}

/**
 * For dialog to add a personal D4H access token.
 */
function PersonalD4HAccessToken_Add_Dialog(props: DialogProps) {
    const logger = useLogger("Common", "PersonalD4HAccessToken_Add_Dialog");
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                serverCode: D4HServerCode.schema,
                token: z.string().nonempty("Token is required"),
            }),
        ),
        defaultValues: {
            serverCode: "ap" as const,
            token: "",
        },
    });

    const mutation = useMutation(
        trpc.d4hAccessTokens.createPersonalAccessToken.mutationOptions({
            onError(error) {
                logger.error("Error creating D4H access token:", error);
                toast.error(`Failed to create D4H access token: ${error.message}`);
            },
            async onSuccess({ created }) {
                await queryClient.invalidateQueries(
                    trpc.d4hAccessTokens.getPersonalAccessToken.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        props.onOpenChange?.(open);

        if (!open) {
            form.reset();
            mutation.reset();
        }
    }

    const handleSubmit = form.handleSubmit(
        (formData) => {
            const tokenId = D4HAccessTokenId.create();

            logger.log("Creating D4H Access Token", { tokenId, ...formData });

            mutation.mutate({
                organizationId: organization.id,
                tokenId,
                create: {
                    serverCode: formData.serverCode,
                    token: formData.token,
                },
            });
        },
        (error) => {
            logger.warn("Form validation failed", error);
        },
    );

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Personal D4H Access Token</DialogTitle>
                    <DialogDescription>
                        Allows you to connect to your D4H account from AVUT.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Controller
                        name="serverCode"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="responsive">
                                <FieldLabel htmlFor="access-token-server-code">
                                    D4H Server
                                </FieldLabel>
                                <Select {...field} onValueChange={field.onChange}>
                                    <SelectTrigger
                                        id="access-token-server-code"
                                        aria-invalid={fieldState.invalid}
                                    >
                                        <SelectValue placeholder="Select D4H server" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {D4HServerList.map((server) => (
                                            <SelectItem key={server.code} value={server.code}>
                                                {server.name}
                                                {organization.settings.integrations.d4h
                                                    .defaultServer == server.code && (
                                                    <span className="pl-1 text-muted-foreground">
                                                        Default
                                                    </span>
                                                )}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Watch
                        control={form.control}
                        names={["serverCode"]}
                        render={([serverCode]) => {
                            const server = D4HServerList.find((s) => s.code === serverCode);

                            return server ? (
                                <div className="text-xs/relaxed text-muted-foreground">
                                    Generate an D4H access token at:{" "}
                                    <ExternalLink className="text-xs pl-1" href={server?.tokensUrl}>
                                        {server?.tokensUrl}
                                    </ExternalLink>
                                </div>
                            ) : null;
                        }}
                    />
                    <FieldSeparator />
                    {/* <Controller
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
                    /> */}
                    <Controller
                        name="token"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="access-token">Token</FieldLabel>
                                <Textarea
                                    id="access-token"
                                    aria-invalid={fieldState.invalid}
                                    placeholder="Paste token here"
                                    {...field}
                                />
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                </FieldGroup>
                <DialogFooter>
                    <MutationButton
                        type="submit"
                        form="create-d4h-access-token-form"
                        status={mutation.status}
                        text={{
                            idle: "Create",
                            pending: "Creating",
                            success: "Created",
                        }}
                        onClick={handleSubmit}
                    />
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
