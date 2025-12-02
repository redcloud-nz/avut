/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export const about = {
    label: "About",
    href: "/about",
} as const;

export const auth = {
    forgotPassword: {
        label: "Forgot Password",
        href: "/auth/forgot-password",
    },
    resetPassword: (email: string) =>
        ({
            label: "Reset Password",
            href: `/auth/reset-password/${encodeURIComponent(email)}`,
        }) as const,
    signIn: {
        label: "Sign In",
        href: "/auth/sign-in",
    },
    signUp: {
        label: "Sign Up",
        href: "/auth/sign-up",
    },
    verifyEmail: (email: string) =>
        ({
            label: "Verify Email",
            href: `/auth/verify-email/${encodeURIComponent(email)}`,
        }) as const,
} as const;

export const dashboard = {
    label: "Dashboard",
    href: "/dashboard",
} as const;

export const marketing = {
    index: { href: "/" },
    contact: {
        label: "Contact",
        href: "/contact",
    },
    faq: {
        label: "FAQ",
        href: "/#faq",
    },
    features: {
        label: "Features",
        href: "/#features",
    },
    pricing: {
        label: "Pricing",
        href: "/#pricing",
    },
    privacyPolicy: {
        label: "Privacy Policy",
        href: "/privacy-policy",
    },
    termsOfService: {
        label: "Terms of Service",
        href: "/terms-of-service",
    },
    testimonials: {
        label: "Testimonials",
        href: "/#testimonials",
    },
};

export const onboarding = {
    chooseOrganization: {
        label: "Choose Organization",
        href: "/onboarding/choose-organization",
    },
};

export const orgs = {
    create: {
        label: "Create Organization",
        href: "/orgs/--create",
    },
    select: {
        label: "Select Organization",
        href: "/orgs/--select",
    },
} as const;

type OrgPaths = {
    admin: ReturnType<typeof adminModule>;
    availability: ReturnType<typeof availabilityModule>;
    cards: ReturnType<typeof cardsModule>;
    checklists: ReturnType<typeof checklistsModule>;
    dashboard: { label: string; href: string };
    d4hViews: ReturnType<typeof d4hViewsModule>;
    dev: ReturnType<typeof devModule>;
    fog: ReturnType<typeof fogModule>;
    notes: ReturnType<typeof notesModule>;
    personal: ReturnType<typeof personalModule>;
    skills: ReturnType<typeof skillsModule>;
    skillPackageManager: ReturnType<typeof skillPackageManagerModule>;
};

const orgPathCache = new Map<string, OrgPaths>();

export function org(orgSlug: string): OrgPaths {
    let paths = orgPathCache.get(orgSlug);
    if (!paths) {
        paths = {
            admin: adminModule(orgSlug),
            availability: availabilityModule(orgSlug),
            cards: cardsModule(orgSlug),
            checklists: checklistsModule(orgSlug),
            dashboard: { label: "Dashboard", href: `/orgs/${orgSlug}` },
            d4hViews: d4hViewsModule(orgSlug),
            dev: devModule(orgSlug),
            fog: fogModule(orgSlug),
            notes: notesModule(orgSlug),
            personal: personalModule(orgSlug),
            skills: skillsModule(orgSlug),
            skillPackageManager: skillPackageManagerModule(orgSlug),
        } satisfies OrgPaths;
        orgPathCache.set(orgSlug, paths);
    }

    return paths;
}

// Modules

function adminModule(org_slug: string) {
    const base = `/orgs/${org_slug}/admin` as const;

    return {
        label: "Admin",
        href: base,

        invitations: {
            label: "Invitations",
            href: `${base}/invitations`,

            create: {
                label: "Create",
                href: `${base}/invitations/--create`,
            },
        },

        person: (personId: string) => {
            const personBase = `${base}/personnel/${personId}` as const;
            return {
                href: personBase,

                teamMembership: (teamId: string) =>
                    ({
                        href: `${personBase}/team-memberships/${teamId}`,

                        update: {
                            label: "Update",
                            href: `${personBase}/team-memberships/${teamId}/--update`,
                        },
                    }) as const,

                teamMemberships: {
                    label: "Team Memberships",
                    href: `${personBase}/team-memberships`,

                    create: {
                        label: "Add Team Membership",
                        href: `${personBase}/team-memberships/--create`,
                    },
                },

                update: {
                    label: "Update",
                    href: `${personBase}/--update`,
                },
            } as const;
        },
        personnel: {
            label: "Personnel",
            href: `${base}/personnel`,
            create: {
                label: "Create",
                href: `${base}/personnel/--create`,
            },

            import: {
                label: "Import Personnel",
                href: `${base}/personnel/--import`,
            },
        },
        profile: {
            href: `${base}/profile`,
            label: "Organisation",
        },

        settings: {
            label: "Settings",
            href: `${base}/settings`,
        },
        team: (teamId: string) => {
            const teamBase = `${base}/teams/${teamId}` as const;
            return {
                href: teamBase,

                member: (personId: string) =>
                    ({
                        href: `${teamBase}/members/${personId}`,

                        update: {
                            label: "Update",
                            href: `${teamBase}/members/${personId}/--update`,
                        },
                    }) as const,
                members: {
                    label: "Members",
                    href: `${teamBase}/members`,

                    create: {
                        label: "Add Member",
                        href: `${teamBase}/members/--create`,
                    },
                },
                update: {
                    label: "Update",
                    href: `${teamBase}/--update`,
                },
            } as const;
        },
        teams: {
            label: "Teams",
            href: `${base}/teams`,

            create: {
                label: "Create",
                href: `${base}/teams/--create`,
            },
        },
        user: (userId: string) =>
            ({
                href: `${base}/users/${userId}`,
            }) as const,
        users: {
            label: "Users",
            href: `${base}/users`,
        },
    } as const;
}

function availabilityModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/availability` as const;

    return {
        label: "Availability",
        href: base,
    } as const;
}

function cardsModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/cards` as const;

    return {
        label: "Reference Cards",
        href: base,
    } as const;
}

function checklistsModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/checklists` as const;

    return {
        label: "Checklists",
        href: base,
    } as const;
}

function d4hViewsModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/d4h` as const;

    return {
        label: "D4H Integration",
        href: base,
        activities: {
            label: "Activities",
            href: `${base}/activities`,
            bgColor: "bg-teal-400",
        },
        calendar: {
            label: "Calendar",
            href: `${base}/calendar`,
            bgColor: "bg-yellow-400",
        },

        equipment: {
            label: "Equipment",
            href: `${base}/equipment`,
            bgColor: "bg-red-400",
        },
        personnel: {
            label: "Personnel",
            href: `${base}/personnel`,
            bgColor: "bg-blue-400",
        },
    } as const;
}

function devModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/dev` as const;

    return {
        label: "Dev",
        href: base,
        tableLayout: {
            label: "Table Layout",
            href: `${base}/table-layout`,
        },
    } as const;
}

function fogModule(orgSlug: string) {
    return {
        label: "Field Operations Guide",
        href: `/orgs/${orgSlug}/fog`,
    } as const;
}

function notesModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/notes` as const;
    return {
        label: "Notes",
        href: base,

        create: {
            label: "New Note",
            href: `${base}/--create`,
        },

        note: (noteId: string) =>
            ({
                labelled: (noteTitle: string) => ({
                    label: noteTitle,
                    href: `${base}/${noteId}`,
                }),
                href: `${base}/${noteId}`,
                history: {
                    label: "History",
                    href: `${base}/${noteId}/history`,
                },
                update: {
                    label: "Update",
                    href: `${base}/${noteId}/--update`,
                },
            }) as const,
    } as const;
}

function personalModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/personal` as const;

    return {
        label: "Personal",
        href: base,

        d4hAccessToken: (tokenId: string) =>
            ({
                href: `${base}/d4h-access-tokens/${tokenId}`,
            }) as const,
        d4hAccessTokens: {
            label: "D4H Access Tokens",
            href: `${base}/d4h-access-tokens`,

            create: {
                label: "Add Access Token",
                href: `${base}/d4h-access-tokens/--create`,
            },
        },
        dashboard: {
            label: "Dashboard",
            href: base,
        },
        settings: {
            label: "Settings",
            href: `${base}/settings`,
        },
        whoami: {
            label: "Who Am I",
            href: `${base}/whoami`,
        },
        profile: {
            label: "Profile",
            href: `${base}/profile`,
        },
    } as const;
}

function skillsModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/skills` as const;
    return {
        label: "Skills",
        href: base,

        catalogue: {
            label: "Catalogue",
            href: `${base}/catalogue`,
        },

        checks: {
            label: "Checks",
            href: `${base}/checks`,
            create: {
                label: "Record Check",
                href: `${base}/checks/--create`,
            },
        },
        reports: {
            label: "Reports",
            href: `${base}/reports`,
            individual: {
                href: `${base}/reports/individual`,
                label: "Individual",
            },
            teamSkills: {
                href: `${base}/reports/team-skills`,
                label: "Team Skills",
            },
            teamMembers: {
                href: `${base}/reports/team-members`,
                label: "Team Members",
            },
        },
        session: (sessionId: string) => {
            return {
                href: `${base}/sessions/${sessionId}`,

                record: {
                    href: `${base}/sessions/${sessionId}/record`,
                    label: "Recorder",
                },
                review: {
                    href: `${base}/sessions/${sessionId}/review`,
                    label: "Review",
                },
                update: {
                    label: "Update",
                    href: `${base}/sessions/${sessionId}/--update`,
                },
            } as const;
        },
        sessions: {
            label: "Sessions",
            href: `${base}/sessions`,
            create: {
                label: "Create",
                href: `${base}/sessions/--create`,
            },
        },
    } as const;
}

function skillPackageManagerModule(orgSlug: string) {
    const base = `/orgs/${orgSlug}/skill-package-manager` as const;

    return {
        label: "Skill Package Manager",
        href: base,

        skillPackage: (skillPackageId: string) => {
            const packageBase =
                `${base}/skill-packages/${skillPackageId}` as const;

            return {
                href: packageBase,
                update: {
                    href: `${packageBase}/--update`,
                    label: "Update",
                },

                group: (skillGroupId: string) =>
                    ({
                        href: `${packageBase}/groups/${skillGroupId}`,
                        update: {
                            label: "Update",
                            href: `${packageBase}/groups/${skillGroupId}/--update`,
                        },
                    }) as const,
                groups: {
                    label: "Groups",
                    create: {
                        label: "Create",
                        href: `${packageBase}/groups/--create`,
                    },
                },

                skill: (skillId: string) =>
                    ({
                        href: `${packageBase}/skills/${skillId}`,
                        update: {
                            label: "Update",
                            href: `${packageBase}/skills/${skillId}/--update`,
                        },
                    }) as const,

                skills: {
                    label: "Skills",
                    create: {
                        label: "Create",
                        href: `${packageBase}/skills/--create`,
                    },
                },
            } as const;
        },
        skillPackages: {
            label: "Skill Packages",
            href: `${base}/skill-packages`,
            create: {
                label: "Create",
                href: `${base}/skill-packages/--create`,
            },
            import: {
                label: "Import Skill Package",
                href: `${base}/skill-packages/--import`,
            },
        } as const,
    };
}

const docsBase = "https://github.com/redcloud-nz/rtplus/wiki";

export const documentation = {
    index: `${docsBase}`,
    glossary: `${docsBase}/glossary`,
    competencies: {
        label: "Documentation",
        href: `${docsBase}/Competencies`,
    },
    personnel: `${docsBase}/personnel`,
    skills: `${docsBase}/skills`,
    skillGroups: `${docsBase}/skill-groups`,
    skillPackages: `${docsBase}/skill-packages`,
    teams: `${docsBase}/teams`,
    unified: `${docsBase}/unified`,
    account: `${docsBase}/account`,
};
