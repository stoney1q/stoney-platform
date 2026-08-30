import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/guard';
import { customerSchema, CustomerFormValues } from './validation';
import { Prisma, Customer } from '@/generated/prisma/client';

export type CustomerDuplicateWarning = {
  duplicateMatches: Array<{
    name: string;
    email?: string | null;
    phone?: string | null;
  }>;
};

// Internal helper for normalizing phones/emails
function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  return phone.replace(/[^\d+]/g, '');
}

function normalizeEmail(email?: string | null) {
  if (!email) return null;
  return email.trim().toLowerCase();
}

/**
 * Creates a new customer.
 * Supports duplicate detection (returns a warning instead of creating if duplicates exist and `force` is false).
 */
export async function createCustomer(
  data: CustomerFormValues,
  force: boolean = false
): Promise<{
  success: boolean;
  data?: Customer;
  error?: string;
  warning?: CustomerDuplicateWarning;
}> {
  const session = await requirePermission('customers:create');
  const validatedData = customerSchema.parse(data);

  // Clean data for empty strings -> null
  const emailToSave = validatedData.email?.trim() || null;
  const phoneToSave = validatedData.phone?.trim() || null;
  const altPhoneToSave = validatedData.alternatePhone?.trim() || null;
  const addressToSave = validatedData.address?.trim() || null;

  // Check duplicates if not forced
  if (!force) {
    const orConditions: Prisma.CustomerWhereInput[] = [];

    const normalizedEmail = normalizeEmail(emailToSave);
    if (normalizedEmail) {
      orConditions.push({
        email: { equals: normalizedEmail, mode: 'insensitive' },
      });
    }

    const normalizedPhone = normalizePhone(phoneToSave);
    if (normalizedPhone) {
      orConditions.push({
        phone: { contains: normalizedPhone, mode: 'insensitive' },
      }); // DB might contain spaces
    }

    if (orConditions.length > 0) {
      const potentialMatches = await prisma.customer.findMany({
        where: {
          OR: orConditions,
        },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
        take: 5,
      });

      // Refine matching for phone numbers specifically in JS since DB `contains` might be loose
      const exactMatches = potentialMatches.filter((match) => {
        if (
          normalizedEmail &&
          normalizeEmail(match.email) === normalizedEmail
        )
          return true;
        if (
          normalizedPhone &&
          normalizePhone(match.phone) === normalizedPhone
        )
          return true;
        return false;
      });

      if (exactMatches.length > 0) {
        return {
          success: false,
          warning: {
            duplicateMatches: exactMatches.map((m) => ({
              name: `${m.firstName} ${m.lastName}`,
              email: m.email,
              phone: m.phone,
            })),
          },
        };
      }
    }
  }

  const customer = await prisma.customer.create({
    data: {
      firstName: validatedData.firstName.trim(),
      lastName: validatedData.lastName.trim(),
      email: emailToSave,
      phone: phoneToSave,
      alternatePhone: altPhoneToSave,
      address: addressToSave,
      isActive: validatedData.isActive,
      createdById: session.id,
    },
  });

  return { success: true, data: customer, error: undefined, warning: undefined };
}

/**
 * Updates an existing customer.
 */
export async function updateCustomer(
  id: string,
  data: CustomerFormValues
): Promise<{ success: boolean; data?: Customer; error?: string }> {
  await requirePermission('customers:update');
  const validatedData = customerSchema.parse(data);

  const emailToSave = validatedData.email?.trim() || null;
  const phoneToSave = validatedData.phone?.trim() || null;
  const altPhoneToSave = validatedData.alternatePhone?.trim() || null;
  const addressToSave = validatedData.address?.trim() || null;

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      firstName: validatedData.firstName.trim(),
      lastName: validatedData.lastName.trim(),
      email: emailToSave,
      phone: phoneToSave,
      alternatePhone: altPhoneToSave,
      address: addressToSave,
      isActive: validatedData.isActive,
    },
  });

  return { success: true, data: customer, error: undefined };
}

/**
 * Deactivates a customer (soft delete).
 */
export async function deactivateCustomer(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('customers:delete');

  await prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });

  return { success: true, error: undefined };
}

/**
 * Fetches a single customer by ID.
 */
export async function getCustomer(id: string) {
  await requirePermission('customers:read');

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return { success: true, data: customer, error: undefined };
}

/**
 * Searches customers with pagination.
 */
export async function searchCustomers({
  query = '',
  page = 1,
  limit = 20,
  activeOnly = true,
}: {
  query?: string;
  page?: number;
  limit?: number;
  activeOnly?: boolean;
}) {
  await requirePermission('customers:read');

  const skip = (page - 1) * limit;
  const searchQuery = query.trim();

  const where: Prisma.CustomerWhereInput = {};

  if (activeOnly) {
    where.isActive = true;
  }

  if (searchQuery) {
    // Check if it's a customer number query (e.g. CUS-10)
    const numberMatch = searchQuery.match(/^CUS-(\d+)$/i);
    if (numberMatch) {
      const sequenceNum = parseInt(numberMatch[1], 10);
      if (!isNaN(sequenceNum)) {
        where.sequence = sequenceNum;
      }
    } else {
      where.OR = [
        { firstName: { contains: searchQuery, mode: 'insensitive' } },
        { lastName: { contains: searchQuery, mode: 'insensitive' } },
        { email: { contains: searchQuery, mode: 'insensitive' } },
        { phone: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }
  }

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    success: true,
    error: undefined,
    data: {
      customers,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    },
  };
}
