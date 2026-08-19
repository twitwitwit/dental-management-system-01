ALTER TABLE `patients` ADD `smokingStatus` enum('never','former','current_light','current_heavy','vaping','chewing_tobacco') DEFAULT 'never';--> statement-breakpoint
ALTER TABLE `patients` ADD `smokingDetails` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `alcoholUse` enum('none','occasional','moderate','heavy') DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `patients` ADD `diabetes` varchar(64);--> statement-breakpoint
ALTER TABLE `patients` ADD `bleedingDisorder` varchar(128);--> statement-breakpoint
ALTER TABLE `patients` ADD `cardiovascular` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `isPregnant` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `patients` ADD `currentMedications` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `bruxism` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `patients` ADD `dentalAnxiety` enum('none','mild','moderate','severe') DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `patients` ADD `chiefComplaint` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `occupation` varchar(128);--> statement-breakpoint
ALTER TABLE `patients` ADD `emergencyContactName` varchar(128);--> statement-breakpoint
ALTER TABLE `patients` ADD `emergencyContactPhone` varchar(32);--> statement-breakpoint
ALTER TABLE `patients` ADD `emergencyContactRelation` varchar(64);