/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/accept-invitation/[invitation_id]
 */

import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import * as Paths from "@/paths";
import { auth } from "@/server/auth";

export default async function Auth_AcceptInvitation_Page(
    props: PageProps<"/auth/accept-invitation/[invitation_id]">,
) {
    const { invitation_id } = await props.params;

    const headers = await nextHeaders();

    const session = await auth.api.getSession({ headers });

    if (session) {
        // Signed in. Verify the invitation exists and belongs to the signed-in user

        const invitation = await auth.api.getInvitation({
            query: { id: invitation_id },
            headers,
        });

        if (invitation.email == session.user.email) {
            // Correct user, redirect to the invitation page which will handle the rest
            redirect(Paths.personal.invitation(invitation_id).href);
        } else {
            // Signed in as the wrong user, sign out and redirect to sign-in page with redirect back to this invite
            await auth.api.signOut({ headers });
            redirect(
                Paths.auth.signIn({
                    email: invitation.email,
                    redirect: Paths.auth.acceptInvitation(invitation_id).href,
                }).href,
            );
        }
    } else {
        // Not signed in, redirect to sign-in page with redirect back to this invite
        redirect(
            Paths.auth.signIn({
                redirect: Paths.auth.acceptInvitation(invitation_id).href,
            }).href,
        );
    }
}
