/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { ModifiableTeamData, TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_Teams_ImportTeamFromD4H_Dialog(props: DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const [{ data: availableTeams = [], isSuccess }, { data: existingTeams = [] }] = useQueries({
        queries: [
            trpc.d4hApi.listTeamsAccessibleToUser.queryOptions(
                {
                    organizationId: organization.id,
                },
                { enabled: props.open },
            ),
            trpc.teams.listTeams.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });

    const form = useForm({
        resolver: zodResolver(
            TeamData.modifiableSchema.omit({ name: true }).extend({
                name: z.string(),
                teamId: z.number("Please select a D4H team to import"),
            }),
        ),
        defaultValues: {
            teamId: undefined,
            name: "",
            description: "",
            tags: [],
            properties: {},
        },
    });

    function handleDialogOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }

        props.onOpenChange?.(open);
    }

    const mutation = useMutation(
        trpc.teams.importTeamFromD4H.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(error.shape.cause.message as keyof ModifiableTeamData, {
                        message: error.message,
                    });
                } else {
                    toast.error(`Failed to create team: ${error.message}`);
                    console.error("Failed to create team:", error);
                }
            },
            async onSuccess({ created }) {
                await queryClient.invalidateQueries(
                    trpc.teams.listTeams.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                handleDialogOpenChange(false);

                router.push(`/main/${organization.slug}/admin/teams/${created.id}`);
            },
        }),
    );

    const selectedTeamId = useWatch({ control: form.control, name: "teamId" });
    const selectedTeam = availableTeams.find((team) => team.id === selectedTeamId);

    return (
        <Dialog {...props} onOpenChange={handleDialogOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import team from D4H</DialogTitle>
                    <DialogDescription>
                        Create a team that is synchronized with a team in D4H.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="import-d4h-team-form"
                    onSubmit={form.handleSubmit(({ teamId, ...values }) =>
                        mutation.mutate({
                            organizationId: organization.id,
                            create: {
                                name: values.name || selectedTeam!.title,
                                description:
                                    values.description ||
                                    `Imported from D4H Team '${selectedTeam!.title}'`,
                                tags: [],
                                properties: { d4hTeamId: teamId },
                            },
                            d4hTeamId: teamId,
                        }),
                    )}
                >
                    <FieldGroup>
                        <Controller
                            name="teamId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>D4H Team</FieldLabel>
                                    <Select
                                        value={field.value ? field.value + "" : ""}
                                        onValueChange={(newValue) =>
                                            field.onChange(parseInt(newValue))
                                        }
                                    >
                                        <SelectTrigger
                                            aria-invalid={fieldState.invalid}
                                            disabled={!isSuccess || availableTeams.length == 0}
                                        >
                                            <SelectValue placeholder="Select a team" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableTeams.map((team) => (
                                                <SelectItem
                                                    key={team.id}
                                                    value={team.id + ""}
                                                    disabled={existingTeams.some(
                                                        (existingTeam) =>
                                                            existingTeam.properties.d4hTeamId ==
                                                            team.id,
                                                    )}
                                                >
                                                    {team.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Show when={selectedTeamId != null}>
                            <Controller
                                name="name"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="team-name">Name</FieldLabel>
                                        <Input
                                            id="team-name"
                                            placeholder={selectedTeam!.title}
                                            autoComplete="off"
                                            aria-invalid={fieldState.invalid}
                                            {...field}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="description"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="team-description">
                                            Description
                                        </FieldLabel>
                                        <Textarea
                                            id="team-description"
                                            placeholder={`Imported from D4H Team '${selectedTeam!.title}'`}
                                            aria-invalid={fieldState.invalid}
                                            {...field}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </Show>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    {selectedTeamId != null && (
                        <MutationButton
                            type="submit"
                            form="import-d4h-team-form"
                            status={mutation.status}
                            text={{
                                idle: "Import",
                                pending: "Importing",
                                success: "Imported",
                            }}
                        />
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
