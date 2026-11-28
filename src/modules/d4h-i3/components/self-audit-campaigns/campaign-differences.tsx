/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense, useEffect, useId, useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardLoadingFallback,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import type { SelfAuditCampaignId, SelfAuditRequestId } from "@/lib/schemas/self-audit";
import type { SelfAuditDifference, SelfAuditDifferences } from "@/lib/self-audit-differences";
import { trpc } from "@/trpc/client";

import { D4HI3Module_ApplySelfAuditFixes_Dialog } from "./apply-fixes-dialog";
import {
    D4HI3Module_SelfAuditCampaign_D4HGate,
    D4HI3Module_SelfAuditCampaign_NoD4HAlert,
} from "./campaign-d4h-gate";
import { describeFix, DIFFERENCE_KIND_LABELS } from "./campaign-labels";

type Member = SelfAuditDifferences["members"][number];

const NOT_IN_TEAM = "No longer in the D4H team";

/**
 * A self audit campaign's differences from D4H: per submitted member, where their answer disagrees
 * with what D4H has issued to them now, and what applying each fix would do. The differences are
 * read live from D4H with the caller's token, so they load behind their own boundary under the
 * header; with no token, the no-D4H alert takes their place.
 */
export function D4HI3Module_SelfAuditCampaignDifferences({
    campaignId,
}: {
    campaignId: SelfAuditCampaignId;
}) {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: campaign } = useSuspenseQuery(
        trpc.selfAuditCampaigns.getCampaign.queryOptions({
            organizationId: organization.id,
            campaignId,
        }),
    );

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "Self Audit Campaigns",
                        href: route("/orgs/[slug]/d4h-i3/self-audit-campaigns", { slug }),
                    },
                    {
                        label: campaign.name,
                        href: route("/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]", {
                            slug,
                            campaign_id: campaign.id,
                        }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title>Differences from D4H</Saratoga.Title>
            </Saratoga.Header>
            <D4HI3Module_SelfAuditCampaign_D4HGate
                fallback={<D4HI3Module_SelfAuditCampaign_NoD4HAlert />}
            >
                <Suspense fallback={<CardLoadingFallback />}>
                    <DifferencesBody campaignId={campaignId} />
                </Suspense>
            </D4HI3Module_SelfAuditCampaign_D4HGate>
        </Saratoga.Root>
    );
}

/**
 * The members' cards, those with differences first, then the ones matching D4H. Hosts
 * `?action=apply&requestId=…`; the selection lives here, per member, and the dialog gets the
 * differences selected when Apply was pressed. A reload loses the selection, so the param it
 * strands is cleared.
 */
function DifferencesBody({ campaignId }: { campaignId: SelfAuditCampaignId }) {
    const organization = useOrganization();

    const { data } = useSuspenseQuery(
        trpc.selfAuditCampaigns.listDifferences.queryOptions({
            organizationId: organization.id,
            campaignId,
        }),
    );

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["apply"] as const));
    const [requestId, setRequestId] = useQueryState("requestId", parseAsString);

    /** Per request id, the selected difference keys. */
    const [selected, setSelected] = useState<Record<string, readonly string[]>>({});
    /** What the open (or last opened) apply dialog confirms. */
    const [confirming, setConfirming] = useState<{
        member: { requestId: SelfAuditRequestId; memberName: string };
        differences: SelfAuditDifference[];
    } | null>(null);

    /** A member's selected differences that are still there and still selectable. */
    function selectedOf(member: Member): SelfAuditDifference[] {
        const keys = selected[member.requestId] ?? [];
        return member.differences.filter(
            (difference) => difference.state === "selectable" && keys.includes(difference.key),
        );
    }

    function toggle(member: Member, key: string, checked: boolean) {
        const current = selectedOf(member).map((difference) => difference.key);
        setSelected({
            ...selected,
            [member.requestId]: checked
                ? [...current, key]
                : current.filter((selectedKey) => selectedKey !== key),
        });
    }

    function openApply(member: Member) {
        setConfirming({
            member: { requestId: member.requestId, memberName: member.memberName },
            differences: selectedOf(member),
        });
        void setRequestId(member.requestId, { history: "push" });
        void setAction("apply", { history: "push" });
    }
    function closeApply() {
        void setAction(null, { history: "replace" });
        void setRequestId(null, { history: "replace" });
    }

    // Opened with nothing confirmed (a reload, a pasted link, Forward after an apply): clear it.
    const strandedAction =
        action === "apply" && (confirming === null || confirming.member.requestId !== requestId);
    useEffect(() => {
        if (strandedAction) closeApply();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the param becomes stranded
    }, [strandedAction]);

    const withDifferences = data.members.filter((member) => member.differences.length > 0);
    const matching = data.members.filter((member) => member.differences.length === 0);

    return (
        <>
            {(!data.permissions.update || !data.permissions.create) && (
                <Alert variant="info">
                    <AlertTitle>Your D4H token can&rsquo;t make every fix</AlertTitle>
                    <AlertDescription>
                        {!data.permissions.update && (
                            <p>
                                Without Equipment UPDATE on this team, an item a member says they
                                don&rsquo;t have is queued as a task to mark it LOST, rather than
                                marked LOST in D4H.
                            </p>
                        )}
                        {!data.permissions.create && (
                            <p>
                                Without Equipment CREATE on this team, an item a member has that D4H
                                doesn&rsquo;t record can&rsquo;t be created.
                            </p>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {data.members.length === 0 ? (
                <Empty>
                    <EmptyDescription>
                        No members have submitted their answers yet.
                    </EmptyDescription>
                </Empty>
            ) : (
                <>
                    {withDifferences.length === 0 && (
                        <Empty>
                            <EmptyDescription>Every submitted answer matches D4H.</EmptyDescription>
                        </Empty>
                    )}
                    {withDifferences.map((member) => (
                        <MemberCard
                            key={member.requestId}
                            member={member}
                            selected={selectedOf(member)}
                            onToggle={(key, checked) => toggle(member, key, checked)}
                            onApply={() => openApply(member)}
                        />
                    ))}
                    {matching.length > 0 && (
                        <Collapsible>
                            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 border-b pb-1 font-semibold hover:text-accent-foreground">
                                <span>Match D4H</span>
                                <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                                    {matching.length} {matching.length === 1 ? "member" : "members"}
                                    <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <ul className="flex flex-col gap-1 pt-3 text-sm">
                                    {matching.map((member) => (
                                        <li
                                            key={member.requestId}
                                            className="flex flex-wrap items-center gap-2"
                                        >
                                            {member.memberName}
                                            {!member.inTeam && (
                                                <Badge variant="warning-outline">
                                                    {NOT_IN_TEAM}
                                                </Badge>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </>
            )}

            {confirming && (
                <D4HI3Module_ApplySelfAuditFixes_Dialog
                    member={confirming.member}
                    differences={confirming.differences}
                    onApplied={() => {
                        setSelected({ ...selected, [confirming.member.requestId]: [] });
                        setConfirming(null);
                    }}
                    open={action === "apply" && requestId === confirming.member.requestId}
                    onOpenChange={(open) => (open ? undefined : closeApply())}
                />
            )}
        </>
    );
}

/** One member's differences, each with what applying it would do, and their Apply button. */
function MemberCard({
    member,
    selected,
    onToggle,
    onApply,
}: {
    member: Member;
    selected: readonly SelfAuditDifference[];
    onToggle: (key: string, checked: boolean) => void;
    onApply: () => void;
}) {
    const idPrefix = useId();
    const selectedKeys = selected.map((difference) => difference.key);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{member.memberName}</CardTitle>
                {!member.inTeam && <CardDescription>{NOT_IN_TEAM}</CardDescription>}
            </CardHeader>
            <CardContent>
                <ul className="flex flex-col gap-3">
                    {member.differences.map((difference) => {
                        const checkboxId = `${idPrefix}-${difference.key}`;
                        return (
                            <li key={difference.key} className="flex items-start gap-3">
                                <Checkbox
                                    id={checkboxId}
                                    className="mt-0.5"
                                    checked={selectedKeys.includes(difference.key)}
                                    disabled={difference.state !== "selectable"}
                                    onCheckedChange={(checked) =>
                                        onToggle(difference.key, checked === true)
                                    }
                                    aria-label={
                                        difference.state === "selectable"
                                            ? undefined
                                            : `${difference.label}: ${outcomeOf(difference)}`
                                    }
                                />
                                <div className="flex min-w-0 grow flex-col gap-1 text-sm sm:flex-row sm:justify-between sm:gap-4">
                                    <label htmlFor={checkboxId} className="flex flex-col gap-0.5">
                                        <span className="flex flex-wrap items-center gap-2 font-medium">
                                            {difference.label}
                                            <Badge variant="outline">
                                                {DIFFERENCE_KIND_LABELS[difference.kind]}
                                            </Badge>
                                        </span>
                                        <span className="text-muted-foreground">
                                            {difference.detail}
                                        </span>
                                    </label>
                                    <Outcome difference={difference} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </CardContent>
            <CardFooter className="justify-end">
                <Button disabled={selected.length === 0} onClick={onApply}>
                    Apply selected ({selected.length})
                </Button>
            </CardFooter>
        </Card>
    );
}

/** What a difference's state means for it: its fix, Queued, why not, or information only. */
function outcomeOf(difference: SelfAuditDifference): string {
    switch (difference.state) {
        case "selectable":
            return difference.fix ? describeFix(difference.fix) : "";
        case "queued":
            return "Queued";
        case "unavailable":
            return difference.reason ?? "Can't be applied";
        case "info":
            return difference.reason ?? "Information only";
    }
}

function Outcome({ difference }: { difference: SelfAuditDifference }) {
    const text = outcomeOf(difference);
    switch (difference.state) {
        case "selectable":
            return <span className="shrink-0 sm:text-right">{text}</span>;
        case "queued":
            return (
                <span className="shrink-0">
                    <Badge variant="info-outline">{text}</Badge>
                </span>
            );
        case "unavailable":
            return <span className="shrink-0 text-warning-foreground sm:text-right">{text}</span>;
        case "info":
            return <span className="shrink-0 text-muted-foreground sm:text-right">{text}</span>;
    }
}
