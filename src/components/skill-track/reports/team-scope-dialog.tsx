/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { Building2Icon, TelescopeIcon, UsersIcon } from "lucide-react";

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
 * Scope picker for the team-scoped reports (Team Competency, Personnel × Skill Matrix),
 * presented as a command dialog. Opened via `?action=select-scope` (or forced open when
 * nothing is picked yet); choosing a scope sets `?team=<id|all>`.
 */
export function SkillTrack_TeamScopeDialog({
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
    const [, setTeam] = useQueryState("team");

    // `forceOpen` (report has no scope yet) shows the dialog on arrival, but it stays
    // dismissable — Escape leaves the blank report with its prompt and the trigger button to
    // reopen. `?action=select-scope` opens it explicitly regardless.
    const [dismissed, setDismissed] = useState(false);
    const open = action === "select-scope" || (forceOpen && !dismissed);

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
    );

    const sortedTeams = R.sortBy(teams, (team) => team.name);

    function handleOpenChange(next: boolean) {
        setDismissed(!next);
        void setAction(next ? "select-scope" : null, { history: next ? "push" : "replace" });
    }

    function handleSelect(value: string) {
        setDismissed(true);
        void setTeam(value, { history: "push" });
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
                    <DialogTitle>Select a scope</DialogTitle>
                    <DialogDescription>Choose a team, or the whole organization.</DialogDescription>
                </DialogHeader>
                <Command>
                    <CommandInput placeholder="Search teams…" />
                    <CommandList className="h-72">
                        <CommandEmpty>No teams match your search.</CommandEmpty>
                        <CommandItem
                            value="Whole Organization"
                            onSelect={() => handleSelect("all")}
                        >
                            <Building2Icon />
                            <span>Whole Organization</span>
                        </CommandItem>
                        {sortedTeams.map((team) => (
                            <CommandItem
                                key={team.id}
                                value={team.name}
                                onSelect={() => handleSelect(team.id)}
                            >
                                <UsersIcon />
                                <span>{team.name}</span>
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
