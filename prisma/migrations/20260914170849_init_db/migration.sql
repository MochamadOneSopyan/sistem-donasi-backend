-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('PENGURUS', 'DONATUR', 'PENERIMA_BANTUAN') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgramDonasi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `judul` VARCHAR(191) NOT NULL,
    `deskripsi` TEXT NOT NULL,
    `targetDana` DOUBLE NOT NULL,
    `terkumpul` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Donasi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jumlah` DOUBLE NOT NULL,
    `status` ENUM('PENDING', 'BERHASIL', 'GAGAL') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `donaturId` INTEGER NOT NULL,
    `programId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PenerimaBantuan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `alamat` VARCHAR(191) NOT NULL,
    `noHp` VARCHAR(191) NOT NULL,
    `alasan` TEXT NOT NULL,
    `status` ENUM('VERIFIKASI', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'VERIFIKASI',

    UNIQUE INDEX `PenerimaBantuan_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PenyaluranBantuan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jumlahBantuan` DOUBLE NOT NULL,
    `tanggalSalur` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `keterangan` VARCHAR(191) NOT NULL,
    `programId` INTEGER NOT NULL,
    `penerimaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Donasi` ADD CONSTRAINT `Donasi_donaturId_fkey` FOREIGN KEY (`donaturId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donasi` ADD CONSTRAINT `Donasi_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `ProgramDonasi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PenerimaBantuan` ADD CONSTRAINT `PenerimaBantuan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PenyaluranBantuan` ADD CONSTRAINT `PenyaluranBantuan_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `ProgramDonasi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PenyaluranBantuan` ADD CONSTRAINT `PenyaluranBantuan_penerimaId_fkey` FOREIGN KEY (`penerimaId`) REFERENCES `PenerimaBantuan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
