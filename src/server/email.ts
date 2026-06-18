/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { CreateEmailOptions, Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
    return (_resend ??= new Resend(process.env.RESEND_API_KEY!));
}

export const NoReplyEmailAddress = process.env.NOREPLY_EMAIL || "no-reply@mx.avut.nz";

export async function sendEmail(payload: CreateEmailOptions): Promise<void> {
    try {
        const { data, error } = await getResend().emails.send(payload);

        if (error) console.error("Error sending email:", error);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}
