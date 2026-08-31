/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MenuAction } from "@/components/ui/menu-action";

import { personnelEffects } from "@/client/personnel-effects";
import { useActionHotkeys } from "@/hooks/use-action-hotkeys";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { ActionVerb } from "@/lib/hotkeys";
import { route } from "@/lib/routes";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

import { AdminModule_DeletePerson_Dialog } from "./delete-person";

interface AdminModule_PersonMenuProps {
    person: PersonData;
}

export function AdminModule_PersonMenu({ person }: AdminModule_PersonMenuProps) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update", "delete"] as const),
    );

    const canUpdate = useHasPermission({ person: ["update"] });
    const canDelete = useHasPermission({ person: ["delete"] });

    const archiveMutation = useMutation(
        trpc.personnel.archivePerson.mutationOptions({
            meta: { effects: personnelEffects.archivePerson },
            onError(error) {
                toast.error(`Failed to archive person: ${error.message}`);
                console.error("Failed to archive person:", error);
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.personnel.restorePerson.mutationOptions({
            meta: { effects: personnelEffects.restorePerson },
            onError(error) {
                toast.error(`Failed to restore person: ${error.message}`);
                console.error("Failed to restore person:", error);
            },
        }),
    );

    function handleArchive() {
        toast.promise(
            archiveMutation.mutateAsync({ organizationId: organization.id, personId: person.id }),
            {
                loading: "Archiving person record...",
                success: "Person record archived.",
                error: (error) => "Failed to archive person record: " + error.message,
            },
        );
    }

    function handleRestore() {
        toast.promise(
            restoreMutation.mutateAsync({ organizationId: organization.id, personId: person.id }),
            {
                loading: "Restoring person record...",
                success: "Person record restored.",
                error: (error) => "Failed to restore person record: " + error.message,
            },
        );
    }

    interface MenuActionConfig {
        verb: ActionVerb;
        label: string;
        icon: ReactNode;
        run: () => void;
        disabled: boolean;
        destructive?: boolean;
    }

    const actions: MenuActionConfig[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            run: () => setAction("update", { history: "push" }),
            disabled: !canUpdate,
        },
    ];
    if (person.status === "Active") {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            run: handleArchive,
            disabled: !canUpdate,
        });
    } else {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            run: handleRestore,
            disabled: !canUpdate,
        });
    }
    if (person.status !== "Archived") {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            run: () => setAction("delete", { history: "push" }),
            disabled: !canDelete,
            destructive: true,
        });
    }

    useActionHotkeys(
        actions.map(({ verb, label, run, disabled }) => ({
            verb,
            run,
            enabled: !disabled,
            name: label,
            category: "Personnel",
        })),
    );

    return (
        <>
            {/* Person dropdown menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-50" align="end">
                    <DropdownMenuGroup>
                        <DropdownMenuItem disabled asChild>
                            <Link
                                href={route("/orgs/[slug]/admin/personnel/[person_id]/history", {
                                    slug: organization.slug,
                                    person_id: person.id,
                                })}
                            >
                                <ObjectIcons.History /> History
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />

                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {actions.map(({ verb, label, icon, run, disabled, destructive }) => (
                            <MenuAction
                                key={verb}
                                verb={verb}
                                label={label}
                                icon={icon}
                                onSelect={run}
                                disabled={disabled}
                                destructive={destructive}
                            />
                        ))}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete Person dialog*/}
            <AdminModule_DeletePerson_Dialog
                person={person}
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
