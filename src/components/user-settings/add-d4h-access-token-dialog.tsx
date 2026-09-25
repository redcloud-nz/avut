/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Controller, useForm, Watch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { d4hAccessTokensEffects } from "@/client/d4h-access-tokens-effects";
import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
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
import { D4HServerCode, D4HServerList } from "@/lib/d4h-servers";
import { route } from "@/lib/routes";
import { D4HAccessTokenId } from "@/lib/schemas/d4h-access-token";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

/**
 * Self-triggered create dialog for a personal D4H access token — safe because it navigates away
 * (to the new token's detail page) on success rather than closing in place, so there's no stale
 * mounted state to worry about.
 */
export function UserSettings_AddD4HAccessToken_Dialog() {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-token"] as const),
    );
    const dialogOpen = action === "add-token";

    function handleOpenChange(open: boolean) {
        void setAction(open ? "add-token" : null, { history: open ? "push" : "replace" });
    }

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
                <DialogBoundary>
                    <AddD4HAccessToken_Body />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function AddD4HAccessToken_Body() {
    const logger = useLogger("Common", "UserSettings_AddD4HAccessToken_Dialog");
    const router = useRouter();

    const { data: memberships } = useSuspenseQuery(trpc.user.listMemberships.queryOptions());

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
            meta: { effects: d4hAccessTokensEffects.createPersonalAccessToken },
            onError(error) {
                logger.error("Error creating D4H access token:", error);
                toast.error(`Failed to create D4H access token: ${error.message}`);
            },
            onSuccess(_data, variables) {
                toast.success("D4H access token created");
                router.push(
                    route("/user/settings/d4h/access-tokens/[token_id]", {
                        token_id: variables.tokenId,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            const tokenId = D4HAccessTokenId.create();

            logger.log("Creating personal D4H access token", {
                tokenId,
                organizationId: formData.organizationId,
                serverCode: formData.serverCode,
            });

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
        <>
            <DialogBody>
                <form id="create-personal-d4h-access-token-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="organizationId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="access-token-organization">
                                        Organisation
                                    </FieldLabel>
                                    <Select {...field} onValueChange={field.onChange}>
                                        <SelectTrigger
                                            id="access-token-organization"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue placeholder="Select organisation" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {memberships.map((membership) => (
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
            </DialogBody>
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
        </>
    );
}
