/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import type { ImportAction, ImportPlan } from "@/server/skill-package-io";

const ACTION_BADGE: Record<
    ImportAction,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    create: { label: "Create", variant: "default" },
    update: { label: "Update", variant: "secondary" },
    archive: { label: "Archive", variant: "destructive" },
    unchanged: { label: "Unchanged", variant: "outline" },
};

/** Renders the plan returned by `importPackage` / `importSkillPackage` (preview or applied). */
export function SkillPackageImportPlanTable({
    plan,
    applied,
}: {
    plan: ImportPlan;
    applied: boolean;
}) {
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
