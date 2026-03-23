/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

interface AVUTForm {
    formKey: string;
    name: string;
    description: string;
}

export const I3IssueItemsForm = {
    formKey: "i3-issue",
    name: "I3 Issue Items Form",
    description: "Form for issuing items in the I3 module.",
} as const satisfies AVUTForm;

export const forms = [I3IssueItemsForm] as const;

export type FormKey = (typeof forms)[number]["formKey"];

export const FormKey = {
    schema: z.enum(forms.map((form) => form.formKey)),
};
