/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cn } from "@/lib/utils";

export interface DiagonalColumnHeaderProps {
    label: string;
    headerHeight: number;
    columnWidth?: number;
    angleDeg?: number;
    labelThickness?: number;
    className?: string;
}

/**
 * A table column-header label that runs diagonally across a narrow, uniform-width column,
 * clipped with an ellipsis if too long. Unlike `RotatedColumnHeader` (a rotated label
 * inside a plain rectangular column) or `SkewedColumnHeader` (a `skewX`'d cell), the
 * diagonal *is* the column boundary here: it's a single rotated `<div>` per column, with
 * only a bottom border drawn, anchored so that border touches the true column boundary
 * exactly, and every geometric parameter is derived rather than guessed:
 *
 * - The div is anchored (`transformOrigin: "0 100%"`) at its own bottom-left corner, which
 *   is positioned at the column's bottom-right corner — i.e. where this column meets the
 *   table body's straight vertical divider below it.
 * - Its length is chosen so the far end of that bottom border reaches exactly the top of
 *   the header: for a line at `angleDeg` from horizontal, that requires
 *   `length = headerHeight / sin(angleDeg)`.
 * - Its height (thickness) is chosen so the div's *other* long edge lands exactly on the
 *   preceding column's identical diagonal line, tiling the columns with no gap or overlap:
 *   the perpendicular gap between two such lines anchored `columnWidth` apart is
 *   `columnWidth * sin(angleDeg)`.
 * - The label text is vertically centered in that thickness via padding (not flexbox, so
 *   the box's precise height is untouched), and gets extra trailing padding
 *   (`columnWidth * cos(angleDeg)`) so it — and its ellipsis — never renders past the point
 *   where the div's own top edge would otherwise cross above the header's top edge.
 *
 * The column's own background is drawn here too, as a `skewX`'d rectangle rather than a
 * plain one — a caller putting a plain `bg-background` rect on the `<th>` itself would
 * cover the *previous* column's label wherever it bleeds into this column's rectangle
 * (which, given the shallow label angle, is most of it). A `skewX`'d background exactly
 * matching the label's own parallelogram only ever paints over its own column's diagonal
 * strip, so it never touches a neighboring label — and since adjacent columns' identical
 * parallelograms tile with no gap, the combined backgrounds across a full header row still
 * fully occlude scrolled body content beneath a sticky header. Don't also set a background
 * on the `<th>` — leave it transparent and let this component supply it.
 *
 * See the `table-header` scratch page history for the geometry worked out interactively.
 */
export function DiagonalColumnHeader({
    label,
    headerHeight,
    columnWidth = 50,
    angleDeg = 60,
    labelThickness = 20,
    className,
}: DiagonalColumnHeaderProps) {
    const angleRad = (angleDeg * Math.PI) / 180;

    const lineLength = headerHeight / Math.sin(angleRad);
    const bandThickness = columnWidth * Math.sin(angleRad);
    const verticalPadding = (bandThickness - labelThickness) / 2;
    const endPadding = columnWidth * Math.cos(angleRad);

    // skewX skews from vertical, so matching a line at angleDeg from horizontal needs the
    // complementary angle.
    const skewDeg = 90 - angleDeg;

    return (
        <div
            className={cn("relative", className)}
            style={{ width: columnWidth, height: headerHeight }}
        >
            <div
                className="absolute bg-background"
                style={{
                    width: columnWidth,
                    height: headerHeight,
                    transform: `skewX(-${skewDeg}deg)`,
                    transformOrigin: "bottom",
                }}
            />
            <div
                className="absolute overflow-hidden border-b text-left text-sm text-ellipsis whitespace-nowrap"
                style={{
                    left: columnWidth,
                    top: headerHeight - bandThickness,
                    width: lineLength,
                    height: bandThickness,
                    lineHeight: `${labelThickness}px`,
                    paddingTop: verticalPadding,
                    paddingBottom: verticalPadding,
                    paddingRight: endPadding,
                    boxSizing: "border-box",
                    transform: `rotate(-${angleDeg}deg)`,
                    transformOrigin: "0 100%",
                }}
                title={label}
            >
                {label}
            </div>
        </div>
    );
}

export interface DiagonalLeadColumnHeaderProps {
    label: string;
    headerHeight: number;
    columnWidth?: number;
    angleDeg?: number;
    className?: string;
}

/**
 * The plain, fixed-width leading column-header (e.g. a row-label column like "Skill") that
 * sits immediately to the left of a run of `DiagonalColumnHeader`s. It needs no diagonal
 * label of its own, but it does need the *same* diagonal right edge those columns have,
 * for two reasons: so the divider between it and the first diagonal column matches the
 * look of the dividers between the diagonal columns themselves, and because the first
 * diagonal column's own skewed background retreats away from its left edge as it rises
 * (see `DiagonalColumnHeader`'s doc comment) — without a matching bulge here, that leaves a
 * triangular gap that exposes scrolled body content underneath a sticky header.
 *
 * Built from two overlapping layers rather than one shape: a plain rectangle (this column's
 * true width, holding the label and the header's bottom border) plus a `skewX`'d rectangle
 * behind it, anchored the same way (`transformOrigin: "bottom"`) and by the same angle as
 * the neighboring `DiagonalColumnHeader`s. The skewed layer's top edge bulges out to the
 * right of the plain rectangle, and its `border-r` traces exactly the diagonal line the
 * first data column's own background traces — so the two backgrounds tile with no gap, and
 * the divider matches. That bulge extends past this component's own bounding box into the
 * neighboring `<th>`'s rectangle; give this column's `<th>` a higher `z-index` than the
 * diagonal columns' `<th>`s so it paints on top there.
 */
export function DiagonalLeadColumnHeader({
    label,
    headerHeight,
    columnWidth = 130,
    angleDeg = 60,
    className,
}: DiagonalLeadColumnHeaderProps) {
    const skewDeg = 90 - angleDeg;

    return (
        <div
            className={cn("relative", className)}
            style={{ width: columnWidth, height: headerHeight }}
        >
            <div
                className="absolute border-r bg-background"
                style={{
                    width: columnWidth,
                    height: headerHeight,
                    transform: `skewX(-${skewDeg}deg)`,
                    transformOrigin: "bottom",
                }}
            />
            <div className="absolute inset-0 flex items-end border-b bg-background px-3 py-2 text-left font-medium">
                {label}
            </div>
        </div>
    );
}
