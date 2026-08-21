import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';

// Fail immediately if DATABASE_URL is missing — never fall back to an implicit connection.
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  console.error('Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Prisma 7 requires a driver adapter for SQL providers.
// PrismaNeon(config: neon.PoolConfig) creates and manages the WebSocket pool internally.
// Appropriate for Node.js server-side scripts connecting to Neon PostgreSQL.
const adapter = new PrismaNeon({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

// ==========================================
// 1. FOUNDATIONAL BRANCH
// ==========================================
const FOUNDATIONAL_BRANCH = {
  name: 'Head Office',
  code: 'HQ',
  address: 'Primary Headquarters',
  isActive: true,
};

// ==========================================
// 2. FOUNDATIONAL ROLES
// ==========================================
interface RoleDefinition {
  name: string;
  description: string;
}

const FOUNDATIONAL_ROLES: RoleDefinition[] = [
  {
    name: 'Super Admin',
    description:
      'Full platform and system access with all administrative privileges',
  },
  {
    name: 'Admin',
    description:
      'System administrator with broad operational and management privileges',
  },
  {
    name: 'Manager',
    description:
      'Branch and operations manager overseeing daily business workflows',
  },
  {
    name: 'Technician',
    description:
      'Service and repair specialist managing technical repair jobs and diagnostics',
  },
  {
    name: 'Sales',
    description:
      'Sales representative handling quotations, customer accounts, and sales transactions',
  },
  {
    name: 'Cashier',
    description:
      'Front-desk point-of-sale operator processing payments and register transactions',
  },
  {
    name: 'Inventory Officer',
    description:
      'Stock and warehouse specialist managing inventory levels, movements, and suppliers',
  },
];

// ==========================================
// 3. FOUNDATIONAL PERMISSIONS (resource:action)
// Convention: <resource>:<action>
// Resources map to platform domains; actions are: read, create, update, delete, + domain-specifics.
// ==========================================
interface PermissionDefinition {
  name: string;
  description: string;
}

const FOUNDATIONAL_PERMISSIONS: PermissionDefinition[] = [
  // Dashboard
  {
    name: 'dashboard:read',
    description: 'View dashboard metrics, analytics, and summary statistics',
  },

  // Users
  {
    name: 'users:read',
    description: 'View user accounts, profiles, and assignment details',
  },
  { name: 'users:create', description: 'Create and invite new user accounts' },
  {
    name: 'users:update',
    description: 'Update existing user accounts, roles, and branch assignments',
  },
  { name: 'users:delete', description: 'Deactivate or delete user accounts' },

  // Roles
  {
    name: 'roles:read',
    description: 'View role catalog and assigned permissions',
  },
  { name: 'roles:create', description: 'Create new custom roles' },
  {
    name: 'roles:update',
    description: 'Modify role details and permission mappings',
  },
  { name: 'roles:delete', description: 'Delete custom roles' },

  // Permissions
  { name: 'permissions:read', description: 'View system permissions registry' },

  // Branches
  {
    name: 'branches:read',
    description: 'View branch directory and branch details',
  },
  { name: 'branches:create', description: 'Create new company branches' },
  {
    name: 'branches:update',
    description: 'Update branch information and operational status',
  },
  { name: 'branches:delete', description: 'Deactivate or delete branches' },

  // Products
  {
    name: 'products:read',
    description: 'View product catalog, pricing, and category classifications',
  },
  {
    name: 'products:create',
    description: 'Create new products and catalog items',
  },
  {
    name: 'products:update',
    description: 'Update product specifications, prices, and status',
  },
  {
    name: 'products:delete',
    description: 'Archive or delete catalog products',
  },

  {
    name: 'inventory:read',
    description:
      'View stock levels, warehouse allocations, and movement history',
  },
  {
    name: 'inventory:write',
    description: 'Create and adjust inventory records and perform receipts',
  },
  {
    name: 'transfers:read',
    description: 'View inter-branch transfer requests and history',
  },
  {
    name: 'transfers:write',
    description: 'Create, dispatch, receive, and cancel branch transfers',
  },

  // Customers
  {
    name: 'customers:read',
    description: 'View customer accounts, profiles, and transaction history',
  },
  {
    name: 'customers:create',
    description: 'Register and onboard new customers',
  },
  {
    name: 'customers:update',
    description: 'Update customer contact information and account terms',
  },
  {
    name: 'customers:delete',
    description: 'Archive or delete customer records',
  },

  // Suppliers
  {
    name: 'suppliers:read',
    description: 'View supplier directory, contracts, and vendor records',
  },
  { name: 'suppliers:create', description: 'Create new supplier profiles' },
  {
    name: 'suppliers:update',
    description: 'Update supplier details, contact persons, and terms',
  },
  {
    name: 'suppliers:delete',
    description: 'Archive or delete supplier profiles',
  },

  // Repairs
  {
    name: 'repairs:read',
    description: 'View repair tickets, diagnosis notes, and progress logs',
  },
  {
    name: 'repairs:create',
    description: 'Log new repair tickets and intake devices',
  },
  {
    name: 'repairs:update',
    description: 'Update repair status, parts used, and technical notes',
  },
  { name: 'repairs:delete', description: 'Cancel or delete repair tickets' },
  { name: 'repairs:assign', description: 'Assign repair jobs to technicians' },

  // Sales
  {
    name: 'sales:read',
    description: 'View sales orders, transactions, receipts, and invoices',
  },
  {
    name: 'sales:create',
    description: 'Process point-of-sale and direct sales transactions',
  },
  {
    name: 'sales:update',
    description: 'Update sales orders, notes, and fulfillment details',
  },
  {
    name: 'sales:void',
    description: 'Void or refund completed sales transactions',
  },

  // Quotations
  {
    name: 'quotations:read',
    description: 'View price estimates and customer quotations',
  },
  {
    name: 'quotations:create',
    description: 'Draft and generate new quotations',
  },
  {
    name: 'quotations:update',
    description: 'Edit quotation line items, discounts, and terms',
  },
  {
    name: 'quotations:delete',
    description: 'Cancel or delete quotation drafts',
  },
  {
    name: 'quotations:approve',
    description: 'Approve quotations for sales or repair job conversion',
  },

  // Reports
  {
    name: 'reports:read',
    description:
      'View executive, financial, inventory, and operational reports',
  },
  {
    name: 'reports:export',
    description: 'Export tabular and analytical report data',
  },

  // Settings
  {
    name: 'settings:read',
    description: 'View platform configuration and system parameters',
  },
  {
    name: 'settings:update',
    description: 'Modify platform settings, tax rules, and system options',
  },
];

// ==========================================
// 4. ROLE-TO-PERMISSION MAPPINGS
// Super Admin receives ALL permissions automatically.
// Other roles receive specific subsets tailored to operational boundaries.
// ==========================================
const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  Admin: [
    'dashboard:read',
    'users:read',
    'users:create',
    'users:update',
    'users:delete',
    'roles:read',
    'roles:update',
    'permissions:read',
    'branches:read',
    'branches:create',
    'branches:update',
    'products:read',
    'products:create',
    'products:update',
    'products:delete',
    'inventory:read',
    'inventory:write',
    'transfers:read',
    'transfers:write',
    'customers:read',
    'customers:create',
    'customers:update',
    'customers:delete',
    'suppliers:read',
    'suppliers:create',
    'suppliers:update',
    'suppliers:delete',
    'repairs:read',
    'repairs:create',
    'repairs:update',
    'repairs:delete',
    'repairs:assign',
    'sales:read',
    'sales:create',
    'sales:update',
    'sales:void',
    'quotations:read',
    'quotations:create',
    'quotations:update',
    'quotations:delete',
    'quotations:approve',
    'reports:read',
    'reports:export',
    'settings:read',
    'settings:update',
  ],
  Manager: [
    'dashboard:read',
    'users:read',
    'branches:read',
    'products:read',
    'products:create',
    'products:update',
    'inventory:read',
    'inventory:write',
    'transfers:read',
    'transfers:write',
    'customers:read',
    'customers:create',
    'customers:update',
    'suppliers:read',
    'suppliers:create',
    'suppliers:update',
    'repairs:read',
    'repairs:create',
    'repairs:update',
    'repairs:assign',
    'sales:read',
    'sales:create',
    'sales:update',
    'sales:void',
    'quotations:read',
    'quotations:create',
    'quotations:update',
    'quotations:approve',
    'reports:read',
    'reports:export',
    'settings:read',
  ],
  Technician: [
    'dashboard:read',
    'products:read',
    'inventory:read',
    'customers:read',
    'repairs:read',
    'repairs:create',
    'repairs:update',
    'quotations:read',
    'quotations:create',
  ],
  Sales: [
    'dashboard:read',
    'products:read',
    'inventory:read',
    'customers:read',
    'customers:create',
    'customers:update',
    'repairs:read',
    'repairs:create',
    'sales:read',
    'sales:create',
    'sales:update',
    'quotations:read',
    'quotations:create',
    'quotations:update',
  ],
  Cashier: [
    'dashboard:read',
    'products:read',
    'customers:read',
    'customers:create',
    'sales:read',
    'sales:create',
    'quotations:read',
  ],
  'Inventory Officer': [
    'dashboard:read',
    'products:read',
    'products:create',
    'products:update',
    'inventory:read',
    'inventory:write',
    'transfers:read',
    'transfers:write',
    'suppliers:read',
    'suppliers:create',
    'suppliers:update',
    'reports:read',
  ],
};

async function main() {
  console.log('Database seed started');

  // 1. Seed Branch (Head Office)
  const branch = await prisma.branch.upsert({
    where: { code: FOUNDATIONAL_BRANCH.code },
    update: {
      name: FOUNDATIONAL_BRANCH.name,
      address: FOUNDATIONAL_BRANCH.address,
      isActive: FOUNDATIONAL_BRANCH.isActive,
    },
    create: {
      name: FOUNDATIONAL_BRANCH.name,
      code: FOUNDATIONAL_BRANCH.code,
      address: FOUNDATIONAL_BRANCH.address,
      isActive: FOUNDATIONAL_BRANCH.isActive,
    },
  });
  console.log(`Branch created/updated: ${branch.name} (${branch.code})`);

  // 2. Seed Roles
  const rolesMap = new Map<string, string>();
  for (const roleDef of FOUNDATIONAL_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: {
        name: roleDef.name,
        description: roleDef.description,
      },
    });
    rolesMap.set(role.name, role.id);
  }
  console.log(
    `Roles created/updated: ${FOUNDATIONAL_ROLES.length} roles verified`
  );

  // 3. Seed Permissions
  const permissionsMap = new Map<string, string>();
  for (const permDef of FOUNDATIONAL_PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { name: permDef.name },
      update: { description: permDef.description },
      create: {
        name: permDef.name,
        description: permDef.description,
      },
    });
    permissionsMap.set(perm.name, perm.id);
  }
  console.log(
    `Permissions created/updated: ${FOUNDATIONAL_PERMISSIONS.length} permissions verified`
  );

  // 4. Seed Role Permissions
  // Uses createMany with skipDuplicates for idempotency — safe because RolePermission has
  // a composite PK (roleId, permissionId), so duplicates are a no-op on re-run.
  // This batches all inserts into 2 queries instead of ~160 sequential round-trips.

  // 4a. Super Admin gets ALL permissions
  const superAdminRoleId = rolesMap.get('Super Admin');
  let totalRolePermissions = 0;

  if (superAdminRoleId) {
    const superAdminData = [...permissionsMap.values()].map((permissionId) => ({
      roleId: superAdminRoleId,
      permissionId,
    }));
    const superAdminResult = await prisma.rolePermission.createMany({
      data: superAdminData,
      skipDuplicates: true,
    });
    totalRolePermissions += superAdminData.length;
    if (superAdminResult.count > 0) {
      console.log(
        `  Super Admin: ${superAdminResult.count} new permission(s) added`
      );
    }
  }

  // 4b. Seed other role mappings (batch all roles in one createMany)
  const otherRoleData: { roleId: string; permissionId: string }[] = [];
  const missingPermissions: string[] = [];

  for (const [roleName, permissionNames] of Object.entries(
    ROLE_PERMISSIONS_MAP
  )) {
    const roleId = rolesMap.get(roleName);
    if (!roleId) continue;

    for (const permName of permissionNames) {
      const permissionId = permissionsMap.get(permName);
      if (!permissionId) {
        missingPermissions.push(`"${permName}" (role: ${roleName})`);
        continue;
      }
      otherRoleData.push({ roleId, permissionId });
    }
  }

  if (missingPermissions.length > 0) {
    console.warn(
      `Warning: ${missingPermissions.length} permission(s) not found: ${missingPermissions.join(', ')}`
    );
  }

  if (otherRoleData.length > 0) {
    const otherRolesResult = await prisma.rolePermission.createMany({
      data: otherRoleData,
      skipDuplicates: true,
    });
    totalRolePermissions += otherRoleData.length;
    if (otherRolesResult.count > 0) {
      console.log(
        `  Other roles: ${otherRolesResult.count} new permission(s) added`
      );
    }
  }

  console.log(
    `Role permissions created/updated: ${totalRolePermissions} role-permission mappings verified`
  );

  console.log('Database seed completed successfully');
}

main()
  .catch((error) => {
    console.error(
      'Error during database seed execution:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
