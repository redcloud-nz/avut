/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { CreateEmailOptions, Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export const NoReplyEmailAddress = process.env.NOREPLY_EMAIL || "no-reply@mx.avut.nz";

export async function sendEmail(payload: CreateEmailOptions): Promise<void> {
    try {
        const { data, error } = await resend.emails.send(payload);

        if (error) console.error("Error sending email:", error);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}
