const { PrismaClient, Prisma } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { randomBytes, scryptSync } = require('crypto');

const databaseUrl = process.env.DATABASE_URL;
const demoPassword =  heslo123;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in environment.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const hashPassword = (password) => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
};

const upsertCategory = async (companyId, type, name) => {
  return prisma.category.upsert({
    where: {
      companyId_type_name: {
        companyId,
        type,
        name,
      },
    },
    update: {},
    create: {
      companyId,
      type,
      name,
    },
  });
};

const demoUsers = [
  {
    email: 'admin@demo.cz',
    password: demoPassword,
    role: 'ADMIN',
  },
  {
    email: 'ucetni@demo.cz',
    password: demoPassword,
    role: 'ACCOUNTANT',
  },
  {
    email: 'zamestnanec@demo.cz',
    password: demoPassword,
    role: 'EMPLOYEE',
  },
];

const seed = async () => {
  let company = await prisma.company.findFirst({ where: { name: 'Demo firma' } });
  if (!company) {
    company = await prisma.company.create({ data: { name: 'Demo firma' } });
  }

  const users = [];

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {},
      create: {
        email: demoUser.email,
        passwordHash: hashPassword(demoUser.password),
      },
    });

    await prisma.membership.upsert({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId: company.id,
        },
      },
      update: { role: demoUser.role },
      create: {
        userId: user.id,
        companyId: company.id,
        role: demoUser.role,
      },
    });

    users.push(user);
  }

  const adminUser = users.find((user) => user.email === 'admin@demo.cz');
  if (!adminUser) {
    throw new Error('Admin demo user was not created.');
  }

  const salaryCategory = await upsertCategory(company.id, 'INCOME', 'Mzda');
  const salesCategory = await upsertCategory(company.id, 'INCOME', 'Prodej');
  const rentCategory = await upsertCategory(company.id, 'EXPENSE', 'Najem');
  const officeCategory = await upsertCategory(company.id, 'EXPENSE', 'Kancelar');

  const sampleIncomeDate = new Date('2026-01-05T00:00:00.000Z');
  const sampleExpenseDate = new Date('2026-01-06T00:00:00.000Z');

  const existingIncome = await prisma.income.findFirst({
    where: {
      companyId: company.id,
      date: sampleIncomeDate,
      description: 'Ukazkovy prijem',
    },
  });

  if (!existingIncome) {
    await prisma.income.create({
      data: {
        amount: new Prisma.Decimal('2500.00'),
        date: sampleIncomeDate,
        description: 'Ukazkovy prijem',
        companyId: company.id,
        categoryId: salaryCategory.id,
        createdById: adminUser.id,
      },
    });
  }

  const existingExpense = await prisma.expense.findFirst({
    where: {
      companyId: company.id,
      date: sampleExpenseDate,
      description: 'Ukazkovy vydaj',
    },
  });

  if (!existingExpense) {
    await prisma.expense.create({
      data: {
        amount: new Prisma.Decimal('420.00'),
        date: sampleExpenseDate,
        description: 'Ukazkovy vydaj',
        companyId: company.id,
        categoryId: officeCategory.id,
        createdById: adminUser.id,
      },
    });
  }

  console.log('Seed complete.');
  console.log(`Company: ${company.name}`);
  console.log('Users:');
  for (const demoUser of demoUsers) {
    console.log(`- ${demoUser.email} (${demoUser.role}) / ${demoUser.password}`);
  }
  console.log(`Categories: ${salaryCategory.name}, ${salesCategory.name}, ${rentCategory.name}, ${officeCategory.name}`);
};

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
