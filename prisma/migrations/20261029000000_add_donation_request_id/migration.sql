ALTER TABLE `donasi` ADD COLUMN `requestId` VARCHAR(64) NULL;
CREATE UNIQUE INDEX `donasi_requestId_key` ON `donasi`(`requestId`);
