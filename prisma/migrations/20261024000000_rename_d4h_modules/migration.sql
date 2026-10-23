-- Rename the D4H Views and I3 modules to D4H and D4H I3 (#452).
-- Data only: organization settings are stored one row per leaf, keyed by dot path, so moving a
-- module's settings is a rewrite of the key prefix. Past audit entries keep their old paths.

-- modules.d4h-views.* -> modules.d4h.*
UPDATE "organization_config"
SET "key" = 'modules.d4h.' || substring("key" FROM char_length('modules.d4h-views.') + 1)
WHERE "key" LIKE 'modules.d4h-views.%';

-- modules.i3.* -> modules.d4h-i3.* (enabled and storage)
UPDATE "organization_config"
SET "key" = 'modules.d4h-i3.' || substring("key" FROM char_length('modules.i3.') + 1)
WHERE "key" LIKE 'modules.i3.%';
