/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    parseAsArrayOf,
    parseAsInteger,
    parseAsString,
    parseAsStringLiteral,
    useQueryState,
} from "nuqs";
import { Suspense, useEffect, useId, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";

import { QueryErrorResetBoundary, useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { kitChecksEffects } from "@/client/kit-checks-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardLoadingFallback,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import type { ExcludedReason } from "@/lib/i3-bundle-compare";
import { route } from "@/lib/routes";
import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { KIT_CHECK_D4H_TEAMS_MAX, type KitCheckTeamChoice } from "@/lib/schemas/kit-check";
import { trpc } from "@/trpc/client";

/** Whether the viewer can read D4H here: the page needs their personal D4H token. */
export type KitCheckD4HAvailability = "d4h-disabled" | "no-personal-token" | "ready";

const EXCLUDED_LABELS: Record<ExcludedReason, string> = {
    deleted: "Deleted template",
    "no-d4h-type": "No D4H type",
    "not-in-team": "Not used by this team",
};

/**
 * The new kit check page: pick a bundle and D4H teams, preview who it goes to, then send. The
 * picks live in the URL (`?bundle=…&teams=…`), so a reload keeps them.
 */
export function D4HI3Module_KitCheckNew({
    availability,
    emailRedirected,
}: {
    availability: KitCheckD4HAvailability;
    /** Outside production, every email goes to the Resend sink instead of its recipient. */
    emailRedirected: boolean;
}) {
    const organization = useOrganization();

    // Read even without a D4H token, so a caller who isn't a system admin gets the procedure's
    // Forbidden rather than the token state.
    const { data: bundles } = useSuspenseQuery(
        trpc.kitChecks.listBundles.queryOptions({ organizationId: organization.id }),
    );

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "Kit Checks",
                        href: route("/orgs/[slug]/d4h-i3/kit-checks", { slug: organization.slug }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title>New Kit Check</Saratoga.Title>
            </Saratoga.Header>
            {availability === "ready" ? (
                <KitCheckNew_Picker bundles={bundles} emailRedirected={emailRedirected} />
            ) : (
                <KitCheckNew_NoD4H availability={availability} />
            )}
        </Saratoga.Root>
    );
}

function KitCheckNew_NoD4H({
    availability,
}: {
    availability: Exclude<KitCheckD4HAvailability, "ready">;
}) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyTitle>
                    {availability === "d4h-disabled"
                        ? "D4H isn't connected"
                        : "Needs your personal D4H token"}
                </EmptyTitle>
                <EmptyDescription>
                    {availability === "d4h-disabled" ? (
                        "This organization doesn't have the D4H integration enabled, so there's no one to send a kit check to."
                    ) : (
                        <>
                            A kit check reads each member&rsquo;s equipment from D4H with your own
                            token. Add one in{" "}
                            <Link
                                href="/user/settings/d4h"
                                className="underline underline-offset-4"
                            >
                                User Settings › D4H
                            </Link>
                            .
                        </>
                    )}
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}

function KitCheckNew_Picker({
    bundles,
    emailRedirected,
}: {
    bundles: { id: I3BundleId; name: string; templateCount: number }[];
    emailRedirected: boolean;
}) {
    const organization = useOrganization();
    const idPrefix = useId();

    const { data: d4hTeams } = useSuspenseQuery(
        trpc.kitChecks.listD4HTeams.queryOptions({ organizationId: organization.id }),
    );

    const [bundleParam, setBundleParam] = useQueryState("bundle", parseAsString);
    const [teamsParam, setTeamsParam] = useQueryState(
        "teams",
        parseAsArrayOf(parseAsInteger).withDefault([]),
    );

    // Ignore picks from the URL that aren't on offer (a stale or hand-edited link).
    const bundle = bundles.find((b) => b.id === bundleParam) ?? null;
    const d4hTeamIds = d4hTeams
        .filter((t) => teamsParam.includes(t.id))
        .map((t) => t.id)
        .slice(0, KIT_CHECK_D4H_TEAMS_MAX);
    const atTeamCap = d4hTeamIds.length >= KIT_CHECK_D4H_TEAMS_MAX;

    function toggleTeam(teamId: number, checked: boolean) {
        const next = checked ? [...d4hTeamIds, teamId] : d4hTeamIds.filter((id) => id !== teamId);
        void setTeamsParam(next.length > 0 ? next : null, { history: "replace" });
    }

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardContent>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor={`${idPrefix}-bundle`}>Bundle</FieldLabel>
                            <Select
                                value={bundle?.id ?? ""}
                                onValueChange={(value) =>
                                    void setBundleParam(value, { history: "replace" })
                                }
                            >
                                <SelectTrigger id={`${idPrefix}-bundle`} className="w-full">
                                    <SelectValue placeholder="Select a bundle" />
                                </SelectTrigger>
                                <SelectContent>
                                    {bundles.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <FieldSet>
                            <FieldLegend variant="label">D4H teams</FieldLegend>
                            {d4hTeams.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Your D4H token doesn&rsquo;t reach any teams.
                                </p>
                            ) : (
                                d4hTeams.map((team) => {
                                    const checked = d4hTeamIds.includes(team.id);
                                    return (
                                        <Field
                                            orientation="horizontal"
                                            key={team.id}
                                            data-disabled={!checked && atTeamCap}
                                        >
                                            <Checkbox
                                                id={`${idPrefix}-team-${team.id}`}
                                                checked={checked}
                                                disabled={!checked && atTeamCap}
                                                onCheckedChange={(next) =>
                                                    toggleTeam(team.id, next === true)
                                                }
                                            />
                                            <FieldLabel htmlFor={`${idPrefix}-team-${team.id}`}>
                                                {team.title}
                                            </FieldLabel>
                                        </Field>
                                    );
                                })
                            )}
                            {atTeamCap && (
                                <p className="text-sm text-muted-foreground">
                                    A kit check goes to at most {KIT_CHECK_D4H_TEAMS_MAX} teams.
                                    Untick one to pick another.
                                </p>
                            )}
                        </FieldSet>
                    </FieldGroup>
                </CardContent>
            </Card>

            {bundle && d4hTeamIds.length > 0 ? (
                // A new bundle or team set starts a fresh choice, everyone ticked, and clears an
                // earlier preview's error.
                <QueryErrorResetBoundary key={`${bundle.id}:${d4hTeamIds.join(",")}`}>
                    {({ reset }) => (
                        <ErrorBoundary
                            onReset={reset}
                            fallbackRender={({ error, resetErrorBoundary }) => (
                                <Alert variant="destructive">
                                    <AlertTitle>Couldn&rsquo;t preview the kit check</AlertTitle>
                                    <AlertDescription>
                                        {error instanceof Error ? error.message : String(error)}
                                    </AlertDescription>
                                    <AlertAction>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={resetErrorBoundary}
                                        >
                                            Try again
                                        </Button>
                                    </AlertAction>
                                </Alert>
                            )}
                        >
                            <Suspense fallback={<CardLoadingFallback />}>
                                <KitCheckNew_Preview
                                    bundleId={bundle.id}
                                    bundleName={bundle.name}
                                    d4hTeamIds={d4hTeamIds}
                                    emailRedirected={emailRedirected}
                                />
                            </Suspense>
                        </ErrorBoundary>
                    )}
                </QueryErrorResetBoundary>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Pick a bundle and at least one team to see who the kit check goes to.
                </p>
            )}
        </div>
    );
}

function KitCheckNew_Preview({
    bundleId,
    bundleName,
    d4hTeamIds,
    emailRedirected,
}: {
    bundleId: I3BundleId;
    bundleName: string;
    d4hTeamIds: number[];
    emailRedirected: boolean;
}) {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.kitChecks.previewRecipients.queryOptions({
            organizationId: organization.id,
            bundleId,
            d4hTeamIds,
        }),
    );

    // Who's left out, by team: everyone starts ticked, no-email members included (decision 12).
    const [unchosen, setUnchosen] = useState<ReadonlyMap<number, ReadonlySet<number>>>(
        () => new Map(),
    );

    const isChosen = (teamId: number, memberId: number) =>
        !(unchosen.get(teamId)?.has(memberId) ?? false);

    function setMembersChosen(teamId: number, memberIds: number[], chosen: boolean) {
        setUnchosen((current) => {
            const teamUnchosen = new Set(current.get(teamId));
            for (const memberId of memberIds) {
                if (chosen) teamUnchosen.delete(memberId);
                else teamUnchosen.add(memberId);
            }
            return new Map(current).set(teamId, teamUnchosen);
        });
    }

    const choices = teams.map(({ team, members }) => ({
        d4hTeamId: team.id,
        d4hMemberIds: members
            .filter((member) => isChosen(team.id, member.id))
            .map((member) => member.id),
    }));
    const chosenMembers = teams.flatMap(({ team, members }) =>
        members.filter((member) => isChosen(team.id, member.id)),
    );
    const emailCount = chosenMembers.filter((member) => member.email !== null).length;
    const noEmailCount = chosenMembers.length - emailCount;

    return (
        <div className="flex flex-col gap-4">
            {teams.map(({ team, templateCount, members, excluded }) => {
                const memberIds = members.map((member) => member.id);
                const chosenCount = memberIds.filter((id) => isChosen(team.id, id)).length;
                return (
                    <Card key={team.id}>
                        <CardHeader>
                            <CardTitle>{team.title}</CardTitle>
                            <CardDescription>
                                {members.length === 1 ? "1 member" : `${members.length} members`},
                                asked about{" "}
                                {templateCount === 1 ? "1 line" : `${templateCount} lines`} of the
                                bundle.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {members.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No members in this team.
                                </p>
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">
                                            {chosenCount} of {members.length} chosen
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={chosenCount === members.length}
                                            onClick={() =>
                                                setMembersChosen(team.id, memberIds, true)
                                            }
                                        >
                                            Select all
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={chosenCount === 0}
                                            onClick={() =>
                                                setMembersChosen(team.id, memberIds, false)
                                            }
                                        >
                                            Select none
                                        </Button>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeadCell className="w-8">
                                                    <span className="sr-only">Send</span>
                                                </TableHeadCell>
                                                <TableHeadCell>Name</TableHeadCell>
                                                <TableHeadCell>Email</TableHeadCell>
                                                <TableHeadCell className="text-center">
                                                    Held
                                                </TableHeadCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {members.map((member) => (
                                                <TableRow key={member.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            aria-label={`Send to ${member.name}`}
                                                            checked={isChosen(team.id, member.id)}
                                                            onCheckedChange={(checked) =>
                                                                setMembersChosen(
                                                                    team.id,
                                                                    [member.id],
                                                                    checked === true,
                                                                )
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell>{member.name}</TableCell>
                                                    <TableCell>
                                                        {member.email ?? (
                                                            <Badge variant="warning-outline">
                                                                No email
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {member.heldCount} of {templateCount}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </>
                            )}
                            {excluded.length > 0 && (
                                <div className="text-sm">
                                    <p className="font-medium">Not asked about</p>
                                    <ul className="list-disc pl-5 text-muted-foreground">
                                        {excluded.map((line) => (
                                            <li key={line.templateId}>
                                                {line.name}: {EXCLUDED_LABELS[line.reason]}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}

            <div className="flex flex-col items-end gap-2">
                {noEmailCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {noEmailCount === 1
                            ? "1 chosen member has no email in D4H. They're listed on the kit check, but not sent a link."
                            : `${noEmailCount} chosen members have no email in D4H. They're listed on the kit check, but not sent a link.`}
                    </p>
                )}
                <KitCheckNew_SendDialog
                    bundleId={bundleId}
                    bundleName={bundleName}
                    choices={choices}
                    teamTitles={teams.map(({ team }) => team.title)}
                    emailCount={emailCount}
                    noEmailCount={noEmailCount}
                    emailRedirected={emailRedirected}
                />
            </div>
        </div>
    );
}

/** Confirms the send: how many emails go out, and where they land outside production. */
function KitCheckNew_SendDialog({
    bundleId,
    bundleName,
    choices,
    teamTitles,
    emailCount,
    noEmailCount,
    emailRedirected,
}: {
    bundleId: I3BundleId;
    bundleName: string;
    /** The chosen members, by team. */
    choices: KitCheckTeamChoice[];
    teamTitles: string[];
    /** Chosen members with an email, each sent a link. */
    emailCount: number;
    /** Chosen members with no email, recorded but not sent one. */
    noEmailCount: number;
    emailRedirected: boolean;
}) {
    const memberCount = emailCount + noEmailCount;
    const logger = useLogger("I3", "SendKitCheck");
    const organization = useOrganization();
    const router = useRouter();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["send"] as const));
    const dialogOpen = action === "send" && memberCount > 0;

    function handleOpenChange(open: boolean) {
        void setAction(open ? "send" : null, { history: open ? "push" : "replace" });
    }

    const mutation = useMutation(
        trpc.kitChecks.createKitCheck.mutationOptions({
            meta: { effects: kitChecksEffects.createKitCheck, navigates: true },
            onError(error) {
                logger.error("Failed to send kit check", error);
                toast.error(`Failed to send kit check: ${error.message}`);
            },
            onSuccess({ kitCheckId, sent, failed, noEmail }) {
                const summary = [
                    `${sent} sent`,
                    ...(failed > 0 ? [`${failed} failed`] : []),
                    ...(noEmail > 0 ? [`${noEmail} with no email`] : []),
                ].join(", ");
                if (failed > 0) toast.warning(`Kit check created: ${summary}.`);
                else toast.success(`Kit check sent: ${summary}.`);
                // Replace, not push: Back from the track page must not reopen a send dialog
                // that one click would send again, emailing everyone twice.
                router.replace(
                    route("/orgs/[slug]/d4h-i3/kit-checks/[kit_check_id]", {
                        slug: organization.slug,
                        kit_check_id: kitCheckId,
                    }),
                );
            },
        }),
    );

    useEffect(() => {
        if (dialogOpen) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const emails = emailCount === 1 ? "1 email" : `${emailCount} emails`;

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button disabled={memberCount === 0}>Send kit check</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Send kit check</DialogTitle>
                    <DialogDescription>
                        Send {bundleName} to {teamTitles.join(", ")}.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="gap-2 text-sm">
                    <p>
                        This sends {emails}, one to each chosen member with an email address, each
                        with their own link. The emails go one at a time, so it can take a little
                        while.
                    </p>
                    {noEmailCount > 0 && (
                        <p>
                            {noEmailCount === 1
                                ? "1 chosen member has no email in D4H. They're recorded on the kit check, but not sent a link."
                                : `${noEmailCount} chosen members have no email in D4H. They're recorded on the kit check, but not sent a link.`}
                        </p>
                    )}
                    {emailRedirected && (
                        <p className="text-muted-foreground">
                            This isn&rsquo;t production, so every email goes to the Resend sink, not
                            to the member.
                        </p>
                    )}
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{ idle: "Send", pending: "Sending", success: "Sent" }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                bundleId,
                                teams: choices,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
