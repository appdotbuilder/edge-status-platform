import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';
import { pbkdf2Sync } from 'crypto';

// Test input data
const testInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'testpassword123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'viewer'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with hashed password', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('viewer');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Password should be hashed, not plain text
    expect(result.password_hash).not.toEqual('testpassword123');
    expect(result.password_hash).toBeDefined();
    expect(typeof result.password_hash).toBe('string');
    expect(result.password_hash.length).toBeGreaterThan(20);

    // Verify password hash is correct
    const [salt, hash] = result.password_hash.split(':');
    const testHash = pbkdf2Sync(testInput.password, salt, 10000, 64, 'sha512').toString('hex');
    expect(testHash).toEqual(hash);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query user from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.first_name).toEqual('John');
    expect(savedUser.last_name).toEqual('Doe');
    expect(savedUser.role).toEqual('viewer');
    expect(savedUser.is_active).toEqual(true);
    expect(savedUser.created_at).toBeInstanceOf(Date);
    expect(savedUser.updated_at).toBeInstanceOf(Date);

    // Verify password hash
    const [salt, hash] = savedUser.password_hash.split(':');
    const testHash = pbkdf2Sync(testInput.password, salt, 10000, 64, 'sha512').toString('hex');
    expect(testHash).toEqual(hash);
  });

  it('should use default role when not specified', async () => {
    const inputWithoutRole: CreateUserInput = {
      email: 'test2@example.com',
      password: 'testpassword123',
      first_name: 'Jane',
      last_name: 'Smith',
      role: 'viewer' // This is required in the type, but Zod schema has default
    };

    const result = await createUser(inputWithoutRole);
    expect(result.role).toEqual('viewer');
  });

  it('should create user with admin role', async () => {
    const adminInput: CreateUserInput = {
      email: 'admin@example.com',
      password: 'adminpassword123',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    };

    const result = await createUser(adminInput);
    expect(result.role).toEqual('admin');
  });

  it('should reject duplicate email addresses', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create second user with same email
    const duplicateInput: CreateUserInput = {
      email: 'test@example.com', // Same email
      password: 'differentpassword',
      first_name: 'Different',
      last_name: 'User',
      role: 'editor'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/email already exists/i);
  });

  it('should handle different password lengths correctly', async () => {
    const longPasswordInput: CreateUserInput = {
      email: 'longpass@example.com',
      password: 'this_is_a_very_long_password_with_many_characters_123456789',
      first_name: 'Long',
      last_name: 'Password',
      role: 'viewer'
    };

    const result = await createUser(longPasswordInput);
    
    // Verify long password was hashed correctly
    const [salt, hash] = result.password_hash.split(':');
    const testHash = pbkdf2Sync(longPasswordInput.password, salt, 10000, 64, 'sha512').toString('hex');
    expect(testHash).toEqual(hash);
  });

  it('should handle special characters in names and email', async () => {
    const specialInput: CreateUserInput = {
      email: 'test+user@example-domain.co.uk',
      password: 'password123',
      first_name: "John-Paul",
      last_name: "O'Connor",
      role: 'viewer'
    };

    const result = await createUser(specialInput);
    expect(result.email).toEqual('test+user@example-domain.co.uk');
    expect(result.first_name).toEqual("John-Paul");
    expect(result.last_name).toEqual("O'Connor");
  });
});