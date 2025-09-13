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
