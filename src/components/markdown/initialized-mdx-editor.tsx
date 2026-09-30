/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ForwardedRef } from "react";

import {
    headingsPlugin,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    markdownShortcutPlugin,
    MDXEditor,
    quotePlugin,
    Separator,
    tablePlugin,
    toolbarPlugin,
    type MDXEditorMethods,
} from "@mdxeditor/editor";

import "@mdxeditor/editor/style.css";
import "./markdown.css";

import { cn } from "@/lib/utils";

import type { MarkdownEditorProps } from "./editor";
import {
    CreateLinkButton,
    FormatTextToggleGroup,
    InsertTableButton,
    ListStyleToggleGroup,
} from "./toolbar";

export default function InitializedMDXEditor({
    className,
    contentEditableClassName,
    editorRef,
    fill = false,
    ...props
}: { editorRef: ForwardedRef<MDXEditorMethods> | null } & MarkdownEditorProps) {
    // `className` goes on a wrapper, not on `MDXEditor`: MDXEditor copies its own `className` onto
    // the popup container it portals into `<body>`, so a caller's border or sizing would render a
    // stray box there (a `border` alone adds 2px below the viewport and a page scrollbar).
    return (
        <div className={cn(fill && "flex min-h-0 flex-col", className)}>
            <InitializedMDXEditorInner
                fill={fill}
                contentEditableClassName={contentEditableClassName}
                editorRef={editorRef}
                {...props}
            />
        </div>
    );
}

function InitializedMDXEditorInner({
    contentEditableClassName,
    editorRef,
    fill,
    ...props
}: { editorRef: ForwardedRef<MDXEditorMethods> | null } & Omit<MarkdownEditorProps, "className">) {
    return (
        <MDXEditor
            className={cn(fill && "mdxeditor-fill min-h-0 flex-1")}
            contentEditableClassName={cn(
                "markdown-content min-h-16 overflow-y-auto",
                contentEditableClassName,
            )}
            plugins={[
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                markdownShortcutPlugin(),
                linkPlugin(),
                linkDialogPlugin(),
                // imagePlugin(),
                tablePlugin(),
                toolbarPlugin({
                    toolbarPosition: "bottom",
                    toolbarContents: () => (
                        <>
                            <FormatTextToggleGroup options={["bold", "italic", "underline"]} />
                            <Separator />
                            <ListStyleToggleGroup />
                            <Separator />
                            <CreateLinkButton />
                            {/* <InsertImage /> */}
                            {/* <Separator /> */}
                            <InsertTableButton />
                        </>
                    ),
                }),
                markdownShortcutPlugin(),
            ]}
            {...props}
            ref={editorRef}
        />
    );
}
