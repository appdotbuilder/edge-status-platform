import { db } from '../db';
import { componentsTable } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { type Component } from '../schema';

export const getComponents = async (statusPageId: number): Promise<Component[]> => {
  try {
    // Query components from database ordered by sort_order, then by name
    const results = await db.select()
      .from(componentsTable)
      .where(eq(componentsTable.status_page_id, statusPageId))
      .orderBy(asc(componentsTable.sort_order), asc(componentsTable.name))
      .execute();

    return results;
  } catch (error) {
    console.error('Get components failed:', error);
    throw error;
  }
};