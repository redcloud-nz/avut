/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef } from "react";

import { useQuery } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Teams_AddTeamMembership_Dialog } from "@/components/teams/add-team-membership";
import { Button } from "@/components/ui/button";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { ActionsCard, RecordCardMenu } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { PersonData } from "@/lib/schemas/person";
import { AdminModule_LinkUser_Dialog } from "@/modules/org-admin/components/person-user-link/link-user";
import { AdminModule_UnlinkPerson_Dialog } from "@/modules/org-admin/components/person-user-link/unlink-person";
import { trpc } from "@/trpc/client";

import { AdminModule_ArchivePerson_Dialog } from "./archive-person";
import { AdminModule_DeletePerson_Dialog } from "./delete-person";
import { AdminModule_InvitePerson_Dialog } from "./invite-person";
import { AdminModule_RecoverPerson_Dialog } from "./recover-person";
import { AdminModule_RestorePerson_Dialog } from "./restore-person";

/** Every `?action=` the person page's dialogs answer to. Edit's dialog owns `update` itself. */
const personActions = parseAsStringLiteral([
    "update",
    "delete",
    "invite",
    "archive",
    "restore",
    "recover",
    "link-user",
    "unlink-user",
    "add-membership",
] as const);

/**
 * The person's linked user, or `null` once it's known there's none. `undefined` while it loads
 * or for a viewer without `member: ["view"]` (what the procedure requires alongside
 * `person: ["view"]`), who never issues the query: treat that as unknown and show neither the
 * linked nor the unlinked actions.
 */
function useLinkedUser(person: PersonData) {
    const organization = useOrganization();
    const canViewMember = useHasPermission({ member: ["view"] });

    const { data } = useQuery(
        trpc.personnel.getLinkedUser.queryOptions(
            { organizationId: organization.id, personId: person.id },
            { enabled: canViewMember },
        ),
    );
    return data;
}

/**
 * The Person card's ⋮ (the page's primary record card): Archive, Restore or Recover, Delete, and
 * Link to user for a person who isn't Active (an Active one gets it in
 * {@link AdminModule_Person_ActionsCard}). Edit is the card's pencil, History its "Updated"
 * footer, Add to team the Team Memberships card's Add, Unlink the Linked User card's ⋮.
 *
 * Mounts every dialog on the page, whichever card or button opens it.
 */
export function AdminModule_PersonMenu({ person }: { person: PersonData }) {
    const [action, setAction] = useQueryState("action", personActions);

    const canUpdate = useHasPermission({ person: ["update"] });
    const canDelete = useHasPermission({ person: ["delete"] });
    const canUpdateLink = useHasPermission({ member: ["update"], person: ["update"] });

    const linkedUser = useLinkedUser(person);

    // The dialogs below whose button is gone after they succeed (Invite and Link hide the action
    // card, Unlink the Linked User card) return focus here instead.
    const triggerRef = useRef<HTMLButtonElement>(null);

    const actions: MenuActionProps[] = [];
    if (person.status === "Active" && canUpdate) {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            onSelect: () => setAction("archive", { history: "push" }),
        });
    }
    if (person.status === "Archived" && canUpdate) {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
        });
    }
    if (person.status === "Deleted" && canDelete) {
        actions.push({
            verb: "recover",
            label: "Recover from rubbish",
            icon: <ObjectIcons.Recover />,
            onSelect: () => setAction("recover", { history: "push" }),
        });
    }
    if (person.status === "Archived" && linkedUser === null && canUpdateLink) {
        actions.push({
            verb: "link",
            label: "Link to user",
            icon: <ObjectIcons.Link />,
            onSelect: () => setAction("link-user", { history: "push" }),
        });
    }
    if (person.status !== "Deleted" && canDelete) {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            destructive: true,
        });
    }

    return (
        <>
            <RecordCardMenu
                actions={actions}
                category="Personnel"
                primary
                triggerRef={triggerRef}
            />

            {/* Invite Person dialog */}
            <AdminModule_InvitePerson_Dialog
                person={person}
                returnFocusRef={triggerRef}
                open={action === "invite"}
                onOpenChange={(open) =>
                    setAction(open ? "invite" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            {/* Archive Person dialog */}
            <AdminModule_ArchivePerson_Dialog
                person={person}
                open={action === "archive"}
                onOpenChange={(open) =>
                    setAction(open ? "archive" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            {/* Restore Person dialog */}
            <AdminModule_RestorePerson_Dialog
                person={person}
                open={action === "restore"}
                onOpenChange={(open) =>
                    setAction(open ? "restore" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            {/* Recover Person from Rubbish dialog */}
            <AdminModule_RecoverPerson_Dialog
                person={person}
                open={action === "recover"}
                onOpenChange={(open) =>
                    setAction(open ? "recover" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

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

            {/* Link User dialog */}
            <AdminModule_LinkUser_Dialog
                person={person}
                returnFocusRef={triggerRef}
                open={action === "link-user"}
                onOpenChange={(open) =>
                    setAction(open ? "link-user" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            {/* Unlink User dialog */}
            {linkedUser && (
                <AdminModule_UnlinkPerson_Dialog
                    userId={linkedUser.userId}
                    userName={linkedUser.user.name}
                    personName={person.name}
                    returnFocusRef={triggerRef}
                    open={action === "unlink-user"}
                    onOpenChange={(open) =>
                        setAction(open ? "unlink-user" : null, {
                            history: open ? "push" : "replace",
                        })
                    }
                />
            )}

            {/* Add Team Membership dialog */}
            <Teams_AddTeamMembership_Dialog
                person={person}
                open={action === "add-membership"}
                onOpenChange={(open) =>
                    setAction(open ? "add-membership" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}

/**
 * The bare action card at the top of the person's secondary column: Invite to AVUT and Link to
 * existing user, for an Active person with no user yet. Renders nothing otherwise, or while the
 * link is still loading (rather than show buttons that might vanish). The buttons only set
 * `?action=`; the dialogs are in {@link AdminModule_PersonMenu}.
 */
export function AdminModule_Person_ActionsCard({ person }: { person: PersonData }) {
    const [, setAction] = useQueryState("action", personActions);

    const canInvite = useHasPermission({ invitation: ["create"] });
    const canUpdateLink = useHasPermission({ member: ["update"], person: ["update"] });

    const linkedUser = useLinkedUser(person);
    const canBeLinked = person.status === "Active" && linkedUser === null;

    return (
        <ActionsCard>
            {canBeLinked && canInvite ? (
                <Button onClick={() => setAction("invite", { history: "push" })}>
                    <ObjectIcons.Invite /> Invite to AVUT
                </Button>
            ) : null}
            {canBeLinked && canUpdateLink ? (
                <Button
                    variant="outline"
                    onClick={() => setAction("link-user", { history: "push" })}
                >
                    <ObjectIcons.Link /> Link to existing user
                </Button>
            ) : null}
        </ActionsCard>
    );
}

/** The Linked User card's ⋮: Unlink from user. The dialog is in {@link AdminModule_PersonMenu}. */
export function AdminModule_Person_LinkedUserMenu() {
    const [, setAction] = useQueryState("action", personActions);
    const canUpdateLink = useHasPermission({ member: ["update"], person: ["update"] });

    const actions: MenuActionProps[] = [];
    if (canUpdateLink) {
        actions.push({
            verb: "unlink",
            label: "Unlink from user",
            icon: <ObjectIcons.Unlink />,
            onSelect: () => setAction("unlink-user", { history: "push" }),
        });
    }

    return <RecordCardMenu actions={actions} category="Personnel" label="Linked user actions" />;
}
