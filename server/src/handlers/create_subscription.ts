import { db } from '../db';
import { subscriptionsTable, statusPagesTable } from '../db/schema';
import { type CreateSubscriptionInput, type Subscription } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createSubscription = async (input: CreateSubscriptionInput): Promise<Subscription> => {
  try {
    // Validate that the status page exists and is public
    const statusPage = await db.select()
      .from(statusPagesTable)
      .where(eq(statusPagesTable.id, input.status_page_id))
      .execute();

    if (statusPage.length === 0) {
      throw new Error('Status page not found');
    }

    if (!statusPage[0].is_public) {
      throw new Error('Status page does not allow public subscriptions');
    }

    // Check if subscription already exists for this email/status page combination
    const existingSubscription = await db.select()
      .from(subscriptionsTable)
      .where(and(
        eq(subscriptionsTable.email, input.email),
        eq(subscriptionsTable.status_page_id, input.status_page_id)
      ))
      .execute();

    if (existingSubscription.length > 0) {
      throw new Error('Subscription already exists for this email and status page');
    }

    // Insert new subscription
    const result = await db.insert(subscriptionsTable)
      .values({
        status_page_id: input.status_page_id,
        email: input.email,
        subscribed_to_incidents: input.subscribed_to_incidents,
        subscribed_to_maintenance: input.subscribed_to_maintenance,
        is_active: true,
        user_id: null // Anonymous subscription
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Subscription creation failed:', error);
    throw error;
  }
};