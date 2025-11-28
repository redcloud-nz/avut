/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import {
    BoldIcon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    ListTodoIcon,
    StrikethroughIcon,
    SubscriptIcon,
    SuperscriptIcon,
    TableIcon,
    UnderlineIcon,
} from "lucide-react";

import {
    IS_BOLD,
    IS_ITALIC,
    IS_UNDERLINE,
    IS_STRIKETHROUGH,
    IS_SUBSCRIPT,
    IS_SUPERSCRIPT,
    applyFormat$,
    currentFormat$,
    useCellValues,
    usePublisher,
    MultipleChoiceToggleGroup,
    currentListType$,
    applyListType$,
    SingleChoiceToggleGroup,
    insertTable$,
    map,
    activeEditor$,
    Cell,
    ButtonWithTooltip,
    openLinkEditDialog$,
} from "@mdxeditor/editor";

// Format Text Toggles

const FormatOptionsMap = {
    bold: {
        formatFlag: IS_BOLD,
        titleRemove: "Remove bold",
        titleAdd: "Bold",
        icon: <BoldIcon className="size-5" />,
    },
    italic: {
        formatFlag: IS_ITALIC,
        titleRemove: "Remove italic",
        titleAdd: "Italic",
        icon: <ItalicIcon className="size-5" />,
    },
    underline: {
        formatFlag: IS_UNDERLINE,
        titleRemove: "Remove underline",
        titleAdd: "Underline",
        icon: <UnderlineIcon className="size-5" />,
    },
    strikethrough: {
        formatFlag: IS_STRIKETHROUGH,
        titleRemove: "Remove strikethrough",
        titleAdd: "Strikethrough",
        icon: <StrikethroughIcon className="size-5" />,
    },
    subscript: {
        formatFlag: IS_SUBSCRIPT,
        titleRemove: "Remove subscript",
        titleAdd: "Subscript",
        icon: <SubscriptIcon className="size-5" />,
    },
    superscript: {
        formatFlag: IS_SUPERSCRIPT,
        titleRemove: "Remove superscript",
        titleAdd: "Superscript",
        icon: <SuperscriptIcon className="size-5" />, // Placeholder icon
    },
};

interface FormatTextToggleProps {
    options?: (
        | "bold"
        | "italic"
        | "underline"
        | "strikethrough"
        | "subscript"
        | "superscript"
    )[];
}

export function FormatTextToggleGroup({
    options = ["bold", "italic", "underline"],
}: FormatTextToggleProps) {
    const [currentFormat] = useCellValues(currentFormat$);
    const applyFormat = usePublisher(applyFormat$);

    return (
        <MultipleChoiceToggleGroup
            items={options.map((formatName) => {
                const format = FormatOptionsMap[formatName];
                const active = (currentFormat & format.formatFlag) !== 0;

                return {
                    title: active ? format.titleRemove : format.titleAdd,
                    contents: format.icon,
                    active,
                    onChange: () => {
                        applyFormat(formatName);
                    },
                };
            })}
        />
    );
}

// List Style Toggles

const ListStyleOptionsMap = {
    bullet: {
        titleRemove: "Remove bullet list",
        titleAdd: "Bullet list",
        icon: <ListIcon className="size-5" />,
    },
    number: {
        titleRemove: "Remove numbered list",
        titleAdd: "Numbered list",
        icon: <ListOrderedIcon className="size-5" />,
    },
    check: {
        titleRemove: "Remove checklist",
        titleAdd: "Checklist",
        icon: <ListTodoIcon className="size-5" />,
    },
};

interface ListStyleToggleProps {
    options?: ("bullet" | "number" | "check")[];
}

export function ListStyleToggleGroup({
    options = ["bullet", "number"],
}: ListStyleToggleProps) {
    const [currentListType] = useCellValues(currentListType$);
    const applyListType = usePublisher(applyListType$);

    return (
        <SingleChoiceToggleGroup
            items={options.map((listTypeName) => {
                const listType = ListStyleOptionsMap[listTypeName];
                const active = currentListType === listTypeName;

                return {
                    value: listTypeName,
                    title: active ? listType.titleRemove : listType.titleAdd,
                    contents: listType.icon,
                    active,
                };
            })}
            value={currentListType || ""}
            onChange={applyListType}
        />
    );
}

// Insert Table

const disableInsertTableButton$ = Cell<boolean>(false, (r) => {
    r.link(
        r.pipe(
            activeEditor$,
            map((editor) =>
                ["td", "th"].includes(
                    editor
                        ?.getRootElement()
                        ?.parentNode?.nodeName.toLowerCase() ?? "",
                ),
            ),
        ),
        disableInsertTableButton$,
    );
});

export function InsertTableButton() {
    const insertTable = usePublisher(insertTable$);

    const [isDisabled] = useCellValues(disableInsertTableButton$);

    return (
        <ButtonWithTooltip
            title="Insert Table"
            onClick={() => {
                insertTable({ rows: 3, columns: 3 });
            }}
            {...(isDisabled
                ? {
                      "aria-disabled": true,
                      "data-disabled": true,
                      disabled: true,
                  }
                : {})}
        >
            <TableIcon className="size-4" />
        </ButtonWithTooltip>
    );
}

export function CreateLinkButton() {
    const openLinkDialog = usePublisher(openLinkEditDialog$);

    return (
        <ButtonWithTooltip
            title="Create Link"
            onClick={() => {
                openLinkDialog();
            }}
        >
            <LinkIcon className="size-4" />
        </ButtonWithTooltip>
    );
}
