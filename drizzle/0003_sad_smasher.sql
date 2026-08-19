CREATE TABLE `periodontalStatus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`toothNumber` varchar(4) NOT NULL,
	`pd1` decimal(4,1) NOT NULL DEFAULT '0',
	`pd2` decimal(4,1) NOT NULL DEFAULT '0',
	`pd3` decimal(4,1) NOT NULL DEFAULT '0',
	`pd4` decimal(4,1) NOT NULL DEFAULT '0',
	`pd5` decimal(4,1) NOT NULL DEFAULT '0',
	`pd6` decimal(4,1) NOT NULL DEFAULT '0',
	`recession` decimal(4,1) NOT NULL DEFAULT '0',
	`mobility` enum('0','1','2','3') NOT NULL DEFAULT '0',
	`bleeding` int NOT NULL DEFAULT 0,
	`plaque` int NOT NULL DEFAULT 0,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `periodontalStatus_id` PRIMARY KEY(`id`)
);
