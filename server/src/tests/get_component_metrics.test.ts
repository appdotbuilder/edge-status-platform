import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable, statusPagesTable, componentsTable, metricsTable } from '../db/schema';
import { type CreateOrganizationInput, type CreateStatusPageInput, type CreateComponentInput, type CreateMetricInput } from '../schema';
import { getComponentMetrics } from '../handlers/get_component_metrics';

// Test data setup
const testOrganization: CreateOrganizationInput = {
    name: 'Test Org',
    slug: 'test-org',
    subscription_tier: 'free'
};

const testStatusPage: CreateStatusPageInput = {
    organization_id: 1, // Will be set after organization creation
    name: 'Test Status Page',
    description: 'A status page for testing',
    is_public: true
};

const testComponent: CreateComponentInput = {
    status_page_id: 1, // Will be set after status page creation
    name: 'Test Component',
    description: 'A component for testing',
    status: 'operational',
    sort_order: 0,
    is_visible: true
};

const createTestMetric = (componentId: number, timestamp: Date, status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'under_maintenance' = 'operational', responseTime?: number): CreateMetricInput => ({
    component_id: componentId,
    timestamp,
    status,
    response_time: responseTime
});

describe('getComponentMetrics', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    let organizationId: number;
    let statusPageId: number;
    let componentId: number;

    beforeEach(async () => {
        // Create test organization
        const orgResult = await db.insert(organizationsTable)
            .values(testOrganization)
            .returning()
            .execute();
        organizationId = orgResult[0].id;

        // Create test status page
        const statusPageResult = await db.insert(statusPagesTable)
            .values({
                ...testStatusPage,
                organization_id: organizationId
            })
            .returning()
            .execute();
        statusPageId = statusPageResult[0].id;

        // Create test component
        const componentResult = await db.insert(componentsTable)
            .values({
                ...testComponent,
                status_page_id: statusPageId
            })
            .returning()
            .execute();
        componentId = componentResult[0].id;
    });

    it('should fetch metrics for a component', async () => {
        const now = new Date();
        const metric1 = createTestMetric(componentId, now, 'operational', 150);
        const metric2 = createTestMetric(componentId, new Date(now.getTime() - 60000), 'degraded_performance', 300);

        // Insert test metrics
        await db.insert(metricsTable)
            .values([metric1, metric2])
            .execute();

        const result = await getComponentMetrics(componentId);

        expect(result).toHaveLength(2);
        // Should be ordered by timestamp descending (newest first)
        expect(result[0].status).toEqual('operational');
        expect(result[0].response_time).toEqual(150);
        expect(result[0].timestamp).toBeInstanceOf(Date);
        expect(result[1].status).toEqual('degraded_performance');
        expect(result[1].response_time).toEqual(300);
    });

    it('should filter metrics by start date', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 3600000);
        const twoHoursAgo = new Date(now.getTime() - 7200000);

        const metric1 = createTestMetric(componentId, now);
        const metric2 = createTestMetric(componentId, oneHourAgo);
        const metric3 = createTestMetric(componentId, twoHoursAgo);

        await db.insert(metricsTable)
            .values([metric1, metric2, metric3])
            .execute();

        // Filter to only get metrics from the last hour
        const result = await getComponentMetrics(componentId, oneHourAgo);

        expect(result).toHaveLength(2);
        // Verify all returned metrics are after the start date
        result.forEach(metric => {
            expect(metric.timestamp.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        });
    });

    it('should filter metrics by end date', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 3600000);
        const twoHoursAgo = new Date(now.getTime() - 7200000);

        const metric1 = createTestMetric(componentId, now);
        const metric2 = createTestMetric(componentId, oneHourAgo);
        const metric3 = createTestMetric(componentId, twoHoursAgo);

        await db.insert(metricsTable)
            .values([metric1, metric2, metric3])
            .execute();

        // Filter to only get metrics up to one hour ago
        const result = await getComponentMetrics(componentId, undefined, oneHourAgo);

        expect(result).toHaveLength(2);
        // Verify all returned metrics are before or at the end date
        result.forEach(metric => {
            expect(metric.timestamp.getTime()).toBeLessThanOrEqual(oneHourAgo.getTime());
        });
    });

    it('should filter metrics by date range', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 3600000);
        const twoHoursAgo = new Date(now.getTime() - 7200000);
        const threeHoursAgo = new Date(now.getTime() - 10800000);

        const metric1 = createTestMetric(componentId, now);
        const metric2 = createTestMetric(componentId, oneHourAgo);
        const metric3 = createTestMetric(componentId, twoHoursAgo);
        const metric4 = createTestMetric(componentId, threeHoursAgo);

        await db.insert(metricsTable)
            .values([metric1, metric2, metric3, metric4])
            .execute();

        // Filter to get metrics between 2 and 1 hours ago
        const result = await getComponentMetrics(componentId, twoHoursAgo, oneHourAgo);

        expect(result).toHaveLength(2);
        result.forEach(metric => {
            expect(metric.timestamp.getTime()).toBeGreaterThanOrEqual(twoHoursAgo.getTime());
            expect(metric.timestamp.getTime()).toBeLessThanOrEqual(oneHourAgo.getTime());
        });
    });

    it('should return empty array when no metrics exist', async () => {
        const result = await getComponentMetrics(componentId);

        expect(result).toHaveLength(0);
        expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no metrics match date filter', async () => {
        const now = new Date();
        const metric = createTestMetric(componentId, now);

        await db.insert(metricsTable)
            .values(metric)
            .execute();

        // Filter for metrics from yesterday
        const yesterday = new Date(now.getTime() - 86400000);
        const result = await getComponentMetrics(componentId, yesterday, yesterday);

        expect(result).toHaveLength(0);
    });

    it('should handle metrics without response_time', async () => {
        const now = new Date();
        const metric = createTestMetric(componentId, now, 'operational');

        await db.insert(metricsTable)
            .values(metric)
            .execute();

        const result = await getComponentMetrics(componentId);

        expect(result).toHaveLength(1);
        expect(result[0].response_time).toBeNull();
        expect(result[0].status).toEqual('operational');
    });

    it('should order metrics by timestamp descending', async () => {
        const now = new Date();
        const times = [
            now,
            new Date(now.getTime() - 60000), // 1 minute ago
            new Date(now.getTime() - 120000), // 2 minutes ago
            new Date(now.getTime() - 180000), // 3 minutes ago
        ];

        const metrics = times.map((time, index) => 
            createTestMetric(componentId, time, 'operational', 100 + index)
        );

        await db.insert(metricsTable)
            .values(metrics)
            .execute();

        const result = await getComponentMetrics(componentId);

        expect(result).toHaveLength(4);
        // Should be in descending order (newest first)
        for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].timestamp.getTime()).toBeGreaterThan(result[i + 1].timestamp.getTime());
        }
    });

    it('should throw error when component does not exist', async () => {
        const nonExistentComponentId = 99999;

        await expect(getComponentMetrics(nonExistentComponentId))
            .rejects
            .toThrow(/Component with ID 99999 not found/i);
    });

    it('should only return metrics for the specified component', async () => {
        // Create a second component
        const component2Result = await db.insert(componentsTable)
            .values({
                ...testComponent,
                status_page_id: statusPageId,
                name: 'Test Component 2'
            })
            .returning()
            .execute();
        const component2Id = component2Result[0].id;

        const now = new Date();
        const metric1 = createTestMetric(componentId, now, 'operational', 100);
        const metric2 = createTestMetric(component2Id, now, 'degraded_performance', 200);

        await db.insert(metricsTable)
            .values([metric1, metric2])
            .execute();

        const result = await getComponentMetrics(componentId);

        expect(result).toHaveLength(1);
        expect(result[0].component_id).toEqual(componentId);
        expect(result[0].response_time).toEqual(100);
        expect(result[0].status).toEqual('operational');
    });

    it('should handle various component statuses correctly', async () => {
        const now = new Date();
        const statuses = ['operational', 'degraded_performance', 'partial_outage', 'major_outage', 'under_maintenance'] as const;
        
        const metrics = statuses.map((status, index) =>
            createTestMetric(componentId, new Date(now.getTime() - index * 60000), status, 100 + index * 50)
        );

        await db.insert(metricsTable)
            .values(metrics)
            .execute();

        const result = await getComponentMetrics(componentId);

        expect(result).toHaveLength(5);
        statuses.forEach((status, index) => {
            const metric = result.find(m => m.status === status);
            expect(metric).toBeDefined();
            expect(metric!.response_time).toEqual(100 + index * 50);
        });
    });
});