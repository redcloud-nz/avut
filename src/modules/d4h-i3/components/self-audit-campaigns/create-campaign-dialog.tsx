/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { selfAuditCampaignsEffects } from "@/client/self-audit-campaigns-effects";
import { trpcErrorCode } from "@/components/errors/describe-error";
import { ObjectIcons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { SELF_AUDIT_CAMPAIGN_NAME_MAX } from "@/lib/schemas/self-audit";
import { TeamId } from "@/lib/schemas/team";
import { defaultCampaignName } from "@/lib/self-audit-campaign-name";
import { trpc } from "@/trpc/client";

const formSchema = z.object({
    teamId: z.string({ error: "Pick a team." }).pipe(TeamId.schema),
    bundleId: z.string({ error: "Pick a bundle." }).pipe(I3BundleId.schema),
    name: z.string().trim().max(SELF_AUDIT_CAMPAIGN_NAME_MAX),
});

/**
 * `?action=create` — self-triggered: the "New Campaign" button lives here. Pick a team and a
 * bundle (and optionally a name) to make a Draft campaign, then go to it. Picking a team reads D4H
 * with the caller's personal D4H token, so without one the dialog says where to add it.
 */
export function D4HI3Module_CreateSelfAuditCampaign_Dialog() {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const));
    const dialogOpen = action === "create";

    function handleOpenChange(open: boolean) {
        void setAction(open ? "create" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create />{" "}
                    <span className="sr-only md:not-sr-only">New Campaign</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Self Audit Campaign</DialogTitle>
                    <DialogDescription>
                        Start a Draft for one team. You add its members and send it from the
                        campaign&rsquo;s page.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <CreateCampaign_D4HGate />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

/**
 * The team list needs D4H: `listTeams` is PRECONDITION_FAILED when the organization has D4H off or
 * the caller has no personal D4H token here. That one case gets its own body; anything else goes
 * on to `DialogBoundary` (a fallback that throws hands the error to the boundary above).
 */
function CreateCampaign_D4HGate() {
    return (
        <ErrorBoundary
            fallbackRender={({ error }) => {
                if (trpcErrorCode(error) !== "PRECONDITION_FAILED") throw error;
                return <CreateCampaign_NoD4H />;
            }}
        >
            <CreateCampaign_Body />
        </ErrorBoundary>
    );
}

function CreateCampaign_NoD4H() {
    const organization = useOrganization();
    const d4hEnabled = organization.settings.integrations.d4h.enabled !== false;

    return (
        <>
            <DialogBody>
                <Alert variant="warning">
                    <AlertTitle>
                        {d4hEnabled ? "Needs your personal D4H token" : "D4H isn't connected"}
                    </AlertTitle>
                    <AlertDescription>
                        {d4hEnabled ? (
                            <p>
                                A self audit campaign reads its team and each member&rsquo;s
                                equipment from D4H with your own token. Add one in{" "}
                                <Link
                                    href="/user/settings/d4h"
                                    className="underline underline-offset-4"
                                >
                                    User Settings › D4H
                                </Link>
                                .
                            </p>
                        ) : (
                            <p>
                                This organisation doesn&rsquo;t have the D4H integration enabled, so
                                there&rsquo;s no team to send a self audit campaign to.
                            </p>
                        )}
                    </AlertDescription>
                </Alert>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Close</DialogCloseButton>
            </DialogFooter>
        </>
    );
}

function CreateCampaign_Body() {
    const logger = useLogger("I3", "CreateSelfAuditCampaign");
    const organization = useOrganization();
    const router = useRouter();

    const [{ data: teams }, { data: bundles }] = useSuspenseQueries({
        queries: [
            trpc.selfAuditCampaigns.listTeams.queryOptions({ organizationId: organization.id }),
            trpc.selfAuditCampaigns.listBundles.queryOptions({ organizationId: organization.id }),
        ],
    });

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            teamId: teams.length === 1 ? teams[0].id : undefined,
            bundleId: bundles.length === 1 ? bundles[0].id : undefined,
            name: "",
        },
    });

    // The placeholder shows the name the service gives a campaign left unnamed. It's computed here
    // only for display; the service names it, in the same time zone.
    const bundleId = useWatch({ control: form.control, name: "bundleId" });
    const bundle = bundles.find((it) => it.id === bundleId);
    const namePlaceholder = bundle
        ? defaultCampaignName(bundle.name, organization.settings.general.timeZone)
        : "Named after the bundle and the month";

    const mutation = useMutation(
        trpc.selfAuditCampaigns.createCampaign.mutationOptions({
            meta: { effects: selfAuditCampaignsEffects.createCampaign, navigates: true },
            onError(error) {
                logger.error(`Failed to create self audit campaign`, error);
                toast.error(`Failed to create campaign: ${error.message}`);
            },
            onSuccess({ campaignId }) {
                router.push(
                    route("/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]", {
                        slug: organization.slug,
                        campaign_id: campaignId,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        ({ teamId, bundleId, name }) => {
            logger.log(`Creating self audit campaign`, { teamId, bundleId, name });
            mutation.mutate({
                organizationId: organization.id,
                teamId,
                bundleId,
                name: name || undefined,
            });
        },
        (fieldErrors) => {
            console.warn("Form validation errors:", fieldErrors);
        },
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="teamId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${formId}-team`}>Team</FieldLabel>
                                    <Select
                                        value={field.value ?? ""}
                                        onValueChange={(value) => {
                                            // Radix fires "" when it resets inside a form; that isn't a choice.
                                            if (value) field.onChange(value);
                                        }}
                                        disabled={teams.length === 0}
                                    >
                                        <SelectTrigger
                                            id={`${formId}-team`}
                                            aria-invalid={fieldState.invalid}
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Select a team" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {teams.map((team) => (
                                                <SelectItem key={team.id} value={team.id}>
                                                    {team.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>
                                        {teams.length === 0
                                            ? "No active team is linked to a D4H team your token reaches."
                                            : "Active teams linked to a D4H team your token reaches."}
                                    </FieldDescription>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="bundleId"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${formId}-bundle`}>Bundle</FieldLabel>
                                    <Select
                                        value={field.value ?? ""}
                                        onValueChange={(value) => {
                                            if (value) field.onChange(value);
                                        }}
                                        disabled={bundles.length === 0}
                                    >
                                        <SelectTrigger
                                            id={`${formId}-bundle`}
                                            aria-invalid={fieldState.invalid}
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Select a bundle" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bundles.map((it) => (
                                                <SelectItem key={it.id} value={it.id}>
                                                    {it.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {bundles.length === 0 && (
                                        <FieldDescription>
                                            The organisation has no active I3 bundles.
                                        </FieldDescription>
                                    )}
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
                                    <Input
                                        id={`${formId}-name`}
                                        autoComplete="off"
                                        placeholder={namePlaceholder}
                                        aria-describedby={`${formId}-name-description`}
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    <FieldDescription id={`${formId}-name-description`}>
                                        Optional. Left blank, it&rsquo;s named after the bundle and
                                        the month.
                                    </FieldDescription>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form={formId}
                    status={mutation.status}
                    disabled={teams.length === 0 || bundles.length === 0}
                    text={{
                        idle: "Create",
                        pending: "Creating",
                        success: "Created",
                    }}
                />
            </DialogFooter>
        </>
    );
}
