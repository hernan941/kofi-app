CREATE TABLE `no_sales_weeks` (
	`id` text PRIMARY KEY NOT NULL,
	`week_start` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "no_sales_weeks_week_start_check" CHECK(length(week_start) = 10 AND date(week_start) IS NOT NULL AND date(week_start) = week_start AND strftime('%w', week_start) = '1')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `no_sales_weeks_week_start_unique` ON `no_sales_weeks` (`week_start`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`weekly_enabled` integer NOT NULL,
	`weekly_weekday` integer NOT NULL,
	`weekly_minute_of_day` integer NOT NULL,
	`monthly_enabled` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "notification_preferences_id_check" CHECK(id = 'device'),
	CONSTRAINT "notification_preferences_weekly_enabled_check" CHECK(weekly_enabled IN (0, 1)),
	CONSTRAINT "notification_preferences_monthly_enabled_check" CHECK(monthly_enabled IN (0, 1)),
	CONSTRAINT "notification_preferences_weekday_check" CHECK(weekly_weekday BETWEEN 1 AND 7),
	CONSTRAINT "notification_preferences_minute_check" CHECK(weekly_minute_of_day BETWEEN 0 AND 1439)
);
--> statement-breakpoint
CREATE TABLE `product_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`position` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "product_photos_position_check" CHECK(position >= 0),
	CONSTRAINT "product_photos_width_check" CHECK(width > 0),
	CONSTRAINT "product_photos_height_check" CHECK(height > 0),
	CONSTRAINT "product_photos_byte_size_check" CHECK(byte_size > 0),
	CONSTRAINT "product_photos_sha256_check" CHECK(length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE INDEX `product_photos_product_id_idx` ON `product_photos` (`product_id`);--> statement-breakpoint
CREATE TABLE `product_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text,
	`pricing_mode` text NOT NULL,
	`price` integer,
	`cost` integer,
	`position` integer NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "product_versions_pricing_mode_check" CHECK(pricing_mode IN ('fixed', 'negotiable')),
	CONSTRAINT "product_versions_pricing_consistency_check" CHECK((pricing_mode = 'fixed' AND price IS NOT NULL) OR (pricing_mode = 'negotiable' AND price IS NULL)),
	CONSTRAINT "product_versions_price_check" CHECK(price BETWEEN 0 AND 999999999),
	CONSTRAINT "product_versions_cost_check" CHECK(cost BETWEEN 0 AND 999999999),
	CONSTRAINT "product_versions_position_check" CHECK(position >= 0)
);
--> statement-breakpoint
CREATE INDEX `product_versions_product_id_idx` ON `product_versions` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_record_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_version_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`unit_cost` integer,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`sale_record_id`) REFERENCES `sale_records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_version_id`) REFERENCES `product_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "sale_items_quantity_check" CHECK(quantity BETWEEN 1 AND 9999),
	CONSTRAINT "sale_items_unit_price_check" CHECK(unit_price BETWEEN 0 AND 999999999),
	CONSTRAINT "sale_items_unit_cost_check" CHECK(unit_cost BETWEEN 0 AND 999999999),
	CONSTRAINT "sale_items_position_check" CHECK(position >= 0)
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale_record_id_idx` ON `sale_items` (`sale_record_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_version_id_idx` ON `sale_items` (`product_version_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_id_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `sale_records` (
	`id` text PRIMARY KEY NOT NULL,
	`sold_on` text NOT NULL,
	`channel` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "sale_records_sold_on_check" CHECK(length(sold_on) = 10 AND date(sold_on) IS NOT NULL AND date(sold_on) = sold_on),
	CONSTRAINT "sale_records_channel_check" CHECK(channel IS NULL OR channel IN ('fair', 'social_media', 'store_or_consignment', 'custom_order', 'other'))
);
--> statement-breakpoint
CREATE INDEX `sale_records_listing_idx` ON `sale_records` (`sold_on`,`created_at`,`id`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE TABLE `tip_views` (
	`tip_id` text PRIMARY KEY NOT NULL,
	`first_seen_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
