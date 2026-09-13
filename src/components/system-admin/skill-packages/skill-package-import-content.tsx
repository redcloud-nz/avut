/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { SkillPackageImportPlanTable } from "@/components/skill-packages/import-plan-table";
import { useSkillPackageImportFile } from "@/components/skill-packages/use-skill-package-import-file";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type ImportResult = RouterOutput["systemAdmin"]["importSkillPackage"];
type ImportPlan = ImportResult["plan"];

export function SystemAdmin_SkillPackageImport_Content() {
    const { data: orgData } = useSuspenseQuery(trpc.systemAdmin.listOrganizations.queryOptions());

    const file = useSkillPackageImportFile();
    const [targetOrganizationId, setTargetOrganizationId] = useState<string>("");
    const [plan, setPlan] = useState<{ plan: ImportPlan; applied: boolean } | null>(null);

    const preview = useMutation(
        trpc.systemAdmin.importSkillPackage.mutationOptions({
            onError: (error) => toast.error(`Preview failed: ${error.message}`),
            onSuccess: (result) => setPlan(result),
        }),
    );

    const runImport = useMutation(
        trpc.systemAdmin.importSkillPackage.mutationOptions({
            onError: (error) => toast.error(`Import failed: ${error.message}`),
            onSuccess: (result) => {
                setPlan(result);
                toast.success("Skill package imported.");
            },
        }),
    );

    const ready = file.envelope !== null && targetOrganizationId !== "";

    function resetPlan() {
        setPlan(null);
    }

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Skill Packages</Saratoga.Title>
            </Saratoga.Header>

            <div className="flex flex-col gap-6">
                <p className="text-muted-foreground text-sm">
                    Import a skill-package export (produced by the &quot;Export .json&quot; action
                    on a package) into an organization. Groups and skills are matched by ID: an
                    existing package is updated in place and anything the file omits is archived
                    (never deleted). Imported packages always land unpublished.
                </p>

                <Card>
                    <CardHeader>
                        <CardTitle>Import</CardTitle>
                        <CardDescription>
                            Choose an export file and a target organization, preview the changes,
                            then run the import.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Field data-invalid={!!file.error}>
                            <FieldLabel htmlFor="import-file">Export file</FieldLabel>
                            <FileDropzone
                                id="import-file"
                                accept="application/json"
                                aria-invalid={!!file.error}
                                hint="Up to 1 MB · .json"
                                onFileSelected={(selected) => {
                                    file.handleFile(selected);
                                    resetPlan();
                                }}
                            />
                            {file.error && <FieldError errors={[{ message: file.error }]} />}
                            {file.envelope && !file.error && (
                                <p className="text-muted-foreground text-xs">
                                    {file.envelope.package.name} —{" "}
                                    {file.envelope.package.groups.length} groups,{" "}
                                    {file.envelope.package.groups.reduce(
                                        (n, g) => n + g.skills.length,
                                        0,
                                    )}{" "}
                                    skills
                                </p>
                            )}
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="target-org">Target organization</FieldLabel>
                            <Select
                                value={targetOrganizationId}
                                onValueChange={(value) => {
                                    setTargetOrganizationId(value);
                                    resetPlan();
                                }}
                            >
                                <SelectTrigger id="target-org">
                                    <SelectValue placeholder="Select an organization…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {orgData.organizations.map((org) => (
                                        <SelectItem key={org.id} value={org.id}>
                                            {org.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={!ready || preview.isPending}
                                onClick={() =>
                                    file.envelope &&
                                    preview.mutate({
                                        envelope: file.envelope,
                                        targetOrganizationId,
                                        dryRun: true,
                                    })
                                }
                            >
                                Preview changes
                            </Button>
                            <MutationButton
                                disabled={!ready || !plan || plan.applied}
                                status={runImport.status}
                                text={{
                                    idle: "Run import",
                                    pending: "Importing",
                                    success: "Imported",
                                }}
                                onClick={() =>
                                    file.envelope &&
                                    runImport.mutate({
                                        envelope: file.envelope,
                                        targetOrganizationId,
                                        dryRun: false,
                                    })
                                }
                            />
                        </div>
                    </CardContent>
                </Card>

                {plan && <SkillPackageImportPlanTable plan={plan.plan} applied={plan.applied} />}
            </div>
        </Saratoga.Root>
    );
}
