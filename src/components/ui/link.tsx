/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type EmailLinkProps = Omit<ComponentProps<"a">, "href"> & {
    email: string;
};

export function EmailLink({ email, className, ...props }: EmailLinkProps) {
    if (email == "") return null;

    return (
        <a {...props} className={cn("hover:underline", className)} href={`mailto:${email}`}>
            {email}
        </a>
    );
}

export type PhoneLinkProps = Omit<ComponentProps<"a">, "href"> & {
    phoneNumber: string;
};

export function PhoneLink({ phoneNumber, className, ...props }: PhoneLinkProps) {
    if (phoneNumber == "") return null;

    let linkNumber = phoneNumber,
        displayNumber = phoneNumber;
    if (phoneNumber.startsWith("642")) {
        // NZ Cell Number
        linkNumber = "+" + phoneNumber;
        displayNumber = `0${phoneNumber.slice(2, 4)} ${phoneNumber.slice(4, 7)} ${phoneNumber.slice(7)}`;
    }

    return (
        <a
            {...props}
            className={cn("font-mono hover:underline", className)}
            href={`tel:${linkNumber}`}
        >
            {displayNumber}
        </a>
    );
}

export type ExternalLinkProps = Omit<ComponentProps<"a">, "target" | "rel"> & {
    noDecoration?: boolean;
};

export function ExternalLink({
    className,
    href,
    noDecoration: noUnderline = false,
    ...props
}: ExternalLinkProps) {
    return (
        <a
            className={cn(!noUnderline && "hover:underline", className)}
            data-component="ExternalLink"
            data-slot="link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
        />
    );
}

export type GitHubIssueLinkProps = Omit<ExternalLinkProps, "href"> & {
    issueNumber: number;
};

export function GitHubIssueLink({ className, issueNumber, ...props }: GitHubIssueLinkProps) {
    return (
        <ExternalLink
            className={cn("text-blue-900 hover:underline", className)}
            href={`${process.env.NEXT_PUBLIC_APP_REPOSITORY_URL}/issues/${issueNumber}`}
            data-component="GitHubIssueLink"
            data-slot="link"
            {...props}
        >{`Issue #${issueNumber}`}</ExternalLink>
    );
}
