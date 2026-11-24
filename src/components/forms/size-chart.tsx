/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cn } from "@/lib/utils";

/** One fit of a garment (e.g. Men's, Ladies') and its sizes, from the maker's size chart. */
export type SizeChartFit = {
    id: string;
    label: string;
    sizes: { size: string; /** Garment half-chest in cm. */ halfChestCm?: number }[];
};

/**
 * A maker's size chart: one small table per fit (size, garment half-chest, and the garment chest
 * all the way round), side by side so it reads on a phone. The chosen size is highlighted.
 * Collapsible by default (a "Size chart" disclosure); `collapsible={false}` shows it as is.
 * Renders nothing when no size has a measurement.
 */
export function SizeChart({
    fits,
    selected,
    collapsible = true,
    className,
}: {
    fits: SizeChartFit[];
    selected: { fitId: string; size: string } | null;
    collapsible?: boolean;
    className?: string;
}) {
    const measured = fits.filter((fit) => fit.sizes.some((size) => size.halfChestCm !== undefined));
    if (measured.length === 0) return null;

    const body = (
        <>
            <div
                className={cn(
                    "grid grid-cols-1 gap-4 min-[360px]:grid-cols-2",
                    collapsible && "px-3 pb-3",
                )}
            >
                {measured.map((fit) => (
                    <table key={fit.id} className="w-full self-start text-sm">
                        <caption className="pb-1 text-left font-medium">{fit.label}</caption>
                        <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                                <th className="py-1 pr-2 font-medium">Size</th>
                                <th className="py-1 pr-2 text-right font-medium">½ chest</th>
                                <th className="py-1 text-right font-medium">Chest</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fit.sizes.map(({ size, halfChestCm }) => {
                                const isSelected =
                                    selected?.fitId === fit.id && selected.size === size;
                                return (
                                    <tr
                                        key={size}
                                        aria-current={isSelected || undefined}
                                        className={cn(
                                            "border-b last:border-0",
                                            isSelected &&
                                                "bg-selected font-semibold text-selected-foreground",
                                        )}
                                    >
                                        <td className="py-1 pr-2">{size}</td>
                                        <td className="py-1 pr-2 text-right tabular-nums">
                                            {halfChestCm ?? "—"}
                                        </td>
                                        <td className="py-1 text-right text-muted-foreground tabular-nums">
                                            {halfChestCm === undefined
                                                ? "—"
                                                : `~${halfChestCm * 2}`}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ))}
            </div>
            <p className={cn("text-xs text-muted-foreground", collapsible ? "px-3 pb-3" : "pt-2")}>
                Garment measurements in cm, from the maker&apos;s size chart. Chest is the garment
                all the way round.
            </p>
        </>
    );

    if (!collapsible) return <div className={className}>{body}</div>;
    return (
        <details className={cn("group rounded-lg border", className)}>
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
                Size chart
            </summary>
            {body}
        </details>
    );
}
