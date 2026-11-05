CREATE TABLE IF NOT EXISTS `blocks` (
	`user_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `blocked_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bookmarks` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comments_post_idx` ON `comments` (`post_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `communities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`cover` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#ded8c8' NOT NULL,
	`owner_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `follows` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `memberships` (
	`user_id` text NOT NULL,
	`community_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `community_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`body` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`from_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_recipient_idx` ON `messages` (`to_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_sender_idx` ON `messages` (`from_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_recipient_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`community_id` text,
	`kind` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`media` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `posts_time_idx` ON `posts` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `posts_user_idx` ON `posts` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `posts_community_idx` ON `posts` (`community_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reactions` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `reports_once_idx` ON `reports` (`user_id`,`post_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reposts` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`from_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `testimonials_recipient_idx` ON `testimonials` (`to_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar` text DEFAULT '' NOT NULL,
	`cover` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`interests` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_handle_unique` ON `users` (`handle`);
