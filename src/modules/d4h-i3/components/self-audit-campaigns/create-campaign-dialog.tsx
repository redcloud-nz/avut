/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { selfAuditCampaignsEffects } from "@/client/self-audit-campaigns-effects";
import { ObjectIcons } from "@/components/icons";
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

import { D4HI3Module_SelfAuditCampaign_D4HGate } from "./campaign-d4h-gate";

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
                    <D4HI3Module_SelfAuditCampaign_D4HGate>
                        <CreateCampaign_Body />
                    </D4HI3Module_SelfAuditCampaign_D4HGate>
                </DialogBoundary>
            </DialogContent>
        </Dialog>
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
