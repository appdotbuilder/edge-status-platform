import { db } from '../db';
import { metricsTable, componentsTable } from '../db/schema';
import { type Metric } from '../schema';
import { eq, and, gte, lte, desc, SQL } from 'drizzle-orm';

export const getComponentMetrics = async (
    componentId: number,
    startDate?: Date,
    endDate?: Date
): Promise<Metric[]> => {
    try {
        // First verify the component exists
        const component = await db.select()
            .from(componentsTable)
            .where(eq(componentsTable.id, componentId))
            .execute();

        if (component.length === 0) {
            throw new Error(`Component with ID ${componentId} not found`);
        }

        // Build conditions array
        const conditions: SQL<unknown>[] = [];
        conditions.push(eq(metricsTable.component_id, componentId));

        if (startDate !== undefined) {
            conditions.push(gte(metricsTable.timestamp, startDate));
        }

        if (endDate !== undefined) {
            conditions.push(lte(metricsTable.timestamp, endDate));
        }

        // Build and execute query
        const results = await db.select()
            .from(metricsTable)
            .where(conditions.length === 1 ? conditions[0] : and(...conditions))
            .orderBy(desc(metricsTable.timestamp))
            .execute();

        // Return metrics with proper type conversion for response_time
        return results.map(metric => ({
            ...metric,
            // response_time is already a number in the database, no conversion needed
        }));
    } catch (error) {
        console.error('Failed to fetch component metrics:', error);
        throw error;
    }
};