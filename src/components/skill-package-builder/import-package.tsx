/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useEffect, useState } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FileDropzone } from "@/components/ui/file-dropzone";

import { SkillPackageImportPlanTable } from "@/components/skill-packages/import-plan-table";
import { useSkillPackageImportFile } from "@/components/skill-packages/use-skill-package-import-file";
import { skillPackageBuilderEffects } from "@/client/skill-package-builder-effects";
import { useActionHotkeys } from "@/hooks/use-action-hotkeys";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type ImportResult = RouterOutput["skillPackageBuilder"]["importPackage"];

export function SkillPackageBuilder_ImportPackage_Dialog() {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["import"] as const));
    const dialogOpen = action === "import";

    const canImport = useHasPermission({ skillPackageBuilder: ["create"] });
    useActionHotkeys([
        {
            verb: "import",
            run: () => void setAction("import", { history: "push" }),
            enabled: canImport,
            name: "Import package",
            category: "Packages",
        },
    ]);

    const file = useSkillPackageImportFile();
    const [result, setResult] = useState<ImportResult | null>(null);

    const preview = useMutation(
        trpc.skillPackageBuilder.importPackage.mutationOptions({
            onError: (error) => toast.error(`Preview failed: ${error.message}`),
            onSuccess: (data) => setResult(data),
        }),
    );

    const runImport = useMutation(
        trpc.skillPackageBuilder.importPackage.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.importPackage },
            onError: (error) => toast.error(`Import failed: ${error.message}`),
            onSuccess: (data) => {
                setResult(data);
                toast.success(`Skill package "${data.plan.package.name}" imported.`);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        void setAction(open ? "import" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            file.reset();
            setResult(null);
            preview.reset();
            runImport.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const ready = file.envelope !== null;

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Import /> <span className="hidden md:inline">Import</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import skill package</DialogTitle>
                    <DialogDescription>
                        Import a skill-package export (from another organization or another AVUT
                        instance) into <strong>{organization.name}</strong>. Groups and skills are
                        matched by ID: an existing package is updated in place and anything the file
                        omits is archived. The package always lands unpublished.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <Field data-invalid={!!file.error}>
                        <FieldLabel htmlFor="import-package-file">Export file</FieldLabel>
                        <FileDropzone
                            id="import-package-file"
                            accept="application/json"
                            aria-invalid={!!file.error}
                            hint="Up to 1 MB · .json"
                            onFileSelected={(selected) => {
                                file.handleFile(selected);
                                setResult(null);
                            }}
                        />
                        {file.error && <FieldError errors={[{ message: file.error }]} />}
                        {file.envelope && !file.error && (
                            <p className="text-muted-foreground text-xs">
                                {file.envelope.package.name} — {file.envelope.package.groups.length}{" "}
                                groups,{" "}
                                {file.envelope.package.groups.reduce(
                                    (n, g) => n + g.skills.length,
                                    0,
                                )}{" "}
                                skills
                            </p>
                        )}
                    </Field>

                    {result && (
                        <SkillPackageImportPlanTable plan={result.plan} applied={result.applied} />
                    )}
                </div>

                <DialogFooter>
                    <DialogCloseButton variant="outline">
                        {result?.applied ? "Close" : "Cancel"}
                    </DialogCloseButton>
                    <Button
                        variant="outline"
                        disabled={!ready || preview.isPending}
                        onClick={() =>
                            file.envelope &&
                            preview.mutate({
                                organizationId: organization.id,
                                envelope: file.envelope,
                                dryRun: true,
                            })
                        }
                    >
                        Preview changes
                    </Button>
                    <MutationButton
                        disabled={!ready || !result || result.applied}
                        status={runImport.status}
                        text={{
                            idle: "Import",
                            pending: "Importing",
                            success: "Imported",
                        }}
                        onClick={() =>
                            file.envelope &&
                            runImport.mutate({
                                organizationId: organization.id,
                                envelope: file.envelope,
                                dryRun: false,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
