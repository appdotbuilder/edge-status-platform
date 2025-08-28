import { type User } from '../schema';

export const getUsers = async (): Promise<User[]> => {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching all users from the database with proper authorization.
    // TODO: Implement authorization check (admin only)
    // TODO: Query users from database
    // TODO: Exclude password hash from response
    return [];
};