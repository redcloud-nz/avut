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
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { teamsEffects } from "@/client/teams-effects";
import { Show } from "@/components/show";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
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
import { route } from "@/lib/routes";
import { ModifiableTeamData, TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_Teams_ImportTeamFromD4H_Dialog(props: DialogProps) {
    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import team from D4H</DialogTitle>
                    <DialogDescription>
                        Create a team that is synchronised with a team in D4H.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <ImportTeamFromD4H_Body onDone={() => props.onOpenChange?.(false)} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function ImportTeamFromD4H_Body({ onDone }: { onDone: () => void }) {
    const organization = useOrganization();
    const router = useRouter();

    const [{ data: availableTeams }, { data: existingTeams }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listTeamsAccessibleToUser.queryOptions({
                organizationId: organization.id,
            }),
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

    const mutation = useMutation(
        trpc.teams.createTeamFromD4H.mutationOptions({
            meta: { effects: teamsEffects.createTeamFromD4H, navigates: true },
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
            onSuccess({ created }) {
                onDone();

                router.push(
                    route("/orgs/[slug]/admin/teams/[team_id]", {
                        slug: organization.slug,
                        team_id: created.id,
                    }),
                );
            },
        }),
    );

    const selectedTeamId = useWatch({ control: form.control, name: "teamId" });
    const selectedTeam = availableTeams.find((team) => team.id === selectedTeamId);

    return (
        <>
            <DialogBody>
                <form
                    id="import-d4h-team-form"
                    onSubmit={form.handleSubmit(({ teamId, ...values }) =>
                        mutation.mutate({
                            organizationId: organization.id,
                            d4hTeamId: teamId,
                            name: values.name || selectedTeam!.title,
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
                                            disabled={availableTeams.length == 0}
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
                                                            existingTeam.d4h?.d4hTeamId === team.id,
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
            </DialogBody>
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
        </>
    );
}
