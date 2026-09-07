/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { CheckIcon, ClockIcon, MapPinIcon, XIcon } from "lucide-react";
import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";

import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";

type Availability = "d4h-disabled" | "no-personal-token" | "ready";

type Status = "attending" | "absent" | "requested" | "not-involved";

const STATUS_META: Record<
    Status,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    attending: { label: "Attending", variant: "default" },
    absent: { label: "Absent", variant: "destructive" },
    requested: { label: "Pending", variant: "secondary" },
    "not-involved": { label: "Not involved", variant: "outline" },
};

export function D4hToday_Content({ availability }: { availability: Availability }) {
    return (
        <Saratoga.Root className="max-w-3xl">
            <Saratoga.Header>
                <Saratoga.Title>Have I responded to today&rsquo;s training?</Saratoga.Title>
            </Saratoga.Header>

            {availability === "ready" ? (
                <D4hToday_Answer />
            ) : (
                <D4hToday_NotConfigured availability={availability} />
            )}
        </Saratoga.Root>
    );
}

function D4hToday_NotConfigured({
    availability,
}: {
    availability: Exclude<Availability, "ready">;
}) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyTitle>
                    {availability === "d4h-disabled"
                        ? "D4H isn't connected"
                        : "No personal D4H token"}
                </EmptyTitle>
                <EmptyDescription>
                    {availability === "d4h-disabled" ? (
                        "This organization doesn't have the D4H integration enabled, so there's nothing to show here."
                    ) : (
                        <>
                            Add a personal D4H access token in your{" "}
                            <Link href="/user-settings" className="underline underline-offset-4">
                                account settings
                            </Link>{" "}
                            to see your schedule.
                        </>
                    )}
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}

function D4hToday_Answer() {
    const organization = useOrganization();

    const { data: groups } = useSuspenseQuery(
        trpc.d4hApi.myActivitiesToday.queryOptions({ organizationId: organization.id }),
    );

    const showTeamHeadings = groups.length > 1;
    const everything = groups.flatMap((group) =>
        group.activities.map((activity) => ({ ...activity, timezone: group.timezone })),
    );
    const pending = everything.filter((a) => a.status === "requested");

    if (everything.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>Nothing scheduled today</EmptyTitle>
                    <EmptyDescription>
                        No events, exercises or incidents involve you today.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const responded = pending.length === 0;

    return (
        <div className="space-y-8">
            <Card className="overflow-hidden">
                <CardContent className="flex flex-col items-center gap-6 py-14 text-center">
                    {responded ? (
                        <>
                            <div className="flex size-24 items-center justify-center rounded-full bg-primary/10">
                                <CheckIcon className="size-14 text-primary" />
                            </div>
                            <p className="text-8xl font-black tracking-tighter text-primary sm:text-9xl">
                                YES
                            </p>
                            <p className="max-w-md text-muted-foreground">
                                You&rsquo;ve responded to everything scheduled for you today.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="flex size-24 items-center justify-center rounded-full bg-destructive/10">
                                <XIcon className="size-14 text-destructive" />
                            </div>
                            <p className="text-8xl font-black tracking-tighter text-destructive sm:text-9xl">
                                NO
                            </p>
                            <p className="text-sm font-medium text-muted-foreground">
                                {pending.length === 1
                                    ? "Still awaiting your response:"
                                    : `${pending.length} activities awaiting your response:`}
                            </p>
                            <div className="w-full max-w-md space-y-2">
                                {pending.map((activity) => (
                                    <div
                                        key={`${activity.type}-${activity.id}`}
                                        className="space-y-1"
                                    >
                                        <p className="text-lg font-medium">{activity.title}</p>
                                        <p className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                                            <span className="inline-flex items-center gap-1">
                                                <ClockIcon className="size-3.5" />
                                                {formatTimeRange(activity)}
                                            </span>
                                            {activity.location && (
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPinIcon className="size-3.5" />
                                                    {activity.location}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Respond in D4H to clear this.
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                        Today&rsquo;s schedule
                    </h2>
                    <Separator className="flex-1" />
                </div>
                {groups
                    .filter((group) => group.activities.length > 0)
                    .map((group) => (
                        <div key={group.team.id} className="space-y-3">
                            {showTeamHeadings && (
                                <h3 className="pt-2 text-xs font-semibold text-muted-foreground uppercase">
                                    {group.team.title}
                                </h3>
                            )}
                            {group.activities.map((activity) => (
                                <Card key={`${activity.type}-${activity.id}`}>
                                    <CardContent className="flex items-center gap-4 py-3">
                                        <Badge
                                            variant="outline"
                                            className="w-20 shrink-0 justify-center"
                                        >
                                            {activity.type}
                                        </Badge>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {activity.title}
                                            </p>
                                            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                                <span className="inline-flex items-center gap-1">
                                                    <ClockIcon className="size-3" />
                                                    {formatTimeRange({
                                                        ...activity,
                                                        timezone: group.timezone,
                                                    })}
                                                </span>
                                                {activity.location && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPinIcon className="size-3" />
                                                        {activity.location}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <Badge variant={STATUS_META[activity.status].variant}>
                                            {STATUS_META[activity.status].label}
                                        </Badge>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ))}
            </div>
        </div>
    );
}

function formatTimeRange(activity: { startsAt: string; endsAt: string; timezone: string }): string {
    const fmt = (iso: string) =>
        new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: activity.timezone,
        }).format(new Date(iso));
    return `${fmt(activity.startsAt)} – ${fmt(activity.endsAt)}`;
}
