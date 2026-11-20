/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId, useState } from "react";
import * as R from "remeda";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { i3BundlesEffects } from "@/client/i3-bundles-effects";
import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
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
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { useOrganization } from "@/hooks/use-organization";
import { I3Bundle, I3BundleLine } from "@/lib/schemas/i3-bundle";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { trpc } from "@/trpc/client";

/**
 * Adds templates to a bundle: a checkbox list of the Active templates with a D4H type that
 * aren't in it yet, grouped by category. One `addTemplates` call on submit.
 */
export function D4HI3Module_AddBundleTemplates_Dialog({
    bundle,
    lines,
}: {
    bundle: I3Bundle;
    lines: I3BundleLine[];
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-templates"] as const),
    );
    const dialogOpen = action === "add-templates";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "add-templates" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Add templates">
                    <ObjectIcons.Create />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Templates</DialogTitle>
                    <DialogDescription>
                        Choose the templates to add to this bundle.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <AddBundleTemplates_Body
                        bundle={bundle}
                        lines={lines}
                        onDone={() => handleDialogOpenChange(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function AddBundleTemplates_Body({
    bundle,
    lines,
    onDone,
}: {
    bundle: I3Bundle;
    lines: I3BundleLine[];
    onDone: () => void;
}) {
    const idPrefix = useId();
    const organization = useOrganization();

    const { data: templates } = useSuspenseQuery(
        trpc.i3.listTemplates.queryOptions({ organizationId: organization.id }),
    );

    const [selected, setSelected] = useState<ReadonlySet<I3TemplateId>>(new Set());

    const mutation = useMutation(
        trpc.i3Bundles.addTemplates.mutationOptions({
            meta: { effects: i3BundlesEffects.addTemplates },
            onError(error) {
                console.error("Failed to add templates to bundle:", error);
                toast.error(`Failed to add templates: ${error.message}`);
            },
            onSuccess() {
                // The server skips templates already in the bundle, so don't count the selection.
                toast.success("Templates added");
                onDone();
            },
        }),
    );

    const inBundle = new Set(lines.map((line) => line.template.id));

    // Category -> templates, sorted by title then name. Grouped by category id, so two D4H
    // categories that share a title stay apart.
    const sections = R.pipe(
        templates,
        R.filter(
            (template) =>
                template.status === "Active" && template.d4h !== null && !inBundle.has(template.id),
        ),
        R.sortBy(
            (template) => template.d4h?.categoryTitle ?? "",
            (template) => template.d4h?.categoryId ?? 0,
            (template) => template.name,
        ),
        R.groupBy((template) => String(template.d4h?.categoryId ?? "")),
        R.values(),
        R.map((sectionTemplates) => ({
            categoryId: sectionTemplates[0].d4h?.categoryId ?? 0,
            categoryTitle: sectionTemplates[0].d4h?.categoryTitle ?? "",
            templates: sectionTemplates,
        })),
    );

    function handleCheckedChange(templateId: I3TemplateId, checked: boolean) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(templateId);
            else next.delete(templateId);
            return next;
        });
    }

    return (
        <>
            <DialogBody>
                {sections.length === 0 && (
                    <p className="text-muted-foreground">
                        Every Active template with a D4H type is already in this bundle.
                    </p>
                )}
                <FieldGroup>
                    {sections.map((section) => (
                        <FieldSet key={section.categoryId}>
                            <FieldLegend variant="label">{section.categoryTitle}</FieldLegend>
                            <FieldGroup className="gap-3">
                                {section.templates.map((template) => (
                                    <Field orientation="horizontal" key={template.id}>
                                        <Checkbox
                                            id={`${idPrefix}-template-${template.id}`}
                                            checked={selected.has(template.id)}
                                            onCheckedChange={(checked) =>
                                                handleCheckedChange(template.id, checked === true)
                                            }
                                        />
                                        <FieldLabel htmlFor={`${idPrefix}-template-${template.id}`}>
                                            {template.name}
                                        </FieldLabel>
                                    </Field>
                                ))}
                            </FieldGroup>
                        </FieldSet>
                    ))}
                </FieldGroup>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="button"
                    disabled={selected.size === 0}
                    onClick={() =>
                        mutation.mutate({
                            organizationId: organization.id,
                            bundleId: bundle.id,
                            templateIds: [...selected],
                        })
                    }
                    status={mutation.status}
                    text={{ idle: "Add", pending: "Adding", success: "Added" }}
                />
            </DialogFooter>
        </>
    );
}
