/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { AppPageContent, AppPageContentProps } from "@/components/app-page";
import Artie from "@/components/art/artie";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { ExternalLink, GitHubIssueLink } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { Paragraph } from "@/components/ui/typography";

export function NotFound(props: AppPageContentProps) {
    return (
        <AppPageContent variant="centered" {...props}>
            <Empty>
                <EmptyHeader>
                    <EmptyMedia>
                        <Artie pose="NotFound" />
                    </EmptyMedia>
                    <EmptyTitle>404 - Not Found</EmptyTitle>
                    <EmptyDescription>
                        The resource you requested was not found. Have you tried
                        looking under the couch?
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        </AppPageContent>
    );
}

export type NotImplementedProps = AppPageContentProps & {
    docUrl?: string;
    ghIssueNumber?: number;
};

export function NotImplemented({
    docUrl,
    ghIssueNumber,
    ...props
}: NotImplementedProps) {
    return (
        <div className="h-full flex flex-col justify-center items-center">
            <div className="flex flex-col gap-2 justify-center items-center">
                <div className="font-semibold text-2xl text-zinc-800">501</div>
                <div className="font-semibold text-zinc-800">
                    Not Implemented
                </div>
                <Separator orientation="horizontal" className="w-40" />
                <Paragraph>
                    This page is part of a planned or proposed feature that has
                    not yet been implemented.
                </Paragraph>
                {docUrl ? (
                    <Paragraph>
                        Learn more about the concept of this feature in the{" "}
                        <ExternalLink href={docUrl}>documentation</ExternalLink>
                        .
                    </Paragraph>
                ) : null}

                {ghIssueNumber ? (
                    <Paragraph>
                        Learn more about this proposal:{" "}
                        <GitHubIssueLink
                            issueNumber={ghIssueNumber}
                        ></GitHubIssueLink>
                        .
                    </Paragraph>
                ) : null}
            </div>
        </div>
    );
}

export function Unauthorized({ ...props }: AppPageContentProps) {
    return (
        <AppPageContent variant="centered" {...props}>
            <div className="flex flex-col gap-2 items-center">
                <div className="font-semibold text-2xl text-zinc-800">401</div>
                <div className="font-semibold text-zinc-800">Unauthorized</div>
                <Separator orientation="horizontal" className="w-40" />
                <Paragraph>
                    You need to be signed in to access this feature.
                </Paragraph>
            </div>
        </AppPageContent>
    );
}

export function Forbidden({ ...props }: AppPageContentProps) {
    return (
        <AppPageContent variant="centered" {...props}>
            <div className="flex flex-col gap-2 items-center">
                <div className="font-semibold text-2xl text-zinc-800">403</div>
                <div className="font-semibold text-zinc-800">Forbidden</div>
                <Separator orientation="horizontal" className="w-40" />
                <Paragraph>
                    You do not have permission to access this page.
                </Paragraph>
            </div>
        </AppPageContent>
    );
}

export function UnknownError({
    error,
    ...props
}: AppPageContentProps & { error: Error & { digest?: string } }) {
    return (
        <AppPageContent variant="centered" {...props}>
            <Empty>
                <EmptyHeader>
                    <EmptyMedia>
                        <Artie pose="Error" />
                    </EmptyMedia>
                    <EmptyTitle>500 - Error</EmptyTitle>
                    <EmptyDescription>
                        Something went wrong on our end. Please try again later.
                    </EmptyDescription>
                </EmptyHeader>
                <Separator orientation="horizontal" className="w-40" />
                <EmptyContent>
                    <Paragraph>{error.message}</Paragraph>
                    {error.digest && <Paragraph>{error.digest}</Paragraph>}
                </EmptyContent>
            </Empty>
        </AppPageContent>
    );
}

export function ModuleNotEnabled({
    moduleName,
    ...props
}: AppPageContentProps & { moduleName: string }) {
    return (
        <AppPageContent variant="centered" {...props}>
            <Empty>
                <EmptyHeader>
                    <EmptyMedia>
                        <Artie pose="NotAllowed" />
                    </EmptyMedia>
                    <EmptyTitle>Module Not Available</EmptyTitle>
                    <EmptyDescription>
                        The {moduleName} module is not enabled for your
                        organization.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        </AppPageContent>
    );
}
