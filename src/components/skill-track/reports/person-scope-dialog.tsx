/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo, useState } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { TelescopeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";

/**
 * Scope picker for the Personnel Competency report, presented as a command dialog rather
 * than a full-page list. Opened via `?action=select-scope` (or forced open by the report
 * when nothing is picked yet); choosing a person sets `?person=<id>`.
 */
export function SkillTrack_PersonScopeDialog({
    forceOpen = false,
    label = "Change scope",
}: {
    forceOpen?: boolean;
    label?: string;
}) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["select-scope"] as const),
    );
    const [, setPerson] = useQueryState("person");

    // `forceOpen` (report has no scope yet) shows the dialog on arrival, but it stays
    // dismissable — Escape leaves the blank report with its prompt and the trigger button to
    // reopen. `?action=select-scope` opens it explicitly regardless.
    const [dismissed, setDismissed] = useState(false);
    const open = action === "select-scope" || (forceOpen && !dismissed);

    const { data: personnel } = useSuspenseQuery(
        trpc.personnel.listPersonnel.queryOptions({ organizationId: organization.id }),
    );

    // The competency report only resolves active personnel — archived people would render
    // an empty report.
    const activePersonnel = useMemo(
        () =>
            R.pipe(
                personnel,
                R.filter((person) => person.status === "Active"),
                R.sortBy((person) => person.name),
            ),
        [personnel],
    );

    function handleOpenChange(next: boolean) {
        setDismissed(!next);
        void setAction(next ? "select-scope" : null, { history: next ? "push" : "replace" });
    }

    function handleSelect(personId: string) {
        setDismissed(true);
        void setPerson(personId, { history: "push" });
        void setAction(null, { history: "replace" });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <TelescopeIcon />
                    <span className="sr-only sm:not-sr-only">{label}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="gap-0 p-0">
                <DialogHeader className="border-b px-4 py-3">
                    <DialogTitle>Select a person</DialogTitle>
                    <DialogDescription>
                        Choose a person to view their competency report.
                    </DialogDescription>
                </DialogHeader>
                <Command>
                    <CommandInput placeholder="Search people…" />
                    <CommandList className="h-72">
                        <CommandEmpty>No active personnel match your search.</CommandEmpty>
                        {activePersonnel.map((person) => (
                            <CommandItem
                                key={person.id}
                                value={`${person.name} ${person.email}`}
                                onSelect={() => handleSelect(person.id)}
                            >
                                <span>{person.name}</span>
                                <span className="text-muted-foreground">{person.email}</span>
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
