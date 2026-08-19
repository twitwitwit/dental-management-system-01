CREATE TABLE `toothSurfaceConditions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`toothNumber` varchar(4) NOT NULL,
	`surface` enum('mesial','distal','buccal','lingual','occlusal') NOT NULL,
	`condition` enum('healthy','decay','filling','crown','extraction','implant','root_canal','missing','veneers','bridge') NOT NULL DEFAULT 'healthy',
	`note` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `toothSurfaceConditions_id` PRIMARY KEY(`id`)
);
