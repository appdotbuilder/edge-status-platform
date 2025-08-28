import { db } from '../db';
import { metricsTable, componentsTable } from '../db/schema';
import { type CreateMetricInput, type Metric } from '../schema';
import { eq } from 'drizzle-orm';

export const createMetric = async (input: CreateMetricInput): Promise<Metric> => {
  try {
    // Validate component exists
    const component = await db.select()
      .from(componentsTable)
      .where(eq(componentsTable.id, input.component_id))
      .execute();

    if (component.length === 0) {
      throw new Error(`Component with id ${input.component_id} not found`);
    }

    // Insert metric record
    const result = await db.insert(metricsTable)
      .values({
        component_id: input.component_id,
        timestamp: input.timestamp,
        status: input.status,
        response_time: input.response_time || null
      })
      .returning()
      .execute();

    const metric = result[0];
    return metric;
  } catch (error) {
    console.error('Metric creation failed:', error);
    throw error;
  }
};