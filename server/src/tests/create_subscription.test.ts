import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { subscriptionsTable, statusPagesTable, organizationsTable } from '../db/schema';
import { type CreateSubscriptionInput } from '../schema';
import { createSubscription } from '../handlers/create_subscription';
import { eq, and } from 'drizzle-orm';

describe('createSubscription', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testStatusPageId: number;

  beforeEach(async () => {
    // Create a test organization first
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    // Create a test status page
    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Test Status Page',
        description: 'A status page for testing',
        is_public: true
      })
      .returning()
      .execute();

    testStatusPageId = statusPageResult[0].id;
  });

  const testInput: CreateSubscriptionInput = {
    status_page_id: 0, // Will be set in tests
    email: 'test@example.com',
    subscribed_to_incidents: true,
    subscribed_to_maintenance: true
  };

  it('should create a subscription successfully', async () => {
    const input = { ...testInput, status_page_id: testStatusPageId };
    const result = await createSubscription(input);

    // Validate returned subscription
    expect(result.id).toBeDefined();
    expect(result.status_page_id).toEqual(testStatusPageId);
    expect(result.email).toEqual('test@example.com');
    expect(result.user_id).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.subscribed_to_incidents).toBe(true);
    expect(result.subscribed_to_maintenance).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save subscription to database', async () => {
    const input = { ...testInput, status_page_id: testStatusPageId };
    const result = await createSubscription(input);

    // Query the database to verify subscription was saved
    const subscriptions = await db.select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, result.id))
      .execute();

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].email).toEqual('test@example.com');
    expect(subscriptions[0].status_page_id).toEqual(testStatusPageId);
    expect(subscriptions[0].is_active).toBe(true);
    expect(subscriptions[0].user_id).toBeNull();
    expect(subscriptions[0].created_at).toBeInstanceOf(Date);
  });

  it('should create subscription with default values', async () => {
    const minimalInput: CreateSubscriptionInput = {
      status_page_id: testStatusPageId,
      email: 'minimal@example.com',
      subscribed_to_incidents: true, // Zod default
      subscribed_to_maintenance: true  // Zod default
    };
    const result = await createSubscription(minimalInput);

    // Verify Zod defaults were applied
    expect(result.subscribed_to_incidents).toBe(true);
    expect(result.subscribed_to_maintenance).toBe(true);
    expect(result.is_active).toBe(true);
    expect(result.user_id).toBeNull();
  });

  it('should create subscription with custom preferences', async () => {
    const customInput: CreateSubscriptionInput = {
      status_page_id: testStatusPageId,
      email: 'custom@example.com',
      subscribed_to_incidents: false,
      subscribed_to_maintenance: true
    };
    const result = await createSubscription(customInput);

    expect(result.subscribed_to_incidents).toBe(false);
    expect(result.subscribed_to_maintenance).toBe(true);
  });

  it('should throw error when status page does not exist', async () => {
    const input = { ...testInput, status_page_id: 99999 };

    await expect(createSubscription(input)).rejects.toThrow(/status page not found/i);
  });

  it('should throw error when status page is not public', async () => {
    // Create a private status page
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Private Org',
        slug: 'private-org',
        subscription_tier: 'pro'
      })
      .returning()
      .execute();

    const privateStatusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Private Status Page',
        is_public: false
      })
      .returning()
      .execute();

    const input = { ...testInput, status_page_id: privateStatusPageResult[0].id };

    await expect(createSubscription(input)).rejects.toThrow(/does not allow public subscriptions/i);
  });

  it('should throw error when subscription already exists', async () => {
    const input = { ...testInput, status_page_id: testStatusPageId };

    // Create first subscription
    await createSubscription(input);

    // Try to create duplicate subscription
    await expect(createSubscription(input)).rejects.toThrow(/subscription already exists/i);
  });

  it('should allow same email for different status pages', async () => {
    // Create second status page
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Second Org',
        slug: 'second-org',
        subscription_tier: 'starter'
      })
      .returning()
      .execute();

    const secondStatusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Second Status Page',
        is_public: true
      })
      .returning()
      .execute();

    // Create subscription for first status page
    const firstInput = { ...testInput, status_page_id: testStatusPageId };
    const firstResult = await createSubscription(firstInput);

    // Create subscription for second status page with same email
    const secondInput = { ...testInput, status_page_id: secondStatusPageResult[0].id };
    const secondResult = await createSubscription(secondInput);

    expect(firstResult.email).toEqual(secondResult.email);
    expect(firstResult.status_page_id).not.toEqual(secondResult.status_page_id);
    expect(firstResult.id).not.toEqual(secondResult.id);

    // Verify both subscriptions exist in database
    const allSubscriptions = await db.select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.email, testInput.email))
      .execute();

    expect(allSubscriptions).toHaveLength(2);
  });

  it('should handle different email addresses for same status page', async () => {
    const firstInput = { ...testInput, status_page_id: testStatusPageId, email: 'first@example.com' };
    const secondInput = { ...testInput, status_page_id: testStatusPageId, email: 'second@example.com' };

    const firstResult = await createSubscription(firstInput);
    const secondResult = await createSubscription(secondInput);

    expect(firstResult.status_page_id).toEqual(secondResult.status_page_id);
    expect(firstResult.email).not.toEqual(secondResult.email);
    expect(firstResult.id).not.toEqual(secondResult.id);

    // Verify both subscriptions exist
    const subscriptions = await db.select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status_page_id, testStatusPageId))
      .execute();

    expect(subscriptions).toHaveLength(2);
  });
});