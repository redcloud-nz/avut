/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
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

import type { ImportAction } from "@/server/skill-package-io";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type ImportResult = RouterOutput["systemAdmin"]["importSkillPackage"];
type ImportPlan = ImportResult["plan"];

const ACTION_BADGE: Record<
    ImportAction,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    create: { label: "Create", variant: "default" },
    update: { label: "Update", variant: "secondary" },
    archive: { label: "Archive", variant: "destructive" },
    unchanged: { label: "Unchanged", variant: "outline" },
};

export function SystemAdmin_SkillPackageLibrary_Content() {
    const { data: libraryData } = useSuspenseQuery(
        trpc.systemAdmin.listSkillPackageLibrary.queryOptions(),
    );
    const { data: orgData } = useSuspenseQuery(trpc.systemAdmin.listOrganizations.queryOptions());

    const [fileName, setFileName] = useState<string>("");
    const [targetOrganizationId, setTargetOrganizationId] = useState<string>("");
    const [plan, setPlan] = useState<{ plan: ImportPlan; applied: boolean } | null>(null);

    const selectedEntry = useMemo(
        () => libraryData.packages.find((p) => p.fileName === fileName),
        [libraryData.packages, fileName],
    );

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

    const ready = fileName !== "" && targetOrganizationId !== "";

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
                    Import a bundled skill-package library file into an organization. Groups and
                    skills are matched by ID: an existing package is updated in place and anything
                    the file omits is archived (never deleted). Imported packages always land
                    unpublished.
                </p>

                <Card>
                    <CardHeader>
                        <CardTitle>Import</CardTitle>
                        <CardDescription>
                            Choose a library file and a target organization, preview the changes,
                            then run the import.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Field>
                            <FieldLabel htmlFor="library-file">Library package</FieldLabel>
                            <Select
                                value={fileName}
                                onValueChange={(value) => {
                                    setFileName(value);
                                    resetPlan();
                                }}
                            >
                                <SelectTrigger id="library-file">
                                    <SelectValue placeholder="Select a package…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {libraryData.packages.map((pkg) => (
                                        <SelectItem key={pkg.fileName} value={pkg.fileName}>
                                            {pkg.name} — {pkg.groupCount} groups, {pkg.skillCount}{" "}
                                            skills
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedEntry && (
                                <p className="text-muted-foreground text-xs">
                                    {selectedEntry.description}
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
                                    preview.mutate({
                                        fileName,
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
                                    runImport.mutate({
                                        fileName,
                                        targetOrganizationId,
                                        dryRun: false,
                                    })
                                }
                            />
                        </div>
                    </CardContent>
                </Card>

                {plan && <PlanTable plan={plan.plan} applied={plan.applied} />}
            </div>
        </Saratoga.Root>
    );
}

function PlanTable({ plan, applied }: { plan: ImportPlan; applied: boolean }) {
    const rows = [plan.package, ...plan.groups, ...plan.skills];
    const { counts } = plan;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{applied ? "Import result" : "Preview"}</CardTitle>
                <CardDescription>
                    {counts.created} created · {counts.updated} updated · {counts.archived} archived
                    · {counts.unchanged} unchanged
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {applied ? (
                    <Alert variant="success">
                        <AlertTitle>Done</AlertTitle>
                        <AlertDescription>
                            The package was imported as <strong>unpublished</strong>. Publish it in
                            the target organization when ready.
                        </AlertDescription>
                    </Alert>
                ) : (
                    counts.archived > 0 && (
                        <Alert variant="warning">
                            <AlertTitle>{counts.archived} record(s) will be archived</AlertTitle>
                            <AlertDescription>
                                Groups and skills under this package that the file does not contain
                                will be set to Archived. Existing assessment history is preserved.
                            </AlertDescription>
                        </Alert>
                    )
                )}

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Type</TableHeadCell>
                                <TableHeadCell>Name</TableHeadCell>
                                <TableHeadCell>Change</TableHeadCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((node) => (
                                <TableRow key={`${node.kind}-${node.id}`}>
                                    <TableCell className="capitalize">{node.kind}</TableCell>
                                    <TableCell>{node.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={ACTION_BADGE[node.action].variant}>
                                            {ACTION_BADGE[node.action].label}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
