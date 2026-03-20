/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use server";

import { createElement } from "react";

import PPEIssueNotificationEmail from "@/emails/ppe-issue-notification";

import { NoReplyEmailAddress, sendEmail } from "@/server/email";
import { PPEIssueFormData } from "@/lib/schemas/ppe";

export async function submitPPEIssueForm(data: PPEIssueFormData) {
    await sendEmail({
        from: NoReplyEmailAddress,
        to: data.email,
        subject: `PPE Issued to ${data.recipient.name}`,
        react: createElement(PPEIssueNotificationEmail, {
            formData: data,
        }),
    });

    console.log(`PPE Issue Form submission processed: `, data);
}
