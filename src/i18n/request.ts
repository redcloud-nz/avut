/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
    // Fixed for now.
    const locale = "en";

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default,
    };
});
