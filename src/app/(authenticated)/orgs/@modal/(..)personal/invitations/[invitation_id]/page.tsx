/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /
 */

"use client";

import { use } from "react";

import Auth_ViewInvitation_Dialog from "@/components/dialogs/invitation";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { useRouter } from "next/navigation";

export default function Organizations_Modal_Invitation_Dialog(
    props: PageProps<"/personal/invitations/[invitation_id]">,
) {
    const { invitation_id } = use(props.params);

    const router = useRouter();

    const invitationId = InvitationId.schema.parse(invitation_id);

    return (
        <Auth_ViewInvitation_Dialog
            invitationId={invitationId}
            open
            onOpenChange={(open) => {
                if (!open) router.back();
            }}
        />
    );
}
