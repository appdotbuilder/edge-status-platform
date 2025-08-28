import { db } from '../db';
import { statusPagesTable } from '../db/schema';
import { type StatusPage } from '../schema';
import { eq } from 'drizzle-orm';

export const getStatusPages = async (organizationId?: number): Promise<StatusPage[]> => {
  try {
    // Build query conditionally based on organization filter
    const results = organizationId !== undefined
      ? await db.select().from(statusPagesTable)
          .where(eq(statusPagesTable.organization_id, organizationId))
          .execute()
      : await db.select().from(statusPagesTable).execute();
    
    // No numeric conversions needed for status pages - all fields are already correct types
    return results;
  } catch (error) {
    console.error('Failed to get status pages:', error);
    throw error;
  }
};