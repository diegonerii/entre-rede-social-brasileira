import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), handle: text("handle").notNull().unique(), name: text("name").notNull(), bio: text("bio").notNull().default(""),
  avatar: text("avatar").notNull().default(""), cover: text("cover").notNull().default(""), location: text("location").notNull().default(""), interests: text("interests").notNull().default(""), createdAt: integer("created_at").notNull(),
});
export const communities = sqliteTable("communities", {
  id: text("id").primaryKey(), name: text("name").notNull(), description: text("description").notNull(), category: text("category").notNull(),
  cover: text("cover").notNull().default(""), color: text("color").notNull().default("#ded8c8"), ownerId: text("owner_id").references(() => users.id), createdAt: integer("created_at").notNull(),
});
export const memberships = sqliteTable("memberships", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), communityId: text("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.userId, t.communityId] })]);
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), communityId: text("community_id").references(() => communities.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), title: text("title").notNull().default(""), body: text("body").notNull(), media: text("media").notNull().default(""), tags: text("tags").notNull().default(""), createdAt: integer("created_at").notNull(),
}, t => [index("posts_time_idx").on(t.createdAt), index("posts_user_idx").on(t.userId), index("posts_community_idx").on(t.communityId)]);
export const reactions = sqliteTable("reactions", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }), value: integer("value").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.postId] })]);
export const reposts = sqliteTable("reposts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }), createdAt: integer("created_at").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.postId] })]);
export const bookmarks = sqliteTable("bookmarks", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.userId, t.postId] })]);
export const follows = sqliteTable("follows", {
  followerId: text("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }), followingId: text("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.followerId, t.followingId] })]);
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }), body: text("body").notNull(), createdAt: integer("created_at").notNull(),
}, t => [index("comments_post_idx").on(t.postId)]);
export const testimonials = sqliteTable("testimonials", {
  id: text("id").primaryKey(), fromId: text("from_id").notNull().references(() => users.id, { onDelete: "cascade" }), toId: text("to_id").notNull().references(() => users.id, { onDelete: "cascade" }), body: text("body").notNull(), status: text("status").notNull().default("pending"), createdAt: integer("created_at").notNull(),
}, t => [index("testimonials_recipient_idx").on(t.toId)]);
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(), fromId: text("from_id").notNull().references(() => users.id, { onDelete: "cascade" }), toId: text("to_id").notNull().references(() => users.id, { onDelete: "cascade" }), body: text("body").notNull(), read: integer("read").notNull().default(0), createdAt: integer("created_at").notNull(),
}, t => [index("messages_recipient_idx").on(t.toId, t.createdAt), index("messages_sender_idx").on(t.fromId, t.createdAt)]);
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), actorId: text("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }), kind: text("kind").notNull(), targetId: text("target_id").notNull(), read: integer("read").notNull().default(0), createdAt: integer("created_at").notNull(),
}, t => [index("notifications_recipient_idx").on(t.userId, t.createdAt)]);
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }), reason: text("reason").notNull(), createdAt: integer("created_at").notNull(),
}, t => [uniqueIndex("reports_once_idx").on(t.userId, t.postId)]);
export const blocks = sqliteTable("blocks", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), blockedId: text("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.userId, t.blockedId] })]);
