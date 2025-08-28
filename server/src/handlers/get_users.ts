import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';

export const getUsers = async (): Promise<User[]> => {
  try {
    // Query all users from database
    const results = await db.select()
      .from(usersTable)
      .execute();

    // Return users (password_hash is already included in User type from schema)
    return results;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
};