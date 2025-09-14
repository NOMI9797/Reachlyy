import { pgTable, text, timestamp, integer, boolean, json, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';


// Campaigns table
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Leads table
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  name: text('name'),
  title: text('title'),
  company: text('company'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  profilePicture: text('profile_picture'),
  posts: json('posts'), // Store scraped posts as JSON array
  addedAt: timestamp('added_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Posts table - for detailed post storage
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
  shares: integer('shares').default(0),
  engagement: integer('engagement').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages table - for storing generated messages
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  model: varchar('model', { length: 50 }).notNull().default('llama-3.1-8b-instant'),
  customPrompt: text('custom_prompt'),
  postsAnalyzed: integer('posts_analyzed').default(3),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, sent, scheduled
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});



// Database initialization function
export async function initializeDatabase() {
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { db } = await import('./db');
  
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}
