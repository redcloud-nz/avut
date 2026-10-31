/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { XIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Fragment, useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { useSuspenseQueries } from "@tanstack/react-query";

import { PersonPicker } from "@/components/controls/person-picker";
import { ObjectIcons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
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
import { FieldGroup, FieldLegend, FieldSeparator, FieldSet } from "@/components/ui/field";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

type I3NotifySettings = OrganizationSettings["modules"]["d4h-i3"]["notify"];

/** The lists the dialog edits: the org-wide one, then one per team it shows, in display order. */
interface NotifyFormValues {
    org: PersonId[];
    teams: { teamId: TeamId; personIds: PersonId[] }[];
}

/**
 * The `notify` value to save: the shown teams' lists, plus every stored team entry the dialog
 * isn't showing (an unlinked, archived or deleted team), so a team that comes back gets its list
 * back. Teams left with no people are dropped, and each list is deduped.
 *
 * The carried-over entries come from the settings the card held when the dialog opened, so a
 * concurrent edit to another team's list (another tab, another admin) is overwritten. Accepted:
 * this is a rarely-edited admin screen.
 */
export function buildNotifyPatch(
    stored: I3NotifySettings,
    values: NotifyFormValues,
): I3NotifySettings {
    const shown = new Set(values.teams.map((team) => team.teamId));
    const teams: Record<TeamId, PersonId[]> = {};

    for (const [teamId, personIds] of Object.entries(stored.teams) as [TeamId, PersonId[]][]) {
        if (!shown.has(teamId) && personIds.length > 0) teams[teamId] = [...new Set(personIds)];
    }
    for (const { teamId, personIds } of values.teams) {
        if (personIds.length > 0) teams[teamId] = [...new Set(personIds)];
    }

    return { org: [...new Set(values.org)], teams };
}

/**
 * `?action=update-i3-notify` — self-triggered (Recipe A): the trigger button lives here. Safe
 * because saving the lists leaves the D4H I3 module enabled, so its card keeps rendering this
 * trigger and the dialog stays mounted through the save.
 *
 * Edits who is emailed when items are issued or returned: one list for the whole organisation,
 * then one for each Active team linked to D4H. A slice patch is partial only one level down, so
 * `notify` is always saved whole (both keys); the slice schema rejects anything less.
 */
export function OrganizationSettings_UpdateI3Notify_Dialog({
    organizationId,
    settings,
    description,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    /** The notifications explanation, shared with the card's row. */
    description: string;
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-i3-notify"] as const),
    );
    const dialogOpen = action === "update-i3-notify";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-i3-notify" : null, {
            history: open ? "push" : "replace",
        });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit I3 notifications">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>I3 Notifications</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <UpdateI3Notify_Body
                        organizationId={organizationId}
                        stored={settings.modules["d4h-i3"].notify}
                        onDone={() => handleDialogOpenChange(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function UpdateI3Notify_Body({
    organizationId,
    stored,
    onDone,
}: {
    organizationId: OrganizationId;
    stored: I3NotifySettings;
    onDone: () => void;
}) {
    const [{ data: personnel }, { data: allTeams }] = useSuspenseQueries({
        queries: [
            trpc.personnel.listPersonnel.queryOptions({ organizationId }),
            trpc.teams.listTeams.queryOptions({ organizationId }),
        ],
    });
    // Frozen at mount: the team lists bind to the form by index, so a `listTeams` refetch while
    // the dialog is open (a team added, archived or reordered) must not reshuffle them.
    const [teams] = useState(() =>
        allTeams.filter((team) => team.status === "Active" && team.d4h != null),
    );

    const formId = useId();
    const form = useForm<NotifyFormValues>({
        defaultValues: {
            org: stored.org,
            teams: teams.map((team) => ({
                teamId: team.id,
                personIds: stored.teams[team.id] ?? [],
            })),
        },
    });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update I3 notifications",
        onSaved: onDone,
    });

    const handleSubmit = form.handleSubmit(
        (values) =>
            mutation.mutate({
                organizationId,
                update: {
                    slice: "modules.d4h-i3",
                    patch: { notify: buildNotifyPatch(stored, values) },
                },
            }),
        (errors) => console.warn("Form validation errors:", errors),
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="org"
                            render={({ field }) => (
                                <NotifyPersonList
                                    legend="Whole organisation"
                                    organizationId={organizationId}
                                    personnel={personnel}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                        {teams.map((team, index) => (
                            <Fragment key={team.id}>
                                <FieldSeparator />
                                <Controller
                                    control={form.control}
                                    name={`teams.${index}.personIds`}
                                    render={({ field }) => (
                                        <NotifyPersonList
                                            legend={team.name}
                                            organizationId={organizationId}
                                            personnel={personnel}
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    )}
                                />
                            </Fragment>
                        ))}
                    </FieldGroup>
                </form>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form={formId}
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                />
            </DialogFooter>
        </>
    );
}

/**
 * One list of people to notify: the chosen people as removable rows, then a picker to add one.
 * An Archived person keeps a status badge, and an id that no longer resolves shows as
 * "Unknown person"; both can still be removed.
 */
function NotifyPersonList({
    legend,
    organizationId,
    personnel,
    value,
    onChange,
}: {
    legend: string;
    organizationId: OrganizationId;
    personnel: PersonData[];
    value: PersonId[];
    onChange: (next: PersonId[]) => void;
}) {
    const pickerId = useId();

    return (
        <FieldSet>
            <FieldLegend>{legend}</FieldLegend>
            {value.length > 0 ? (
                <ul className="divide-y divide-border/50 text-sm">
                    {value.map((personId) => {
                        const person = personnel.find((p) => p.id === personId);
                        const name = person?.name ?? "Unknown person";
                        return (
                            <li key={personId} className="flex items-center gap-2 py-1.5">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium">{name}</div>
                                    {person && (
                                        <div className="truncate text-muted-foreground">
                                            {person.email}
                                        </div>
                                    )}
                                </div>
                                {person?.status === "Archived" && (
                                    <Badge variant="outline">Archived</Badge>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Remove ${name} from ${legend}`}
                                    onClick={() => onChange(value.filter((id) => id !== personId))}
                                >
                                    <XIcon />
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">No one yet.</p>
            )}
            <label htmlFor={pickerId} className="sr-only">
                Add a person to {legend}
            </label>
            <PersonPicker
                id={pickerId}
                organizationId={organizationId}
                value={null}
                onValueChange={(personId) => {
                    if (personId && !value.includes(personId)) onChange([...value, personId]);
                }}
                placeholder="Add a person"
                activeOnly
            />
        </FieldSet>
    );
}

/** The card row's summary of the stored lists, counting stored ids rather than resolved people. */
export function summariseI3Notify(notify: I3NotifySettings): string {
    const teamCount = Object.values(notify.teams).filter((ids) => ids.length > 0).length;
    if (notify.org.length === 0 && teamCount === 0) return "No one";
    return `${notify.org.length} org-wide, ${teamCount} ${teamCount === 1 ? "team" : "teams"}`;
}
