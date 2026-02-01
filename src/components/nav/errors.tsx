/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ExternalLink, GitHubIssueLink } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { Paragraph } from "@/components/ui/typography";

export type NotImplementedProps = {
    docUrl?: string;
    ghIssueNumber?: number;
};

export function NotImplemented({ docUrl, ghIssueNumber }: NotImplementedProps) {
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
