-- AlterTable
ALTER TABLE `donasi` ADD COLUMN `buktiPembayaran` VARCHAR(191) NULL,
    ADD COLUMN `metodePembayaran` VARCHAR(191) NOT NULL DEFAULT 'TRANSFER_BANK';
