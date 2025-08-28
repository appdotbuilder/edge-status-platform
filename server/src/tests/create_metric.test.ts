import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { metricsTable, organizationsTable, statusPagesTable, componentsTable } from '../db/schema';
import { type CreateMetricInput } from '../schema';
import { createMetric } from '../handlers/create_metric';
import { eq } from 'drizzle-orm';

// Test setup data
const testOrg = {
  name: 'Test Organization',
  slug: 'test-org',
  subscription_tier: 'free' as const
};

const testStatusPage = {
  organization_id: 1,
  name: 'Test Status Page',
  description: 'A status page for testing',
  is_public: true
};

const testComponent = {
  status_page_id: 1,
  name: 'Test Component',
  description: 'A component for testing',
  status: 'operational' as const,
  sort_order: 0,
  is_visible: true
};

const testMetricInput: CreateMetricInput = {
  component_id: 1,
  timestamp: new Date('2024-01-01T12:00:00Z'),
  status: 'operational',
  response_time: 150
};

const testMetricInputWithoutResponseTime: CreateMetricInput = {
  component_id: 1,
  timestamp: new Date('2024-01-01T12:00:00Z'),
  status: 'major_outage'
};

describe('createMetric', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  beforeEach(async () => {
    // Create prerequisite data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const statusPageResult = await db.insert(statusPagesTable)
      .values({ ...testStatusPage, organization_id: orgResult[0].id })
      .returning()
      .execute();

    await db.insert(componentsTable)
      .values({ ...testComponent, status_page_id: statusPageResult[0].id })
      .returning()
      .execute();
  });

  it('should create a metric with response time', async () => {
    const result = await createMetric(testMetricInput);

    // Basic field validation
    expect(result.component_id).toEqual(1);
    expect(result.timestamp).toEqual(new Date('2024-01-01T12:00:00Z'));
    expect(result.status).toEqual('operational');
    expect(result.response_time).toEqual(150);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a metric without response time', async () => {
    const result = await createMetric(testMetricInputWithoutResponseTime);

    // Basic field validation
    expect(result.component_id).toEqual(1);
    expect(result.timestamp).toEqual(new Date('2024-01-01T12:00:00Z'));
    expect(result.status).toEqual('major_outage');
    expect(result.response_time).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save metric to database', async () => {
    const result = await createMetric(testMetricInput);

    // Query database to verify record exists
    const metrics = await db.select()
      .from(metricsTable)
      .where(eq(metricsTable.id, result.id))
      .execute();

    expect(metrics).toHaveLength(1);
    expect(metrics[0].component_id).toEqual(1);
    expect(metrics[0].timestamp).toEqual(new Date('2024-01-01T12:00:00Z'));
    expect(metrics[0].status).toEqual('operational');
    expect(metrics[0].response_time).toEqual(150);
    expect(metrics[0].created_at).toBeInstanceOf(Date);
  });

  it('should create multiple metrics for the same component', async () => {
    const firstMetric = await createMetric(testMetricInput);
    
    const secondMetricInput = {
      ...testMetricInput,
      timestamp: new Date('2024-01-01T12:05:00Z'),
      status: 'degraded_performance' as const,
      response_time: 300
    };
    const secondMetric = await createMetric(secondMetricInput);

    // Verify both metrics exist
    const metrics = await db.select()
      .from(metricsTable)
      .where(eq(metricsTable.component_id, 1))
      .execute();

    expect(metrics).toHaveLength(2);
    expect(metrics.map(m => m.id).sort()).toEqual([firstMetric.id, secondMetric.id].sort());
  });

  it('should throw error when component does not exist', async () => {
    const invalidInput = {
      ...testMetricInput,
      component_id: 999
    };

    await expect(createMetric(invalidInput)).rejects.toThrow(/Component with id 999 not found/i);
  });

  it('should handle different status types', async () => {
    const statuses = ['operational', 'degraded_performance', 'partial_outage', 'major_outage', 'under_maintenance'] as const;
    const results = [];

    for (let i = 0; i < statuses.length; i++) {
      const input = {
        component_id: 1,
        timestamp: new Date(`2024-01-01T12:0${i}:00Z`),
        status: statuses[i],
        response_time: 100 + i * 50
      };
      
      const result = await createMetric(input);
      results.push(result);
      
      expect(result.status).toEqual(statuses[i]);
      expect(result.response_time).toEqual(100 + i * 50);
    }

    // Verify all metrics were created
    const allMetrics = await db.select()
      .from(metricsTable)
      .where(eq(metricsTable.component_id, 1))
      .execute();

    expect(allMetrics).toHaveLength(statuses.length);
  });

  it('should handle null response time correctly', async () => {
    const inputWithNullResponseTime = {
      component_id: 1,
      timestamp: new Date('2024-01-01T12:00:00Z'),
      status: 'major_outage' as const,
      response_time: null
    };

    const result = await createMetric(inputWithNullResponseTime);

    expect(result.response_time).toBeNull();
    
    // Verify in database
    const metric = await db.select()
      .from(metricsTable)
      .where(eq(metricsTable.id, result.id))
      .execute();

    expect(metric[0].response_time).toBeNull();
  });
});