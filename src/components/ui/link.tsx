/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { LucideProps } from "lucide-react";
import NextLink from "next/link";
import {
    ComponentProps,
    ForwardRefExoticComponent,
    ReactNode,
    RefAttributes,
} from "react";

import { cn } from "@/lib/utils";

export type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
    to: { href: string };
};

export function Link({ children, to: path, ...props }: LinkProps) {
    return (
        <NextLink href={path.href} {...props}>
            {children}
        </NextLink>
    );
}

export type EmailLinkProps = Omit<ComponentProps<"a">, "href"> & {
    email: string;
};

export function EmailLink({ email, className, ...props }: EmailLinkProps) {
    if (email == "") return null;

    return (
        <a
            {...props}
            className={cn("hover:underline", className)}
            href={`mailto:${email}`}
        >
            {email}
        </a>
    );
}

export type PhoneLinkProps = Omit<ComponentProps<"a">, "href"> & {
    phoneNumber: string;
};

export function PhoneLink({
    phoneNumber,
    className,
    ...props
}: PhoneLinkProps) {
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

type TextLinkProps = Omit<
    ComponentProps<typeof NextLink>,
    "children" | "href"
> &
    (
        | { children: ReactNode; to: { href: string; label?: string } }
        | { children?: never; to: { href: string; label: string } }
    );

export function TextLink({
    children,
    className,
    to: path,
    ...props
}: TextLinkProps) {
    return (
        <NextLink
            className={cn(
                "text-blue-900 hover:underline cursor-pointer",
                className,
            )}
            href={path.href}
            {...props}
        >
            {children ?? path.label}
        </NextLink>
    );
}

export type GitHubIssueLinkProps = Omit<ExternalLinkProps, "href"> & {
    issueNumber: number;
};

export function GitHubIssueLink({
    className,
    issueNumber,
    ...props
}: GitHubIssueLinkProps) {
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

export function CardLinkList({ className, ...props }: ComponentProps<"ul">) {
    return (
        <ul
            role="list"
            className={cn(
                "grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4",
                className,
            )}
            {...props}
        />
    );
}

type CardLinkProps = {
    className?: string;
    to: {
        label: string;
        href: string;
        bgColor: string;
        icon?: ForwardRefExoticComponent<
            Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
        >;
    };
};

export function CardLink({ className, to: path }: CardLinkProps) {
    return (
        <li className={cn("col-span-1 flex rounded-md shadow-sm", className)}>
            <Link
                className={cn(
                    "group w-full flex justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "hover:bg-accent hover:text-accent-foreground",
                )}
                to={path}
            >
                <div
                    className={cn(
                        path.bgColor,
                        "flex w-12 shrink-0 items-center justify-center rounded-l-md text-sm font-medium text-white",
                    )}
                >
                    {path.icon ? (
                        <path.icon className="h-4 w-4 pointer-events-none" />
                    ) : (
                        path.label.charAt(0).toUpperCase()
                    )}
                </div>
                <div
                    className={cn(
                        "flex-1 px-2 py-2 truncate rounded-r-md border-b border-r border-t border-gray-200 bg-white dark:border-white/10 dark:bg-gray-800/50",
                        "group-hover:bg-accent group-hover:text-accent-foreground",
                    )}
                >
                    {path.label}
                </div>
            </Link>
        </li>
    );
}
