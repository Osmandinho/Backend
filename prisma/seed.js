const { PrismaClient, Prisma } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { randomBytes, scryptSync } = require('crypto');

const databaseUrl = process.env.DATABASE_URL;
const demoPassword = 'heslo123';

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

const ensureIncome = async (entry) => {
  const existing = await prisma.income.findFirst({
    where: {
      companyId: entry.companyId,
      date: entry.date,
      description: entry.description,
      amount: new Prisma.Decimal(entry.amount),
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.income.create({
    data: {
      companyId: entry.companyId,
      categoryId: entry.categoryId ?? null,
      createdById: entry.createdById ?? null,
      date: entry.date,
      description: entry.description ?? null,
      amount: new Prisma.Decimal(entry.amount),
    },
  });
};

const ensureExpense = async (entry) => {
  const existing = await prisma.expense.findFirst({
    where: {
      companyId: entry.companyId,
      date: entry.date,
      description: entry.description,
      amount: new Prisma.Decimal(entry.amount),
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.expense.create({
    data: {
      companyId: entry.companyId,
      categoryId: entry.categoryId ?? null,
      createdById: entry.createdById ?? null,
      date: entry.date,
      description: entry.description ?? null,
      amount: new Prisma.Decimal(entry.amount),
    },
  });
};

const ensureInvoice = async (entry) => {
  const existing = await prisma.invoice.findFirst({
    where: {
      companyId: entry.companyId,
      title: entry.title,
      issuedAt: entry.issuedAt,
      dueDate: entry.dueDate,
      amount: new Prisma.Decimal(entry.amount),
    },
  });

  if (existing) {
    return prisma.invoice.update({
      where: { id: existing.id },
      data: {
        number: entry.number ?? null,
        currency: entry.currency ?? 'CZK',
        description: entry.description ?? null,
        status: entry.status,
        paidAt: entry.paidAt ?? null,
        paidNote: entry.paidNote ?? null,
        fileUrl: entry.fileUrl ?? null,
        createdById: entry.createdById ?? null,
      },
    });
  }

  return prisma.invoice.create({
    data: {
      companyId: entry.companyId,
      number: entry.number ?? null,
      title: entry.title,
      amount: new Prisma.Decimal(entry.amount),
      currency: entry.currency ?? 'CZK',
      issuedAt: entry.issuedAt,
      dueDate: entry.dueDate,
      description: entry.description ?? null,
      status: entry.status,
      paidAt: entry.paidAt ?? null,
      paidNote: entry.paidNote ?? null,
      fileUrl: entry.fileUrl ?? null,
      createdById: entry.createdById ?? null,
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
      update: {
        passwordHash: hashPassword(demoUser.password),
      },
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

  const accountantUser = users.find((user) => user.email === 'ucetni@demo.cz');
  const employeeUser = users.find((user) => user.email === 'zamestnanec@demo.cz');

  const categories = {
    mzda: await upsertCategory(company.id, 'INCOME', 'Mzda'),
    prodej: await upsertCategory(company.id, 'INCOME', 'Prodej'),
    konzultace: await upsertCategory(company.id, 'INCOME', 'Konzultace'),
    refundace: await upsertCategory(company.id, 'INCOME', 'Refundace'),
    najem: await upsertCategory(company.id, 'EXPENSE', 'Najem'),
    kancelar: await upsertCategory(company.id, 'EXPENSE', 'Kancelar'),
    marketing: await upsertCategory(company.id, 'EXPENSE', 'Marketing'),
    doprava: await upsertCategory(company.id, 'EXPENSE', 'Doprava'),
    software: await upsertCategory(company.id, 'EXPENSE', 'Software'),
  };

  const sampleIncomes = [
    {
      companyId: company.id,
      categoryId: categories.prodej.id,
      createdById: adminUser.id,
      amount: '12500.00',
      date: new Date('2026-01-05T08:00:00.000Z'),
      description: 'Prodej kancelarskych balicku',
    },
    {
      companyId: company.id,
      categoryId: categories.konzultace.id,
      createdById: accountantUser?.id ?? adminUser.id,
      amount: '4800.00',
      date: new Date('2026-01-12T09:30:00.000Z'),
      description: 'Konzultace k financnimu reportingu',
    },
    {
      companyId: company.id,
      categoryId: categories.mzda.id,
      createdById: adminUser.id,
      amount: '32000.00',
      date: new Date('2026-02-01T07:00:00.000Z'),
      description: 'Mesicni prijem od hlavniho odberatele',
    },
    {
      companyId: company.id,
      categoryId: categories.refundace.id,
      createdById: employeeUser?.id ?? adminUser.id,
      amount: '1500.00',
      date: new Date('2026-02-15T11:00:00.000Z'),
      description: 'Refundace sluzebni cesty',
    },
  ];

  const sampleExpenses = [
    {
      companyId: company.id,
      categoryId: categories.najem.id,
      createdById: adminUser.id,
      amount: '18000.00',
      date: new Date('2026-01-03T08:00:00.000Z'),
      description: 'Najem kancelare leden',
    },
    {
      companyId: company.id,
      categoryId: categories.kancelar.id,
      createdById: accountantUser?.id ?? adminUser.id,
      amount: '2490.00',
      date: new Date('2026-01-08T10:15:00.000Z'),
      description: 'Papir, tonery a kancelarske potreby',
    },
    {
      companyId: company.id,
      categoryId: categories.software.id,
      createdById: adminUser.id,
      amount: '1290.00',
      date: new Date('2026-01-20T12:00:00.000Z'),
      description: 'Mesicni licence ucetniho softwaru',
    },
    {
      companyId: company.id,
      categoryId: categories.marketing.id,
      createdById: employeeUser?.id ?? adminUser.id,
      amount: '5600.00',
      date: new Date('2026-02-10T14:00:00.000Z'),
      description: 'Online kampan na socialnich sitich',
    },
    {
      companyId: company.id,
      categoryId: categories.doprava.id,
      createdById: employeeUser?.id ?? adminUser.id,
      amount: '890.00',
      date: new Date('2026-02-18T06:45:00.000Z'),
      description: 'Cestovne na schuzku s klientem',
    },
  ];

  const sampleInvoices = [
    {
      companyId: company.id,
      createdById: adminUser.id,
      number: '2026-001',
      title: 'Faktura za vedeni ucetnictvi',
      amount: '14500.00',
      currency: 'CZK',
      issuedAt: new Date('2026-01-10T00:00:00.000Z'),
      dueDate: new Date('2026-01-24T00:00:00.000Z'),
      description: 'Pravidelne mesicni ucetni sluzby',
      status: 'PAID',
      paidAt: new Date('2026-01-18T09:00:00.000Z'),
      paidNote: 'Uhrazena bankovnim prevodem',
      fileUrl: null,
    },
    {
      companyId: company.id,
      createdById: accountantUser?.id ?? adminUser.id,
      number: '2026-002',
      title: 'Dodani kancelarskeho vybaveni',
      amount: '8200.00',
      currency: 'CZK',
      issuedAt: new Date('2026-02-02T00:00:00.000Z'),
      dueDate: new Date('2026-02-16T00:00:00.000Z'),
      description: 'Monitory a klavesnice pro nove pracoviste',
      status: 'OPEN',
      paidAt: null,
      paidNote: null,
      fileUrl: null,
    },
    {
      companyId: company.id,
      createdById: adminUser.id,
      number: '2026-003',
      title: 'Marketingova kampan Q1',
      amount: '6700.00',
      currency: 'CZK',
      issuedAt: new Date('2026-02-20T00:00:00.000Z'),
      dueDate: new Date('2026-03-05T00:00:00.000Z'),
      description: 'Propagace sluzeb na internetu',
      status: 'CANCELLED',
      paidAt: null,
      paidNote: 'Stornovano dodavatelem',
      fileUrl: null,
    },
  ];

  for (const entry of sampleIncomes) {
    await ensureIncome(entry);
  }

  for (const entry of sampleExpenses) {
    await ensureExpense(entry);
  }

  for (const entry of sampleInvoices) {
    await ensureInvoice(entry);
  }

  console.log('Seed complete.');
  console.log(`Company: ${company.name}`);
  console.log('Users:');
  for (const demoUser of demoUsers) {
    console.log(`- ${demoUser.email} (${demoUser.role}) / ${demoUser.password}`);
  }
  console.log(`Categories created: ${Object.values(categories).length}`);
  console.log(`Sample incomes created: ${sampleIncomes.length}`);
  console.log(`Sample expenses created: ${sampleExpenses.length}`);
  console.log(`Sample invoices created: ${sampleInvoices.length}`);
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
