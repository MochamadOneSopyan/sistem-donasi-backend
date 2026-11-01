-- Nullable so existing programs continue to use the fallback image.
-- Conditional because autoMigrate may have added this column first.
SET @program_image_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'programdonasi'
    AND COLUMN_NAME = 'imageUrl'
);
SET @program_image_sql = IF(
  @program_image_exists = 0,
  'ALTER TABLE `programdonasi` ADD COLUMN `imageUrl` TEXT NULL',
  'SELECT 1'
);
PREPARE program_image_statement FROM @program_image_sql;
EXECUTE program_image_statement;
DEALLOCATE PREPARE program_image_statement;
