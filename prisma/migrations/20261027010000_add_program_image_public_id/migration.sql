-- Preserve imageUrl and existing programs. Older Vercel Blob images have no Cloudinary public ID.
SET @program_image_public_id_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'programdonasi'
    AND COLUMN_NAME = 'imagePublicId'
);
SET @program_image_public_id_sql = IF(
  @program_image_public_id_exists = 0,
  'ALTER TABLE `programdonasi` ADD COLUMN `imagePublicId` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE program_image_public_id_statement FROM @program_image_public_id_sql;
EXECUTE program_image_public_id_statement;
DEALLOCATE PREPARE program_image_public_id_statement;
