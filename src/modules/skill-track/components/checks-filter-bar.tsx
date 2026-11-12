/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { XIcon } from "lucide-react";
import { useId, useMemo, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";

import { DateRangePicker } from "@/components/controls/date-range-picker";
import { PersonPicker } from "@/components/controls/person-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { formatPlainDate } from "@/lib/schemas/date-range";
import {
    getEnabledSkillCheckResultOptions,
    type CheckSearchRow,
    type SkillCheckResultValue,
} from "@/lib/schemas/skill-check";
import { cn } from "@/lib/utils";
import { SkillTrack_SessionReview_CardToggle } from "@/modules/skill-track/components/session-review-card-toggle";
import {
    checkSearchFilters,
    type CheckSearchParams,
} from "@/modules/skill-track/lib/check-search-params";
import { useFormatSessionWhen } from "@/modules/skill-track/lib/use-format-session-when";
import { trpc } from "@/trpc/client";

/** What a filter change writes: some filter params, set or cleared. */
type FilterUpdate = Partial<Omit<CheckSearchParams, "page">>;

/** The first row of the current results, for naming a filter value the options lack. */
type SampleRow = Pick<CheckSearchRow, "assessee" | "assessor" | "skill" | "session">;

export interface ChecksFilterBarProps {
    params: CheckSearchParams;
    /** Writes filter params and returns to page 1. `null` clears every filter. */
    onFiltersChange: (update: FilterUpdate | null) => void;
    sampleRow: SampleRow | undefined;
}

/**
 * The Checks page's filters: one value each for person, skill, session, assessor, result and
 * date range, held in search params. A collapsible card whose header sums the filters up in a
 * sentence. Whether a filter is set comes from `checkSearchFilters`, so a mangled param
 * (`?skill=xyz`) shows as unset, matching the query, which drops it.
 */
export function SkillTrack_ChecksFilterBar({
    params,
    onFiltersChange,
    sampleRow,
}: ChecksFilterBarProps) {
    const organization = useOrganization();
    const formatSessionWhen = useFormatSessionWhen();
    const { display } = usePreferences();
    const id = useId();

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
    // The pickers load the same list; this names a chosen person in the summary.
    const personnelQuery = useQuery(
        trpc.personnel.listPersonnel.queryOptions({ organizationId: organization.id }),
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

    function personName(personId: string, sample: { id: string; name: string } | null | undefined) {
        return (
            personnelQuery.data?.find((person) => person.id === personId)?.name ??
            (sample?.id === personId ? sample.name : "a selected person")
        );
    }

    const summary = anySet ? (
        <>
            Showing checks
            {filters.assesseeId && (
                <>
                    {" "}
                    of <Value>{personName(filters.assesseeId, sampleRow?.assessee)}</Value>
                </>
            )}
            {filters.skillId && (
                <>
                    {" "}
                    on{" "}
                    <Value>
                        {skillLabel ?? skillOptions.find((o) => o.value === filters.skillId)?.label}
                    </Value>
                </>
            )}
            {filters.sessionId === "none" ? (
                <> outside any session</>
            ) : (
                filters.sessionId && (
                    <>
                        {" "}
                        in{" "}
                        <Value>
                            {sessionLabel ??
                                sessionOptions.find((o) => o.value === filters.sessionId)?.label}
                        </Value>
                    </>
                )
            )}
            {filters.assessorId && (
                <>
                    {" "}
                    assessed by <Value>{personName(filters.assessorId, sampleRow?.assessor)}</Value>
                </>
            )}
            {filters.result && (
                <>
                    {" "}
                    with result{" "}
                    <Value>
                        {resultOptions.find((o) => o.value === filters.result)?.label ??
                            filters.result}
                    </Value>
                </>
            )}
            {filters.from && (
                <>
                    {" "}
                    from <Value>{formatPlainDate(filters.from, display)}</Value>
                </>
            )}
            {filters.to && (
                <>
                    {" "}
                    {filters.from ? "to" : "until"}{" "}
                    <Value>{formatPlainDate(filters.to, display)}</Value>
                </>
            )}
            .{" "}
            <Button
                variant="link"
                className="h-auto p-0 align-baseline"
                onClick={() => onFiltersChange(null)}
            >
                Clear filters
            </Button>
        </>
    ) : (
        "Showing every check."
    );

    return (
        // Opens on a bare page; collapses to the summary when the page loads already filtered,
        // as from a skill page's Recent checks link.
        <Collapsible asChild defaultOpen={!anySet}>
            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>{summary}</CardDescription>
                    <SkillTrack_SessionReview_CardToggle title="Filters" />
                </CardHeader>
                <CollapsibleContent asChild>
                    <CardContent className="grid grid-cols-1 gap-x-2 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Filter
                            id={`${id}-person`}
                            label="Person"
                            isSet={!!filters.assesseeId}
                            onClear={() => onFiltersChange({ person: null })}
                        >
                            <PersonPicker
                                id={`${id}-person`}
                                className={FILTER_TRIGGER}
                                organizationId={organization.id}
                                value={filters.assesseeId ?? null}
                                onValueChange={(person) => onFiltersChange({ person })}
                                placeholder="Any person"
                                allStatuses
                            />
                        </Filter>
                        <Filter
                            id={`${id}-skill`}
                            label="Skill"
                            isSet={!!filters.skillId}
                            onClear={() => onFiltersChange({ skill: null })}
                        >
                            <SearchableSelect
                                id={`${id}-skill`}
                                className={FILTER_TRIGGER}
                                value={filters.skillId ?? null}
                                onValueChange={(skill) => onFiltersChange({ skill })}
                                options={skillOptions}
                                valueLabel={skillLabel}
                                placeholder="Any skill"
                                searchPlaceholder="Search skills..."
                                emptyMessage={
                                    skillsQuery.isPending ? "Loading skills..." : "No skills found."
                                }
                            />
                        </Filter>
                        <Filter
                            id={`${id}-session`}
                            label="Session"
                            isSet={!!filters.sessionId}
                            onClear={() => onFiltersChange({ session: null })}
                        >
                            <SearchableSelect
                                id={`${id}-session`}
                                className={FILTER_TRIGGER}
                                value={filters.sessionId ?? null}
                                onValueChange={(session) => onFiltersChange({ session })}
                                options={sessionOptions}
                                valueLabel={sessionLabel}
                                placeholder="Any session"
                                searchPlaceholder="Search sessions..."
                                emptyMessage={
                                    sessionsQuery.isPending
                                        ? "Loading sessions..."
                                        : "No sessions found."
                                }
                            />
                        </Filter>
                        <Filter
                            id={`${id}-assessor`}
                            label="Assessor"
                            isSet={!!filters.assessorId}
                            onClear={() => onFiltersChange({ assessor: null })}
                        >
                            <PersonPicker
                                id={`${id}-assessor`}
                                className={FILTER_TRIGGER}
                                organizationId={organization.id}
                                value={filters.assessorId ?? null}
                                onValueChange={(assessor) => onFiltersChange({ assessor })}
                                placeholder="Any assessor"
                                allStatuses
                            />
                        </Filter>
                        <Filter
                            id={`${id}-result`}
                            label="Result"
                            isSet={!!filters.result}
                            onClear={() => onFiltersChange({ result: null })}
                        >
                            <Select
                                value={filters.result ?? ""}
                                onValueChange={(result) =>
                                    onFiltersChange({ result: result as SkillCheckResultValue })
                                }
                            >
                                <SelectTrigger id={`${id}-result`} className={FILTER_TRIGGER}>
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
                            id={`${id}-date`}
                            label="Date"
                            isSet={!!(filters.from || filters.to)}
                            onClear={() => onFiltersChange({ from: null, to: null })}
                        >
                            <DateRangePicker
                                id={`${id}-date`}
                                className={cn(FILTER_TRIGGER, "pr-2 pl-2.5")}
                                size="sm"
                                value={{ from: filters.from, to: filters.to }}
                                onValueChange={(range) =>
                                    onFiltersChange({
                                        from: range?.from ?? null,
                                        to: range?.to ?? null,
                                    })
                                }
                                placeholder="Any date"
                            />
                        </Filter>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

/** A filter value in the summary sentence. */
function Value({ children }: { children: ReactNode }) {
    return <span className="font-medium text-foreground">{children}</span>;
}

/** Strips a filter control's own box, so the `Filter` group around it draws the one box. */
const FILTER_TRIGGER =
    "h-full w-full min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent [&>span]:truncate";

/**
 * One labelled filter control in a box, with a button inside the box to clear the filter while
 * it's set. `id` is the control's, for the label.
 */
function Filter({
    id,
    label,
    isSet,
    onClear,
    children,
}: {
    id: string;
    label: string;
    isSet: boolean;
    onClear: () => void;
    children: ReactNode;
}) {
    return (
        <Field className="gap-1.5">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <InputGroup className="bg-background has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                {children}
                {isSet && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            size="icon-xs"
                            aria-label={`Clear ${label.toLowerCase()} filter`}
                            onClick={onClear}
                        >
                            <XIcon />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
        </Field>
    );
}
