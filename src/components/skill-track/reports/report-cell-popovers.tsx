/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * A pair of singleton popovers shared by every competency report: one describing a skill,
 * one detailing a recorded check. The report calls `openSkillInfo` / `openCheckDetails` with
 * the clicked element (used as a virtual anchor) and the data to show, so the same two
 * popover instances are re-positioned and re-populated on demand rather than one per cell.
 */

"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverHeader,
    PopoverTitle,
} from "@/components/ui/popover";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate, formatRelativeDateTime } from "@/lib/datetime";
import { getSkillCheckResultLabel } from "@/lib/schemas/skill-check";
import type { Skill } from "@/lib/schemas/skill";
import { RouterOutput, trpc } from "@/trpc/client";

type Competency = RouterOutput["skillChecks"]["getCompetencyMatrix"]["competencies"][number];

type ActiveTarget =
    | { kind: "skill"; skill: Skill }
    | { kind: "check"; competency: Competency }
    | null;

type ReportCellPopoversValue = {
    openSkillInfo: (anchor: HTMLElement, skill: Skill) => void;
    openCheckDetails: (anchor: HTMLElement, competency: Competency) => void;
};

const ReportCellPopoversContext = createContext<ReportCellPopoversValue | null>(null);

export function useReportCellPopovers(): ReportCellPopoversValue {
    const value = useContext(ReportCellPopoversContext);
    if (!value) {
        throw new Error("useReportCellPopovers must be used within <ReportCellPopoversProvider>");
    }
    return value;
}

export function ReportCellPopoversProvider({
    isSynthetic = false,
    children,
}: {
    /** Synthetic reports have no real check records — skip the check lookup, note the source. */
    isSynthetic?: boolean;
    children: React.ReactNode;
}) {
    const anchorRef = useRef<HTMLElement | null>(null);
    const [active, setActive] = useState<ActiveTarget>(null);
    // Bumped on every open so the popover content re-mounts and re-measures against the new anchor.
    const [nonce, setNonce] = useState(0);

    const openSkillInfo = useCallback((anchor: HTMLElement, skill: Skill) => {
        anchorRef.current = anchor;
        setActive({ kind: "skill", skill });
        setNonce((n) => n + 1);
    }, []);

    const openCheckDetails = useCallback((anchor: HTMLElement, competency: Competency) => {
        anchorRef.current = anchor;
        setActive({ kind: "check", competency });
        setNonce((n) => n + 1);
    }, []);

    const value = useMemo(
        () => ({ openSkillInfo, openCheckDetails }),
        [openSkillInfo, openCheckDetails],
    );

    return (
        <ReportCellPopoversContext.Provider value={value}>
            {children}

            <Popover
                open={active?.kind === "skill"}
                onOpenChange={(open) => !open && setActive(null)}
            >
                <PopoverAnchor
                    virtualRef={
                        anchorRef as React.ComponentProps<typeof PopoverAnchor>["virtualRef"]
                    }
                />
                {active?.kind === "skill" && (
                    <PopoverContent key={nonce} align="start">
                        <SkillInfoContent skill={active.skill} />
                    </PopoverContent>
                )}
            </Popover>

            <Popover
                open={active?.kind === "check"}
                onOpenChange={(open) => !open && setActive(null)}
            >
                <PopoverAnchor
                    virtualRef={
                        anchorRef as React.ComponentProps<typeof PopoverAnchor>["virtualRef"]
                    }
                />
                {active?.kind === "check" && (
                    <PopoverContent key={nonce} align="start">
                        <CheckDetailsContent
                            competency={active.competency}
                            isSynthetic={isSynthetic}
                        />
                    </PopoverContent>
                )}
            </Popover>
        </ReportCellPopoversContext.Provider>
    );
}

/** Inline button that opens the skill-info popover anchored to itself. */
export function SkillInfoTrigger({
    skill,
    className,
    children,
}: {
    skill: Skill;
    className?: string;
    children: React.ReactNode;
}) {
    const { openSkillInfo } = useReportCellPopovers();
    return (
        <button
            type="button"
            className={className}
            onClick={(event) => openSkillInfo(event.currentTarget, skill)}
        >
            {children}
        </button>
    );
}

/** Inline button that opens the check-details popover anchored to itself. */
export function CheckDetailsTrigger({
    competency,
    className,
    children,
}: {
    competency: Competency;
    className?: string;
    children: React.ReactNode;
}) {
    const { openCheckDetails } = useReportCellPopovers();
    return (
        <button
            type="button"
            className={className}
            onClick={(event) => openCheckDetails(event.currentTarget, competency)}
        >
            {children}
        </button>
    );
}

function SkillInfoContent({ skill }: { skill: Skill }) {
    return (
        <>
            <PopoverHeader>
                <PopoverTitle>{skill.name}</PopoverTitle>
                {skill.description && <p className="text-muted-foreground">{skill.description}</p>}
            </PopoverHeader>
            <p className="text-xs text-muted-foreground">
                {skill.frequency > 0
                    ? `Reassess every ${skill.frequency} ${skill.frequency === 1 ? "month" : "months"}`
                    : "No reassessment interval"}
            </p>
            {skill.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {skill.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                            {tag}
                        </Badge>
                    ))}
                </div>
            )}
        </>
    );
}

function CheckDetailsContent({
    competency,
    isSynthetic,
}: {
    competency: Competency;
    isSynthetic: boolean;
}) {
    const organization = useOrganization();

    // A null `expiresAt` means the skill never needs reassessment. Otherwise `isCurrent` is the
    // server's `expiresAt > now` check, so its negation is "expiry is past".
    const { expiresAt } = competency;
    const expired = expiresAt !== null && !competency.isCurrent;

    const { data: check, isPending } = useQuery(
        trpc.skillChecks.getSkillCheck.queryOptions(
            { organizationId: organization.id, skillCheckId: competency.checkId },
            { enabled: !isSynthetic },
        ),
    );

    return (
        <>
            <PopoverHeader>
                <PopoverTitle>
                    {getSkillCheckResultLabel(organization.settings, competency.result)}
                </PopoverTitle>
            </PopoverHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Assessed</dt>
                <dd>
                    <div>{formatDate(competency.checkedAt)}</div>
                    <div className="text-muted-foreground">
                        {formatRelativeDateTime(competency.checkedAt)}
                    </div>
                </dd>
                <dt className="text-muted-foreground">
                    {expiresAt === null ? "Expiry" : expired ? "Expired" : "Expires"}
                </dt>
                <dd>
                    {expiresAt === null ? (
                        <div>No expiry</div>
                    ) : (
                        <>
                            <div>{formatDate(expiresAt)}</div>
                            <div className="text-muted-foreground">
                                {formatRelativeDateTime(expiresAt)}
                            </div>
                        </>
                    )}
                </dd>
                <dt className="text-muted-foreground">Assessor</dt>
                <dd>
                    {isSynthetic
                        ? "—"
                        : isPending
                          ? "Loading…"
                          : (check?.assessor.name ?? "Unknown")}
                </dd>
            </dl>
            {isSynthetic ? (
                <p className="text-xs text-muted-foreground italic">
                    Synthetic data — no assessor or notes.
                </p>
            ) : (
                check?.notes && <p className="text-xs whitespace-pre-wrap">{check.notes}</p>
            )}
        </>
    );
}
