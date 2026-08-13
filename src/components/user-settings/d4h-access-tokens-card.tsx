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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ObjectIcons, PersonalD4HAccessTokensIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import { ExternalLink } from "@/components/ui/link";
import { RainbowSpinner } from "@/components/ui/loading";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useLogger } from "@/hooks/use-logger";
import { D4HServerCode, D4HServerList, getD4HServer } from "@/lib/d4h-servers";
import { D4HAccessTokenId } from "@/lib/schemas/d4h-access-token";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

export function D4HAccessTokens_Card() {
    const tokensQuery = useQuery(trpc.d4hAccessTokens.listPersonalAccessTokens.queryOptions());

    return (
        <Card>
            <CardHeader>
                <CardTitle>D4H Access Tokens</CardTitle>
                <CardAction>
                    <PersonalD4HAccessToken_Add_Dialog />
                </CardAction>
            </CardHeader>
            <CardContent>
                {tokensQuery.isPending && (
                    <div className="p-4">
                        <RainbowSpinner className="mx-auto" />
                    </div>
                )}
                {tokensQuery.isError && (
                    <Alert variant="error">
                        Failed to load access tokens: {tokensQuery.error.message}
                    </Alert>
                )}
                {tokensQuery.data?.length === 0 && (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <PersonalD4HAccessTokensIcon />
                            </EmptyMedia>
                            <EmptyTitle>No Personal D4H Access Tokens</EmptyTitle>
                            <EmptyDescription>
                                You do not have any personal D4H access tokens configured. Add one
                                to access your D4H data in AVUT.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
                {tokensQuery.data && tokensQuery.data.length > 0 && (
                    <div>
                        {tokensQuery.data.map((token) => (
                            <Item key={token.id}>
                                <ItemMedia>
                                    <PersonalD4HAccessTokensIcon className="size-5" />
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle>{token.organization.name}</ItemTitle>
                                    <ItemDescription>
                                        {getD4HServer(token.serverCode).name} &middot;{" "}
                                        {token.status}
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <PersonalD4HAccessToken_Remove_Button
                                        organizationId={token.organization.id}
                                    />
                                </ItemActions>
                            </Item>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PersonalD4HAccessToken_Remove_Button(props: { organizationId: OrganizationId }) {
    const logger = useLogger("Common", "PersonalD4HAccessToken_Remove_Button");
    const queryClient = useQueryClient();

    const [open, setOpen] = useState(false);

    const mutation = useMutation(
        trpc.d4hAccessTokens.deletePersonalAccessToken.mutationOptions({
            onError(error) {
                logger.error("Failed to remove personal D4H access token", error);
                toast.error(`Failed to remove personal D4H access token: ${error.message}`);
            },
            onSuccess() {
                queryClient.invalidateQueries(
                    trpc.d4hAccessTokens.listPersonalAccessTokens.queryFilter(),
                );
                mutation.reset();
                setOpen(false);
            },
        }),
    );

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive">Remove</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove D4H Access Token</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to remove this D4H access token? This cannot be
                        undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <MutationButton
                        variant="destructive"
                        status={mutation.status}
                        text={{
                            idle: "Remove",
                            pending: "Removing",
                            success: "Removed",
                        }}
                        onClick={() => mutation.mutate({ organizationId: props.organizationId })}
                    />
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * Dialog to add a personal D4H access token for one of the user's organizations.
 */
function PersonalD4HAccessToken_Add_Dialog() {
    const logger = useLogger("Common", "PersonalD4HAccessToken_Add_Dialog");
    const queryClient = useQueryClient();

    const [dialogOpen, setDialogOpen] = useState(false);

    const membershipsQuery = useQuery(trpc.users.listMemberships.queryOptions());

    const form = useForm({
        resolver: zodResolver(
            z.object({
                organizationId: OrganizationId.schema,
                serverCode: D4HServerCode.schema,
                token: z.string().nonempty("Token is required"),
            }),
        ),
        defaultValues: {
            organizationId: "" as OrganizationId,
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
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.d4hAccessTokens.listPersonalAccessTokens.queryFilter(),
                );
                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }
        setDialogOpen(open);
    }

    const handleSubmit = form.handleSubmit(
        (formData) => {
            const tokenId = D4HAccessTokenId.create();

            logger.log("Creating D4H Access Token", { tokenId, ...formData });

            mutation.mutate({
                organizationId: formData.organizationId,
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
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create /> Add Access Token
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Personal D4H Access Token</DialogTitle>
                    <DialogDescription>
                        Allows you to connect to your D4H account from AVUT.
                    </DialogDescription>
                </DialogHeader>
                <form id="create-personal-d4h-access-token-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="organizationId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="access-token-organization">
                                        Organization
                                    </FieldLabel>
                                    <Select {...field} onValueChange={field.onChange}>
                                        <SelectTrigger
                                            id="access-token-organization"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue placeholder="Select organization" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {membershipsQuery.data?.map((membership) => (
                                                <SelectItem
                                                    key={membership.organization.id}
                                                    value={membership.organization.id}
                                                >
                                                    {membership.organization.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="serverCode"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
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
                                        Generate a D4H access token at:{" "}
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
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="create-personal-d4h-access-token-form"
                        status={mutation.status}
                        text={{
                            idle: "Create",
                            pending: "Creating",
                            success: "Created",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
