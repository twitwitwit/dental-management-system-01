CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`dentistId` int,
	`appointmentDate` date NOT NULL,
	`startTime` varchar(8) NOT NULL,
	`endTime` varchar(8) NOT NULL,
	`type` varchar(64) NOT NULL DEFAULT 'Checkup',
	`status` enum('scheduled','confirmed','completed','no_show') NOT NULL DEFAULT 'scheduled',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clinicSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(128) NOT NULL,
	`settingValue` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinicSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `clinicSettings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `clinicalNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`appointmentId` int,
	`dentistName` varchar(128),
	`title` varchar(256),
	`content` text,
	`noteDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clinicalNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `insuranceClaims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`patientInsuranceId` int,
	`invoiceId` int,
	`claimNumber` varchar(32) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('pending','submitted','approved','denied') NOT NULL DEFAULT 'pending',
	`description` text,
	`filedDate` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `insuranceClaims_id` PRIMARY KEY(`id`),
	CONSTRAINT `insuranceClaims_claimNumber_unique` UNIQUE(`claimNumber`)
);
--> statement-breakpoint
CREATE TABLE `insuranceProviders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`contactPhone` varchar(32),
	`website` varchar(256),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `insuranceProviders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`category` varchar(128),
	`sku` varchar(64),
	`quantity` int NOT NULL DEFAULT 0,
	`unit` varchar(32) NOT NULL DEFAULT 'pcs',
	`lowStockThreshold` int NOT NULL DEFAULT 10,
	`unitCost` decimal(10,2) NOT NULL DEFAULT '0',
	`supplier` varchar(256),
	`lastRestockedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`type` enum('stock_in','stock_out','adjustment') NOT NULL,
	`quantity` int NOT NULL,
	`reason` varchar(256),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoiceItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`description` varchar(256) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`amount` decimal(10,2) NOT NULL DEFAULT '0',
	CONSTRAINT `invoiceItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(32) NOT NULL,
	`patientId` int NOT NULL,
	`treatmentPlanId` int,
	`subtotal` decimal(10,2) NOT NULL DEFAULT '0',
	`discount` decimal(10,2) NOT NULL DEFAULT '0',
	`tax` decimal(10,2) NOT NULL DEFAULT '0',
	`total` decimal(10,2) NOT NULL DEFAULT '0',
	`status` enum('draft','sent','paid','partial','cancelled') NOT NULL DEFAULT 'draft',
	`dueDate` date,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `patientInsurance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`providerId` int NOT NULL,
	`policyNumber` varchar(128) NOT NULL,
	`groupNumber` varchar(128),
	`memberName` varchar(256),
	`relationship` varchar(64),
	`coPay` decimal(10,2) NOT NULL DEFAULT '0',
	`deductible` decimal(10,2) NOT NULL DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patientInsurance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(128) NOT NULL,
	`lastName` varchar(128) NOT NULL,
	`dateOfBirth` date,
	`gender` enum('male','female','other'),
	`phone` varchar(32),
	`email` varchar(320),
	`address` text,
	`bloodType` varchar(4),
	`allergies` text,
	`medicalNotes` text,
	`dentalNotes` text,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`registeredAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`patientId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`method` enum('cash','card','bank_transfer','insurance') NOT NULL,
	`reference` varchar(128),
	`type` enum('payment','refund') NOT NULL DEFAULT 'payment',
	`paidAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `toothConditions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`toothNumber` varchar(4) NOT NULL,
	`condition` enum('healthy','decay','filling','crown','extraction','implant','root_canal','missing','veneers','bridge') NOT NULL DEFAULT 'healthy',
	`note` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `toothConditions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `treatmentPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`diagnosis` text,
	`status` enum('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned',
	`estimatedCost` decimal(10,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `treatmentPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `treatmentProcedures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`toothNumber` varchar(4),
	`procedureName` varchar(256) NOT NULL,
	`description` text,
	`status` enum('planned','done') NOT NULL DEFAULT 'planned',
	`cost` decimal(10,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `treatmentProcedures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','dentist','receptionist','staff') NOT NULL DEFAULT 'staff';--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);