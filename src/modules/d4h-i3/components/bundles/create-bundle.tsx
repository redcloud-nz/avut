/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { i3BundlesEffects } from "@/client/i3-bundles-effects";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { I3Bundle, I3BundleId } from "@/lib/schemas/i3-bundle";
import { trpc } from "@/trpc/client";

export function D4HI3Module_CreateBundle_Dialog() {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const));
    const dialogOpen = action === "create";

    function handleOpenChange(open: boolean) {
        void setAction(open ? "create" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create />{" "}
                    <span className="sr-only md:not-sr-only">New Bundle</span>
                </Button>
            </DialogTrigger>
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>New I3 Bundle</DialogTitle>
                    <DialogDescription>Create a new standard-issue kit list.</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <CreateBundle_Body />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function CreateBundle_Body() {
    const logger = useLogger("I3", "CreateBundle");
    const organization = useOrganization();
    const router = useRouter();

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(I3Bundle.modifiableSchema),
        defaultValues: { name: "", description: "" },
    });

    const mutation = useMutation(
        trpc.i3Bundles.createBundle.mutationOptions({
            meta: { effects: i3BundlesEffects.createBundle, navigates: true },
            onError(error) {
                logger.error(`Failed to create bundle`, error);
                toast.error(`Failed to create bundle: ${error.message}`);
            },
            onSuccess({ created }) {
                router.push(
                    route("/orgs/[slug]/d4h-i3/bundles/[bundle_id]", {
                        slug: organization.slug,
                        bundle_id: created.id,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            logger.log(`Creating bundle`, formData);
            mutation.mutate({
                organizationId: organization.id,
                bundleId: I3BundleId.create(),
                create: formData,
            });
        },
        (fieldErrors) => {
            console.warn("Form validation errors:", fieldErrors);
        },
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
                                    <Input
                                        id={`${formId}-name`}
                                        autoFocus
                                        autoComplete="off"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="description"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${formId}-description`}>
                                        Description
                                    </FieldLabel>
                                    <Textarea
                                        id={`${formId}-description`}
                                        aria-invalid={fieldState.invalid}
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
