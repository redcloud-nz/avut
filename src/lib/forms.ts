/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

interface AVUTForm {
    formKey: string;
    name: string;
    description: string;
}

export const I3IssueItemsForm = {
    formKey: "i3-issue",
    name: "D4H I3 Issue Items Form",
    description: "Form for issuing items in the D4H I3 module.",
} as const satisfies AVUTForm;

export const I3ReturnItemsForm = {
    formKey: "i3-return",
    name: "D4H I3 Return Items Form",
    description: "Form for returning items in the D4H I3 module.",
} as const satisfies AVUTForm;

/** A D4H member's kit check, answered over an emailed link with no account. */
export const KitCheckForm = {
    formKey: "kit-check",
    name: "Kit Check Form",
    description: "Form for a D4H member to check the I3 bundle items they hold and need.",
} as const satisfies AVUTForm;

export const forms = [I3IssueItemsForm, I3ReturnItemsForm, KitCheckForm] as const;

export type FormKey = (typeof forms)[number]["formKey"];

export const FormKey = {
    schema: z.enum(forms.map((form) => form.formKey)),
};
