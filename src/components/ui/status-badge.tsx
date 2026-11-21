import { Badge } from "@/components/ui/badge";
import { D4HAccessToken } from "@/lib/schemas/d4h-access-token";
import { SKILL_CHECK_STATUS_LABELS } from "@/lib/schemas/skill-check";
import { SkillPackage } from "@/lib/schemas/skill-package";
import type { RecordStatus } from "@/lib/validation";

/*
 * Status badges for a page title (`Saratoga.Title badges=`): one component per status type,
 * each mapping a status value to its `Badge` tone and label. A record in its normal state shows
 * no badge, so each returns `null` for it. Status badges in table cells and rows are separate.
 */

/** A record's `RecordStatus` (person, team, membership, skill, group, bundle, template, …). */
export function RecordStatusBadge({ status }: { status: RecordStatus }) {
    switch (status) {
        case "Active":
            return null;
        case "Archived":
            return <Badge variant="warning">Archived</Badge>;
        case "Deleted":
            return <Badge variant="destructive">Deleted</Badge>;
    }
}

/** A skill-check session's status. A draft is the normal working state. */
export function SkillCheckSessionStatusBadge({
    status,
}: {
    status: "Draft" | "Pending" | "Include" | "Exclude" | "Deleted";
}) {
    const label = SKILL_CHECK_STATUS_LABELS[status] ?? status;
    switch (status) {
        case "Draft":
            return null;
        case "Pending":
            return <Badge variant="info">{label}</Badge>;
        case "Include":
            return <Badge variant="success">{label}</Badge>;
        case "Exclude":
            return <Badge variant="warning">{label}</Badge>;
        case "Deleted":
            return <Badge variant="destructive">{label}</Badge>;
    }
}

/**
 * Whether a subscriber can still use a skill package (`SkillPackage.isAvailable`). A package its
 * author has unpublished or archived is withdrawn; a deleted one says so.
 */
export function SkillPackageAvailabilityBadge({
    skillPackage,
}: {
    skillPackage: { published: boolean; status: RecordStatus };
}) {
    if (SkillPackage.isAvailable(skillPackage)) return null;
    if (skillPackage.status === "Deleted") return <Badge variant="destructive">Deleted</Badge>;
    return <Badge variant="warning">Withdrawn</Badge>;
}

/** A skill package's publish state, for its author. Unpublished is a normal working state. */
export function SkillPackagePublishBadge({ published }: { published: boolean }) {
    if (published) return null;
    return <Badge variant="outline">Unpublished</Badge>;
}

/**
 * A D4H Nag rule's run state. A disabled rule is paused too ("disabled" is a paused reason), but
 * the badge names the rule's own state when it's that.
 */
export function D4HNagRuleStatusBadge({ enabled, paused }: { enabled: boolean; paused: boolean }) {
    if (!paused) return null;
    if (!enabled) return <Badge variant="outline">Disabled</Badge>;
    return <Badge variant="warning">Paused</Badge>;
}

/** An I3 form's state. Only a submitted form gets a badge. */
export function I3FormStatusBadge({ submitted }: { submitted: boolean }) {
    if (!submitted) return null;
    return <Badge variant="success">Submitted</Badge>;
}

/** A system user's ban state. */
export function UserBanStatusBadge({ banned }: { banned: boolean | null | undefined }) {
    if (!banned) return null;
    return <Badge variant="destructive">Banned</Badge>;
}

/** A D4H access token's last check, a free-form status string: anything not OK shows as-is. */
export function D4HAccessTokenStatusBadge({ status }: { status: string }) {
    if (D4HAccessToken.isStatusOk(status)) return null;
    return <Badge variant="destructive">{status}</Badge>;
}
