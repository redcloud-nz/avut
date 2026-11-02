/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";
import { Controller, useForm, Watch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

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
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { OrganizationData } from "@/lib/schemas/organization";
import { ProviderCredentialAccess, ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { trpc } from "@/trpc/client";

interface AddD4HAccessTokenDialogProps {
    organization: OrganizationData;
}

/**
 * Self-triggered create dialog for an organisation D4H access token — safe because it navigates
 * away (to the new token's detail page) on success rather than closing in place.
 */
export function AdminModule_AddD4HAccessToken_Dialog({
    organization,
}: AddD4HAccessTokenDialogProps) {
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
                    <DialogTitle>Add D4H Access Token</DialogTitle>
                    <DialogDescription>
                        Allows {organization.name} to connect to D4H from AVUT.
                    </DialogDescription>
                </DialogHeader>
                <AddD4HAccessToken_Body organization={organization} />
            </DialogContent>
        </Dialog>
    );
}

function AddD4HAccessToken_Body({ organization }: AddD4HAccessTokenDialogProps) {
    const logger = useLogger("Common", "AdminModule_AddD4HAccessToken_Dialog");
    const router = useRouter();

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(
            z.object({
                label: z.string().min(1, "Label is required"),
                serverCode: D4HServerCode.schema,
                token: z.string().trim().min(1, "Token is required"),
                access: ProviderCredentialAccess.schema,
            }),
        ),
        defaultValues: {
            label: "",
            serverCode: "ap" as const,
            token: "",
            access: "ReadOnly" as ProviderCredentialAccess,
        },
    });

    const mutation = useMutation(
        trpc.d4hAccessTokens.createOrganizationAccessToken.mutationOptions({
            meta: {
                effects: d4hAccessTokensEffects.createOrganizationAccessToken,
                navigates: true,
            },
            onError(error) {
                logger.error("Error creating D4H access token:", error);
                toast.error(`Failed to create D4H access token: ${error.message}`);
            },
            onSuccess({ created }) {
                toast.success("D4H access token created");
                router.push(
                    route("/orgs/[slug]/admin/d4h-access-tokens/[token_id]", {
                        slug: organization.slug,
                        token_id: created.id,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            const tokenId = ProviderCredentialId.create();

            logger.log("Creating organisation D4H access token", {
                tokenId,
                serverCode: formData.serverCode,
                access: formData.access,
            });

            mutation.mutate({
                organizationId: organization.id,
                tokenId,
                create: formData,
            });
        },
        (error) => {
            logger.warn("Form validation failed", error);
        },
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="label"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="access-token-label">Label</FieldLabel>
                                    <Input
                                        id="access-token-label"
                                        placeholder="e.g. Shared read-only token"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
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
                                            href={server.tokensUrl}
                                        >
                                            {server.tokensUrl}
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
                        <Controller
                            name="access"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="access-token-access">Access</FieldLabel>
                                    <Select {...field} onValueChange={field.onChange}>
                                        <SelectTrigger
                                            id="access-token-access"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ProviderCredentialAccess.schema.options.map(
                                                (access) => (
                                                    <SelectItem key={access} value={access}>
                                                        {ProviderCredentialAccess.labels[access]}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>
                                        Read only stops AVUT from making any change in D4H with this
                                        token.
                                    </FieldDescription>
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
                    form={formId}
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
