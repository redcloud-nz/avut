/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/settings/--update
 */
"use client";

import { use } from "react";
import { Controller, useForm, useWatch, Watch } from "react-hook-form";
import { toast } from "sonner";

import { Lens, useLens } from "@hookform/lenses";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { useOrganization } from "@/hooks/use-organization";
import { D4HServerList } from "@/lib/d4h-servers";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { countDirtyFields } from "@/lib/utils";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function AdminModule_Settings_Page(
    props: PageProps<`/main/[slug]/admin/organization/settings`>,
) {
    const { slug } = use(props.params);
    const organization = useOrganization();

    const { data: settings } = useSuspenseQuery(
        trpc.settings.getOrganizationSettings.queryOptions({
            organizationId: organization.id,
        }),
    );

    const queryClient = useQueryClient();

    const form = useForm({
        resolver: zodResolver(OrganizationSettings.schema),
        defaultValues: {
            ...settings,
        },
    });
    const lens = useLens({ control: form.control });

    const mutation = useMutation(
        trpc.settings.updateOrganizationSettings.mutationOptions({
            async onSuccess(updated) {
                await queryClient.invalidateQueries(
                    trpc.settings.getOrganizationSettings.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                console.log("Settings updated successfully:", updated);
                form.reset(updated);
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        toast.promise(
            async () => {
                console.log("Submitting form data:", formData);
                await mutation.mutateAsync({
                    organizationId: organization.id,
                    settings: formData,
                });
            },
            {
                loading: "Updating settings...",
                success: "Settings updated successfully.",
                error: (error) => `Failed to update settings: ${error.message}`,
            },
        );
    });

    const dirtyFieldCount = countDirtyFields(form.formState.dirtyFields);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.organization,
                    Paths.main(slug).admin.organization.settings,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <form id="organization-settings-form" className="pb-14" onSubmit={handleSubmit}>
                        <Hermes.Section>
                            <Hermes.Header>
                                <Hermes.BackButton
                                    to={Paths.main(slug).admin.organization}
                                    tooltip="Back to organization overview"
                                />
                                <Hermes.Title>Organization Settings</Hermes.Title>
                            </Hermes.Header>
                            <General_SettingsCard lens={lens.focus("general")} />
                        </Hermes.Section>

                        <Hermes.Section>
                            <Hermes.Header>
                                <Hermes.Title>Integrations</Hermes.Title>
                            </Hermes.Header>
                            <D4hIntegration_SettingsCard
                                lens={lens.focus("integrations.d4h")}
                                organizationId={organization.id}
                            />
                            <EmailIntegration_SettingsCard
                                lens={lens.focus("integrations.email")}
                            />
                        </Hermes.Section>

                        <Hermes.Section>
                            <Hermes.Header>
                                <Hermes.Title>Modules</Hermes.Title>
                            </Hermes.Header>

                            <D4HViewsModule_SettingsCard
                                lens={lens.focus("modules.d4h-views")}
                                organizationId={organization.id}
                            />
                            <FormsModule_SettingsCard lens={lens.focus("modules.forms")} />
                            <I3Module_SettingsCard
                                lens={lens.focus("modules.i3")}
                                organizationId={organization.id}
                            />
                            <NotesModule_SettingsCard lens={lens.focus("modules.notes")} />
                            <SkillsModule_SettingsCard lens={lens.focus("modules.skills")} />
                            <SkillPackageBuilderModule_SettingsCard
                                lens={lens.focus("modules.skill-package-builder")}
                            />
                        </Hermes.Section>

                        {dirtyFieldCount > 0 && (
                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 min-w-100 border border-gray-300 bg-gray-200/75 rounded-sm shadow px-4 py-2 flex items-center gap-2">
                                <Button type="submit">Save</Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => form.reset()}
                                >
                                    Cancel
                                </Button>
                                <div className="grow text-right">
                                    {dirtyFieldCount > 1
                                        ? `${dirtyFieldCount} unsaved changes`
                                        : "1 unsaved change"}
                                </div>
                            </div>
                        )}
                    </form>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}

function General_SettingsCard({ lens }: { lens: Lens<Partial<OrganizationSettings["general"]>> }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Controller
                        {...lens.focus("publicDomain").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldContent>
                                    <FieldLabel htmlFor="public-domain">
                                        Public Domain Name
                                    </FieldLabel>
                                    <FieldDescription>
                                        Optional custom domain for this organisations public
                                        resources. Must be a valid domain format without protocol.
                                    </FieldDescription>
                                </FieldContent>

                                <FieldContent>
                                    <Input
                                        id="public-domain"
                                        className="min-w-1/2"
                                        aria-invalid={fieldState.invalid}
                                        value={field.value}
                                        onChange={(ev) => {
                                            const value = ev.target.value;
                                            if (value === "") {
                                                field.onChange(undefined);
                                            } else {
                                                field.onChange(value);
                                            }
                                        }}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </FieldContent>
                            </Field>
                        )}
                    />
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

function D4hIntegration_SettingsCard({
    lens,
    organizationId,
}: {
    lens: Lens<Partial<OrganizationSettings["integrations"]["d4h"]>>;
    organizationId: OrganizationId;
}) {
    const { data: d4hAccessTokens } = useQuery(
        trpc.d4hAccessTokens.listOrganizationAccessTokens.queryOptions({
            organizationId,
        }),
    );

    const integrationEnabled = useWatch(lens.focus("enabled").interop());

    return (
        <Card>
            <CardHeader>
                <CardTitle>D4H Integration</CardTitle>
                <CardAction>
                    <Controller
                        {...lens.focus("enabled").interop()}
                        render={({ field }) => (
                            <Switch
                                id="d4h-integration-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Controller
                        {...lens.focus("defaultServer").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="d4h-default-server">Default Server</FieldLabel>
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={!integrationEnabled}
                                >
                                    <SelectTrigger
                                        id="d4h-default-server"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                    >
                                        <SelectValue placeholder="Select a server" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {D4HServerList.map((server) => (
                                            <SelectItem key={server.code} value={server.code}>
                                                {server.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Controller
                        {...lens.focus("syncToken").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldContent>
                                    <FieldLabel htmlFor="d4h-sync-token">
                                        Synchronization Token
                                    </FieldLabel>
                                    <FieldDescription>
                                        Already configured D4H Access Token to use for synchronizing
                                        data between AVUT and D4H. Select an existing token or leave
                                        empty to disable synchronization.
                                    </FieldDescription>
                                </FieldContent>

                                <Select
                                    value={field.value || ""}
                                    onValueChange={(value) => {
                                        if (value === "EMPTY") {
                                            field.onChange(null);
                                        } else {
                                            field.onChange(value);
                                        }
                                    }}
                                    disabled={!integrationEnabled}
                                >
                                    <SelectTrigger
                                        id="d4h-sync-token"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                    >
                                        <SelectValue placeholder="Select a synchronization token" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EMPTY">None</SelectItem>
                                        <SelectSeparator />
                                        {d4hAccessTokens?.map((token) => (
                                            <SelectItem key={token.id} value={token.id}>
                                                {token.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Controller
                        {...lens.focus("teamSync").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldContent>
                                    <FieldLabel htmlFor="d4h-team-synchronization">
                                        Team Synchronization
                                    </FieldLabel>
                                    <FieldDescription>
                                        How often team synchronization should occur.
                                    </FieldDescription>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </FieldContent>
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={!integrationEnabled}
                                >
                                    <SelectTrigger
                                        id="d4h-team-synchronization"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                    >
                                        <SelectValue placeholder="Select synchronization frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Never">Never</SelectItem>
                                        <SelectItem value="Daily">Daily</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                    />
                    <Controller
                        {...lens.focus("teamMemberSync").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldContent>
                                    <FieldLabel htmlFor="d4h-team-member-sync">
                                        Team Member Synchronization
                                    </FieldLabel>
                                    <FieldDescription>
                                        How often team member synchronization should occur.
                                    </FieldDescription>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </FieldContent>
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={!integrationEnabled}
                                >
                                    <SelectTrigger
                                        id="d4h-team-member-sync"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                    >
                                        <SelectValue placeholder="Select sync frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Never">Never</SelectItem>
                                        <SelectItem value="Daily">Daily</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                    />
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

function EmailIntegration_SettingsCard({
    lens,
}: {
    lens: Lens<Partial<OrganizationSettings["integrations"]["email"]>>;
}) {
    const integrationEnabled = useWatch(lens.focus("enabled").interop());

    return (
        <Card>
            <CardHeader>
                <CardTitle>Email Integration</CardTitle>
                <CardAction>
                    <Controller
                        {...lens.focus("enabled").interop()}
                        render={({ field }) => (
                            <Switch
                                id="email-integration-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    {/* Currently no additional settings for email integration, but we could add some in the future */}
                    <div className="text-sm text-muted-foreground">
                        No additional settings available.
                    </div>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

function D4HViewsModule_SettingsCard({
    lens,
    organizationId,
}: {
    lens: Lens<Partial<OrganizationSettings["modules"]["d4h-views"]>>;
    organizationId: OrganizationId;
}) {
    const { data: d4hAccessTokens } = useQuery(
        trpc.d4hAccessTokens.listOrganizationAccessTokens.queryOptions({
            organizationId,
        }),
    );

    const enabled = useWatch(lens.focus("enabled").interop());

    return (
        <Card>
            <CardHeader>
                <CardTitle>D4H Views Module</CardTitle>
                <CardAction>
                    <Controller
                        {...lens.focus("enabled").interop()}
                        render={({ field }) => (
                            <Switch
                                id="d4h-views-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Controller
                        {...lens.focus("d4hSharedTokenId").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="d4h-views-token">
                                    Shared D4H Access Token
                                </FieldLabel>

                                <Select
                                    value={field.value || ""}
                                    onValueChange={(value) => {
                                        if (value === "EMPTY") {
                                            field.onChange(null);
                                        } else {
                                            field.onChange(value);
                                        }
                                    }}
                                >
                                    <SelectTrigger
                                        id="d4h-views-token"
                                        aria-invalid={fieldState.invalid}
                                    >
                                        <SelectValue placeholder="Select a shared access token" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EMPTY">None</SelectItem>
                                        <SelectSeparator />
                                        {d4hAccessTokens?.map((token) => (
                                            <SelectItem key={token.id} value={token.id}>
                                                {token.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    An already configured D4H Access Token for use with the
                                    "SharedToken" strategy.
                                </FieldDescription>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Controller
                        {...lens.focus("d4hReadStrategy").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="d4h-views-read-strategy">
                                    D4H Read Strategy
                                </FieldLabel>

                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={!enabled}
                                >
                                    <SelectTrigger
                                        id="d4h-views-read-strategy"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                    >
                                        <SelectValue placeholder="Select token policy" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SharedToken">Shared Token</SelectItem>
                                        <SelectItem value="PersonalToken">
                                            Personal Token
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <FieldDescription>
                                    Strategy to use for reading data from D4H within the D4H Views
                                    module.
                                </FieldDescription>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Controller
                        {...lens.focus("d4hWriteStrategy").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="d4h-views-write-strategy">
                                    D4H Write Strategy
                                </FieldLabel>

                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={!enabled}
                                >
                                    <SelectTrigger
                                        id="d4h-views-write-strategy"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                    >
                                        <SelectValue placeholder="Select token policy" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SharedToken">Shared Token</SelectItem>
                                        <SelectItem value="PersonalToken">
                                            Personal Token
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <FieldDescription>
                                    Strategy to use for writing data to D4H within the D4H Views
                                    module.
                                </FieldDescription>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

function FormsModule_SettingsCard({
    lens,
}: {
    lens: Lens<Partial<OrganizationSettings["modules"]["forms"]>>;
}) {
    const enabled = useWatch(lens.focus("enabled").interop());

    return (
        <Card>
            <CardHeader>
                <CardTitle>Forms Module</CardTitle>
                <CardAction>
                    <Controller
                        {...lens.focus("enabled").interop()}
                        render={({ field }) => (
                            <Switch
                                id="forms-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <FieldGroup></FieldGroup>
            </CardContent>
        </Card>
    );
}

function I3Module_SettingsCard({
    lens,
    organizationId,
}: {
    lens: Lens<Partial<OrganizationSettings["modules"]["i3"]>>;
    organizationId: OrganizationId;
}) {
    const { data: d4hAccessTokens } = useQuery(
        trpc.d4hAccessTokens.listOrganizationAccessTokens.queryOptions({
            organizationId,
        }),
    );

    const enabled = useWatch(lens.focus("enabled").interop());

    return (
        <Card>
            <CardHeader>
                <CardTitle>I3 Module</CardTitle>
                <CardAction>
                    <Controller
                        {...lens.focus("enabled").interop()}
                        render={({ field }) => (
                            <Switch
                                id="i3-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <Controller
                        {...lens.focus("storage").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="i3-storage">I3 Data Storage</FieldLabel>
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={!enabled}
                                >
                                    <SelectTrigger
                                        id="i3-storage"
                                        aria-invalid={fieldState.invalid}
                                    >
                                        <SelectValue placeholder="Select I3 data storage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AVUT" disabled>
                                            AVUT
                                        </SelectItem>
                                        <SelectItem value="D4H">D4H</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    Where should I3 item-data be stored? If AVUT is selected, I3
                                    data will be stored in AVUT's database. If D4H is selected, I3
                                    data will be stored in D4H and associated with the corresponding
                                    teams and team members.
                                </FieldDescription>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Controller
                        {...lens.focus("d4hSharedTokenId").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="i3-d4h-shared-token">
                                    Shared D4H Access Token
                                </FieldLabel>

                                <Select
                                    value={field.value || ""}
                                    onValueChange={(value) => {
                                        if (value === "EMPTY") {
                                            field.onChange(null);
                                        } else {
                                            field.onChange(value);
                                        }
                                    }}
                                >
                                    <SelectTrigger
                                        id="i3-d4h-shared-token"
                                        aria-invalid={fieldState.invalid}
                                    >
                                        <SelectValue placeholder="Select a shared access token" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EMPTY">None</SelectItem>
                                        <SelectSeparator />
                                        {d4hAccessTokens?.map((token) => (
                                            <SelectItem key={token.id} value={token.id}>
                                                {token.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    An already configured D4H Access Token for use with the
                                    "SharedToken" strategy.
                                </FieldDescription>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Controller
                        {...lens.focus("d4hReadStrategy").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="i3-d4h-read-strategy">
                                    D4H Read Strategy
                                </FieldLabel>

                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={!enabled}
                                >
                                    <SelectTrigger
                                        id="i3-d4h-read-strategy"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                    >
                                        <SelectValue placeholder="Select token policy" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SharedToken">Shared Token</SelectItem>
                                        <SelectItem value="PersonalToken">
                                            Personal Token
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <FieldDescription>
                                    Strategy to use for reading data from D4H within the I3 module.
                                </FieldDescription>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                    <Controller
                        {...lens.focus("d4hWriteStrategy").interop()}
                        render={({ field, fieldState }) => (
                            <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="i3-d4h-write-strategy">
                                    D4H Write Strategy
                                </FieldLabel>

                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={!enabled}
                                >
                                    <SelectTrigger
                                        id="i3-d4h-write-strategy"
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
                                    >
                                        <SelectValue placeholder="Select token policy" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SharedToken">Shared Token</SelectItem>
                                        <SelectItem value="PersonalToken">
                                            Personal Token
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <FieldDescription>
                                    Strategy to use for writing data to D4H within the I3 module.
                                </FieldDescription>
                                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

function NotesModule_SettingsCard({
    lens,
}: {
    lens: Lens<Partial<OrganizationSettings["modules"]["notes"]>>;
}) {
    const enabled = useWatch(lens.focus("enabled").interop());

    return (
        <Card>
            <CardHeader>
                <CardTitle>Notes Module</CardTitle>
                <CardAction>
                    <Controller
                        {...lens.focus("enabled").interop()}
                        render={({ field }) => (
                            <Switch
                                id="notes-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <FieldGroup></FieldGroup>
            </CardContent>
        </Card>
    );
}

function SkillsModule_SettingsCard({
    lens,
}: {
    lens: Lens<Partial<OrganizationSettings["modules"]["skills"]>>;
}) {
    const enabled = useWatch(lens.focus("enabled").interop());

    return (
        <Card>
            <CardHeader>
                <CardTitle>Skills Module</CardTitle>
                <CardAction>
                    <Controller
                        {...lens.focus("enabled").interop()}
                        render={({ field }) => (
                            <Switch
                                id="skills-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <FieldGroup></FieldGroup>
            </CardContent>
        </Card>
    );
}

function SkillPackageBuilderModule_SettingsCard({
    lens,
}: {
    lens: Lens<Partial<OrganizationSettings["modules"]["skill-package-builder"]>>;
}) {
    const enabled = useWatch(lens.focus("enabled").interop());

    return (
        <Card>
            <CardHeader>
                <CardTitle>Skill Package Builder Module</CardTitle>
                <CardAction>
                    <Controller
                        {...lens.focus("enabled").interop()}
                        render={({ field }) => (
                            <Switch
                                id="skill-package-builder-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <FieldGroup></FieldGroup>
            </CardContent>
        </Card>
    );
}
