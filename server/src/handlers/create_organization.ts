import { db } from '../db';
import { organizationsTable } from '../db/schema';
import { type CreateOrganizationInput, type Organization } from '../schema';

export const createOrganization = async (input: CreateOrganizationInput): Promise<Organization> => {
  try {
    // Insert organization record
    const result = await db.insert(organizationsTable)
      .values({
        name: input.name,
        slug: input.slug,
        subscription_tier: input.subscription_tier
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Organization creation failed:', error);
    throw error;
  }
};