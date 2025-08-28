import { db } from '../db';
import { statusPagesTable, organizationsTable } from '../db/schema';
import { type CreateStatusPageInput, type StatusPage } from '../schema';
import { eq } from 'drizzle-orm';

export const createStatusPage = async (input: CreateStatusPageInput): Promise<StatusPage> => {
  try {
    // Validate organization exists and is active
    const organizations = await db.select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, input.organization_id))
      .execute();

    if (organizations.length === 0) {
      throw new Error(`Organization with ID ${input.organization_id} not found`);
    }

    const organization = organizations[0];
    if (!organization.is_active) {
      throw new Error(`Organization with ID ${input.organization_id} is not active`);
    }

    // Insert status page record
    const result = await db.insert(statusPagesTable)
      .values({
        organization_id: input.organization_id,
        name: input.name,
        description: input.description || null,
        domain: input.domain || null,
        is_public: input.is_public
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Status page creation failed:', error);
    throw error;
  }
};