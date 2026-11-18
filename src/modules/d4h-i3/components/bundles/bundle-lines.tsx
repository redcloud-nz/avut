/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { D4HEquipmentCategoryLink } from "@/components/entity-links/d4h-equipment-category-link";
import { D4HEquipmentTypeLink } from "@/components/entity-links/d4h-equipment-type-link";
import { I3TemplateLink } from "@/components/entity-links/i3-template-link";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useHasPermission } from "@/hooks/use-has-permission";
import type { Permissions } from "@/lib/permissions";
import { I3Bundle, I3BundleLine } from "@/lib/schemas/i3-bundle";
import { cn } from "@/lib/utils";

import { D4HI3Module_AddBundleTemplates_Dialog } from "./add-bundle-templates";
import { D4HI3Module_RemoveBundleTemplate_Dialog } from "./remove-bundle-template";

const UPDATE_PERMISSION = { i3Bundle: ["update"] } as const satisfies Permissions;

/**
 * A bundle's lines, one row each with its category in the first column. `lines` arrive sorted by
 * category title, category id, then template name, with lines that have no D4H type last.
 */
export function D4HI3Module_Bundle_Lines({
    bundle,
    lines,
}: {
    bundle: I3Bundle;
    lines: I3BundleLine[];
}) {
    const canUpdate = useHasPermission(UPDATE_PERMISSION);
    const editable = bundle.status !== "Deleted" && canUpdate;

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["remove-template"] as const),
    );
    const [templateId, setTemplateId] = useQueryState("templateId", parseAsString);
    const activeLine = lines.find((line) => line.template.id === templateId) ?? null;

    function openRemove(id: string) {
        void setTemplateId(id, { history: "push" });
        void setAction("remove-template", { history: "push" });
    }
    function closeRemove() {
        void setAction(null, { history: "replace" });
        void setTemplateId(null, { history: "replace" });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Templates</CardTitle>
                {editable && (
                    <CardAction>
                        <D4HI3Module_AddBundleTemplates_Dialog bundle={bundle} lines={lines} />
                    </CardAction>
                )}
            </CardHeader>
            <CardContent>
                <Show
                    when={lines.length > 0}
                    fallback={
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No templates yet</EmptyTitle>
                                <EmptyDescription>
                                    This bundle has no templates.
                                    {editable && (
                                        <>
                                            {" "}
                                            Click the
                                            <ObjectIcons.Create className="inline-block mx-1 size-4" />
                                            button to add some.
                                        </>
                                    )}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Category</TableHeadCell>
                                <TableHeadCell>Template</TableHeadCell>
                                <TableHeadCell>D4H Type</TableHeadCell>
                                {editable && <TableHeadCell></TableHeadCell>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lines.map((line) => (
                                <BundleLineRow
                                    key={line.template.id}
                                    line={line}
                                    editable={editable}
                                    onRemove={() => openRemove(line.template.id)}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </Show>
            </CardContent>
            {editable && activeLine && (
                <Protect permissions={UPDATE_PERMISSION}>
                    <D4HI3Module_RemoveBundleTemplate_Dialog
                        bundle={bundle}
                        line={activeLine}
                        open={action === "remove-template"}
                        onOpenChange={(open) => (open ? undefined : closeRemove())}
                    />
                </Protect>
            )}
        </Card>
    );
}

function BundleLineRow({
    line,
    editable,
    onRemove,
}: {
    line: I3BundleLine;
    editable: boolean;
    onRemove: () => void;
}) {
    const { template } = line;
    const deleted = template.status === "Deleted";
    const noType = template.d4h === null;

    return (
        <TableRow>
            <TableCell className={cn((deleted || noType) && "opacity-60")}>
                {template.d4h ? (
                    <D4HEquipmentCategoryLink
                        category={{
                            id: template.d4h.categoryId,
                            title: template.d4h.categoryTitle,
                        }}
                    />
                ) : (
                    "—"
                )}
            </TableCell>
            <TableCell className={cn((deleted || noType) && "opacity-60")}>
                <span className="inline-flex flex-wrap items-center gap-1.5">
                    <I3TemplateLink template={template} />
                    {deleted && <Badge variant="outline">Deleted template</Badge>}
                    {noType && <Badge variant="outline">No D4H type</Badge>}
                </span>
            </TableCell>
            <TableCell className={cn((deleted || noType) && "opacity-60")}>
                {template.d4h ? (
                    <D4HEquipmentTypeLink
                        type={{ id: template.d4h.kindId, title: template.d4h.kindTitle }}
                    />
                ) : (
                    "—"
                )}
            </TableCell>
            {editable && (
                <TableCell className="p-0 text-right">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${template.name}`}
                        onClick={onRemove}
                    >
                        <ObjectIcons.Delete />
                    </Button>
                </TableCell>
            )}
        </TableRow>
    );
}
