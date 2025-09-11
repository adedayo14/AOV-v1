-- Add inline link text columns to Settings table
-- Safe for SQLite: only add if the column doesn't exist
PRAGMA foreign_keys=OFF;

-- Add discountLinkText if missing
WITH cols AS (
	SELECT name FROM pragma_table_info('Settings') WHERE name IN ('discountLinkText','notesLinkText')
)
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM cols WHERE name='discountLinkText') THEN
	(SELECT raise(ignore))
END;
ALTER TABLE "Settings" ADD COLUMN "discountLinkText" TEXT DEFAULT '+ Got a promotion code?';

-- Add notesLinkText if missing
WITH cols2 AS (
	SELECT name FROM pragma_table_info('Settings') WHERE name IN ('notesLinkText')
)
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM cols2 WHERE name='notesLinkText') THEN
	(SELECT raise(ignore))
END;
ALTER TABLE "Settings" ADD COLUMN "notesLinkText" TEXT DEFAULT '+ Add order notes';

PRAGMA foreign_keys=ON;
