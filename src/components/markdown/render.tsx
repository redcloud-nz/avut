/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { type ComponentProps } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import { cn } from "@/lib/utils";

import "./markdown.css";

interface RenderMarkdownProps extends Omit<ComponentProps<"div">, "children"> {
    markdown: string;
}

export function RenderMarkdown({
    className,
    markdown,
    ...props
}: RenderMarkdownProps) {
    return (
        <div className={cn("markdown-content", className)} {...props}>
            <Markdown
                remarkPlugins={[remarkGfm, remarkBreaks, remarkDirective]}
                rehypePlugins={[rehypeRaw]}
            >
                {markdown}
            </Markdown>
        </div>
    );
}
