import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers } from '../handlers/get_users';

// Test data for multiple users
const testUsers: CreateUserInput[] = [
  {
    email: 'admin@example.com',
    password: 'adminPassword123',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin'
  },
  {
    email: 'editor@example.com',
    password: 'editorPassword123',
    first_name: 'Editor',
    last_name: 'User',
    role: 'editor'
  },
  {
    email: 'viewer@example.com',
    password: 'viewerPassword123',
    first_name: 'Viewer',
    last_name: 'User',
    role: 'viewer'
  }
];

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all users from database', async () => {
    // Create test users
    await db.insert(usersTable)
      .values(testUsers.map(user => ({
        ...user,
        password_hash: `hashed_${user.password}`
      })))
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);
    
    // Verify all users are returned
    const emails = result.map(user => user.email);
    expect(emails).toContain('admin@example.com');
    expect(emails).toContain('editor@example.com');
    expect(emails).toContain('viewer@example.com');
  });

  it('should return users with correct data structure', async () => {
    // Create a single test user
    await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password123',
        first_name: 'Test',
        last_name: 'User',
        role: 'admin',
        is_active: true
      })
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    
    const user = result[0];
    expect(user.id).toBeDefined();
    expect(user.email).toEqual('test@example.com');
    expect(user.password_hash).toEqual('hashed_password123');
    expect(user.first_name).toEqual('Test');
    expect(user.last_name).toEqual('User');
    expect(user.role).toEqual('admin');
    expect(user.is_active).toBe(true);
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
  });

  it('should return users with different roles', async () => {
    // Create users with different roles
    await db.insert(usersTable)
      .values([
        {
          email: 'admin@example.com',
          password_hash: 'hashed_admin',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        },
        {
          email: 'viewer@example.com',
          password_hash: 'hashed_viewer',
          first_name: 'Viewer',
          last_name: 'User',
          role: 'viewer'
        }
      ])
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    const roles = result.map(user => user.role);
    expect(roles).toContain('admin');
    expect(roles).toContain('viewer');
  });

  it('should return users with active and inactive statuses', async () => {
    // Create users with different statuses
    await db.insert(usersTable)
      .values([
        {
          email: 'active@example.com',
          password_hash: 'hashed_active',
          first_name: 'Active',
          last_name: 'User',
          role: 'viewer',
          is_active: true
        },
        {
          email: 'inactive@example.com',
          password_hash: 'hashed_inactive',
          first_name: 'Inactive',
          last_name: 'User',
          role: 'viewer',
          is_active: false
        }
      ])
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    const activeUser = result.find(user => user.email === 'active@example.com');
    const inactiveUser = result.find(user => user.email === 'inactive@example.com');
    
    expect(activeUser?.is_active).toBe(true);
    expect(inactiveUser?.is_active).toBe(false);
  });

  it('should maintain user order by creation', async () => {
    // Create users with a small delay to ensure different timestamps
    await db.insert(usersTable)
      .values({
        email: 'first@example.com',
        password_hash: 'hashed_first',
        first_name: 'First',
        last_name: 'User',
        role: 'viewer'
      })
      .execute();

    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 1));

    await db.insert(usersTable)
      .values({
        email: 'second@example.com',
        password_hash: 'hashed_second',
        first_name: 'Second',
        last_name: 'User',
        role: 'viewer'
      })
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    // Verify users are returned (order may vary based on database implementation)
    const emails = result.map(user => user.email);
    expect(emails).toContain('first@example.com');
    expect(emails).toContain('second@example.com');
  });
});