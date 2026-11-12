/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { XIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";

import { DateRangePicker } from "@/components/controls/date-range-picker";
import { PersonPicker } from "@/components/controls/person-picker";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/hooks/use-organization";
import {
    getEnabledSkillCheckResultOptions,
    type SkillCheckResultValue,
} from "@/lib/schemas/skill-check";
import {
    checkSearchFilters,
    type CheckSearchParams,
} from "@/modules/skill-track/lib/check-search-params";
import { useFormatSessionWhen } from "@/modules/skill-track/lib/use-format-session-when";
import { trpc } from "@/trpc/client";

/** What a filter change writes: some filter params, set or cleared. */
type FilterUpdate = Partial<Omit<CheckSearchParams, "page">>;

/** The first row of the current results, for naming a skill or session the options lack. */
type SampleRow = {
    skill: { id: string; name: string };
    session: { id: string; name: string } | null;
};

export interface ChecksFilterBarProps {
    params: CheckSearchParams;
    /** Writes filter params and returns to page 1. `null` clears every filter. */
    onFiltersChange: (update: FilterUpdate | null) => void;
    sampleRow: SampleRow | undefined;
}

/**
 * The Checks page's filters: one value each for person, skill, session, assessor, result and
 * date range, held in search params. Whether a filter is set comes from `checkSearchFilters`, so
 * a mangled param (`?skill=xyz`) shows as unset, matching the query, which drops it.
 */
export function SkillTrack_ChecksFilterBar({
    params,
    onFiltersChange,
    sampleRow,
}: ChecksFilterBarProps) {
    const organization = useOrganization();
    const formatSessionWhen = useFormatSessionWhen();

    const filters = checkSearchFilters(params);
    const anySet = Object.keys(filters).length > 0;

    // Not suspense: the bar renders before the options arrive.
    const skillsQuery = useQuery(
        trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
            organizationId: organization.id,
        }),
    );
    const sessionsQuery = useQuery(
        trpc.skillCheckSessions.listSessions.queryOptions({ organizationId: organization.id }),
    );

    const skillOptions = useMemo(
        () =>
            [...(skillsQuery.data?.skills ?? [])]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((skill) => ({ value: skill.id, label: skill.name })),
        [skillsQuery.data],
    );

    const sessionOptions = useMemo(
        () => [
            { value: "none", label: "No session" },
            ...[...(sessionsQuery.data ?? [])]
                .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
                .map((session) => ({
                    value: session.id,
                    label: session.name || session.id,
                    subtitle: formatSessionWhen(session.startsAt, session.endsAt),
                })),
        ],
        [sessionsQuery.data, formatSessionWhen],
    );

    const resultOptions = getEnabledSkillCheckResultOptions(organization.settings);

    // An archived skill (linked from its skill page) isn't among the options: name it from the
    // results, or fall back to its id. Likewise a session the options don't hold.
    const skillLabel =
        filters.skillId && !skillOptions.some((o) => o.value === filters.skillId)
            ? sampleRow?.skill.id === filters.skillId
                ? sampleRow.skill.name
                : filters.skillId
            : undefined;
    const sessionLabel =
        filters.sessionId && !sessionOptions.some((o) => o.value === filters.sessionId)
            ? sampleRow?.session?.id === filters.sessionId
                ? sampleRow.session.name || sampleRow.session.id
                : filters.sessionId
            : undefined;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Filter
                label="person"
                isSet={!!filters.assesseeId}
                onClear={() => onFiltersChange({ person: null })}
            >
                <div className="w-52">
                    <PersonPicker
                        organizationId={organization.id}
                        value={filters.assesseeId ?? null}
                        onValueChange={(person) => onFiltersChange({ person })}
                        placeholder="Any person"
                        defaultStatusFilter="all"
                    />
                </div>
            </Filter>
            <Filter
                label="skill"
                isSet={!!filters.skillId}
                onClear={() => onFiltersChange({ skill: null })}
            >
                <SearchableSelect
                    className="w-52"
                    value={filters.skillId ?? null}
                    onValueChange={(skill) => onFiltersChange({ skill })}
                    options={skillOptions}
                    valueLabel={skillLabel}
                    placeholder="Any skill"
                    searchPlaceholder="Search skills..."
                    emptyMessage={skillsQuery.isPending ? "Loading skills..." : "No skills found."}
                />
            </Filter>
            <Filter
                label="session"
                isSet={!!filters.sessionId}
                onClear={() => onFiltersChange({ session: null })}
            >
                <SearchableSelect
                    className="w-52"
                    value={filters.sessionId ?? null}
                    onValueChange={(session) => onFiltersChange({ session })}
                    options={sessionOptions}
                    valueLabel={sessionLabel}
                    placeholder="Any session"
                    searchPlaceholder="Search sessions..."
                    emptyMessage={
                        sessionsQuery.isPending ? "Loading sessions..." : "No sessions found."
                    }
                />
            </Filter>
            <Filter
                label="assessor"
                isSet={!!filters.assessorId}
                onClear={() => onFiltersChange({ assessor: null })}
            >
                <div className="w-52">
                    <PersonPicker
                        organizationId={organization.id}
                        value={filters.assessorId ?? null}
                        onValueChange={(assessor) => onFiltersChange({ assessor })}
                        placeholder="Any assessor"
                        defaultStatusFilter="all"
                    />
                </div>
            </Filter>
            <Filter
                label="result"
                isSet={!!filters.result}
                onClear={() => onFiltersChange({ result: null })}
            >
                <Select
                    value={filters.result ?? ""}
                    onValueChange={(result) =>
                        onFiltersChange({ result: result as SkillCheckResultValue })
                    }
                >
                    <SelectTrigger className="w-36" aria-label="Result">
                        <SelectValue placeholder="Any result" />
                    </SelectTrigger>
                    <SelectContent>
                        {resultOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Filter>
            <Filter
                label="date"
                isSet={!!(filters.from || filters.to)}
                onClear={() => onFiltersChange({ from: null, to: null })}
            >
                <DateRangePicker
                    size="sm"
                    value={{ from: filters.from, to: filters.to }}
                    onValueChange={(range) =>
                        onFiltersChange({ from: range?.from ?? null, to: range?.to ?? null })
                    }
                    placeholder="Any date"
                />
            </Filter>
            {anySet && (
                <Button variant="link" size="sm" onClick={() => onFiltersChange(null)}>
                    Clear filters
                </Button>
            )}
        </div>
    );
}

/** One filter control, with a button to clear it while it's set. */
function Filter({
    label,
    isSet,
    onClear,
    children,
}: {
    label: string;
    isSet: boolean;
    onClear: () => void;
    children: ReactNode;
}) {
    return (
        <div className="flex items-center gap-0.5">
            {children}
            {isSet && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Clear ${label} filter`}
                    onClick={onClear}
                >
                    <XIcon />
                </Button>
            )}
        </div>
    );
}
