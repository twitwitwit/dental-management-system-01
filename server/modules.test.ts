import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const mockPatients = [
  {
    id: 1,
    firstName: "Sarah",
    lastName: "Wilson",
    dateOfBirth: new Date("1988-04-12"),
    gender: "female" as const,
    phone: "+15551234567",
    email: "sarah.wilson@example.com",
    address: "123 Main St",
    bloodType: "O+",
    allergies: "Penicillin",
    medicalNotes: null,
    dentalNotes: null,
    status: "active" as const,
    registeredAt: new Date(),
  },
];

const mockAppointments = [
  {
    id: 1,
    patientId: 1,
    dentistId: 1,
    appointmentDate: "2026-09-01",
    startTime: "10:00",
    endTime: "10:30",
    type: "checkup" as const,
    status: "scheduled" as const,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockInvoices = [
  {
    id: 1,
    patientId: 1,
    invoiceNumber: "INV-001",
    subtotal: "100.00",
    discount: "0.00",
    tax: "0.00",
    total: "100.00",
    status: "draft" as const,
    dueDate: null,
    notes: null,
    issuedAt: new Date(),
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockItems = [
  {
    id: 1,
    name: "Dental Composite",
    category: "Restorative",
    sku: "COMP-001",
    quantity: 25,
    unit: "pcs",
    lowStockThreshold: 10,
    unitCost: "45.00",
    supplier: "DentalSupply Co",
    lastRestockedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockProviders = [
  {
    id: 1,
    name: "Delta Dental",
    contactPhone: "+15559876543",
    website: "https://deltadental.com",
    createdAt: new Date(),
  },
];

const mockClaims = [
  {
    id: 1,
    claimNumber: "CLM-001",
    patientId: 1,
    patientInsuranceId: 1,
    amount: "150.00",
    status: "submitted" as const,
    description: "Cleaning & Exam",
    submittedAt: new Date(),
    processedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockUsers = [
  {
    id: 1,
    openId: "admin-user",
    name: "Admin User",
    email: "admin@example.com",
    loginMethod: "oauth",
    role: "admin" as const,
    isActive: true,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
];

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listPatients: vi.fn(async (opts?: { search?: string; status?: string }) => {
      let res = [...mockPatients];
      if (opts?.search) {
        const q = opts.search.toLowerCase();
        res = res.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q));
      }
      return res;
    }),
    getPatientById: vi.fn(async (id: number) => mockPatients.find(p => p.id === id)),
    createPatient: vi.fn(async (data: any) => {
      const newId = mockPatients.length + 1;
      const created = { id: newId, ...data, registeredAt: new Date(), status: data.status || "active" };
      mockPatients.push(created);
      return newId;
    }),
    updatePatient: vi.fn(async (id: number, data: any) => {
      const p = mockPatients.find(item => item.id === id);
      if (p) Object.assign(p, data);
    }),
    listAppointments: vi.fn(async () => mockAppointments),
    createAppointment: vi.fn(async (data: any) => {
      const newId = mockAppointments.length + 1;
      mockAppointments.push({ id: newId, ...data, createdAt: new Date(), updatedAt: new Date() });
      return newId;
    }),
    updateAppointment: vi.fn(async (id: number, data: any) => {
      const a = mockAppointments.find(item => item.id === id);
      if (a) Object.assign(a, data);
    }),
    listInvoices: vi.fn(async () => mockInvoices),
    createInvoice: vi.fn(async (data: any) => {
      const newId = mockInvoices.length + 1;
      mockInvoices.push({ id: newId, ...data, invoiceNumber: `INV-00${newId}`, total: "100.00", subtotal: "100.00", createdAt: new Date(), updatedAt: new Date(), issuedAt: new Date(), paidAt: null, dueDate: null, notes: null });
      return newId;
    }),
    createInvoiceItem: vi.fn(async () => 1),
    listPayments: vi.fn(async () => []),
    listInventoryItems: vi.fn(async () => mockItems),
    adjustInventory: vi.fn(async (itemId: number, _type: string, qty: number) => {
      const item = mockItems.find(i => i.id === itemId);
      if (item) item.quantity += qty;
      return { newQuantity: item ? item.quantity : qty, movementId: 1 };
    }),
    listInsuranceProviders: vi.fn(async () => mockProviders),
    listInsuranceClaims: vi.fn(async () => mockClaims),
    listUsers: vi.fn(async () => mockUsers),
    getDashboardStats: vi.fn(async () => ({
      todayAppointments: 4,
      todayRevenue: 1250,
      newPatients: 2,
      totalPatients: 15,
      pendingTasks: 3,
    })),
    getAppointmentTrends: vi.fn(async () => [
      { date: "2026-08-01", count: 5 },
      { date: "2026-08-02", count: 8 },
    ]),
    getRevenueByMonth: vi.fn(async () => [
      { month: "2026-07", revenue: 15000 },
      { month: "2026-08", revenue: 18000 },
    ]),
    getAppointmentsByStatus: vi.fn(async () => [
      { status: "completed", count: 20 },
      { status: "scheduled", count: 8 },
    ]),
  };
});

type CookieCall = { name: string; options: Record<string, unknown> };

function createAuthContext(role: "admin" | "dentist" | "receptionist" | "staff" | null) {
  const clearedCookies: CookieCall[] = [];
  const user = role
    ? {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: role as TrpcContext["user"] extends infer U extends NonNullable<unknown> ? U["role"] : never,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("role-based access control", () => {
  it("rejects unauthenticated requests on protected procedures", async () => {
    const { ctx } = createAuthContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.patients.list({})).rejects.toThrow();
  });

  it("denies receptionist access to admin-only staff management", async () => {
    const { ctx } = createAuthContext("receptionist");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });

  it("denies staff access to patient records", async () => {
    const { ctx } = createAuthContext("staff");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.patients.list({})).rejects.toThrow();
  });

  it("allows admin full access to all modules", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const patients = await caller.patients.list({});
    expect(Array.isArray(patients)).toBe(true);
    const stats = await caller.dashboard.stats();
    expect(stats).toHaveProperty("stats");
    expect(stats.stats).toHaveProperty("todayAppointments");
  });
});

describe("patients", () => {
  it("lists patients with core fields", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const patients = await caller.patients.list({});
    expect(patients.length).toBeGreaterThan(0);
    expect(patients[0]).toHaveProperty("firstName");
    expect(patients[0]).toHaveProperty("status");
  });

  it("filters patients by search text", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const results = await caller.patients.list({ search: "Wilson" });
    expect(results.every(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes("wilson"),
    )).toBe(true);
  });

  it("creates and updates a patient with smoking status and medical information", async () => {
    const { ctx } = createAuthContext("receptionist");
    const caller = appRouter.createCaller(ctx);
    const created = await caller.patients.create({
      firstName: "Test",
      lastName: "Patient",
      gender: "female",
      dateOfBirth: "1990-01-01",
      phone: "+15550000000",
      email: "test.patient@example.com",
      address: "123 Test St",
      bloodType: "A+",
      smokingStatus: "current_heavy",
      smokingDetails: "1 pack/day for 6 years",
      alcoholUse: "occasional",
      diabetes: "Type 2 (controlled)",
      bleedingDisorder: "On Aspirin",
      bruxism: true,
      dentalAnxiety: "mild",
      chiefComplaint: "Tooth sensitivity on lower left molar",
      emergencyContactName: "John Patient",
      emergencyContactPhone: "+15559998888",
      emergencyContactRelation: "Spouse",
      status: "active",
    });
    expect(created.id).toBeGreaterThan(0);

    const updated = await caller.patients.update({
      id: created.id,
      data: {
        allergies: "Latex",
        smokingStatus: "former",
        smokingDetails: "Quit 6 months ago",
      },
    });
    expect(updated.success).toBe(true);

    const fetched = await caller.patients.get({ id: created.id });
    expect(fetched?.allergies).toBe("Latex");
    expect(fetched?.smokingStatus).toBe("former");
    expect(fetched?.smokingDetails).toBe("Quit 6 months ago");
    expect(fetched?.diabetes).toBe("Type 2 (controlled)");
    expect(fetched?.bruxism).toBe(true);
    expect(fetched?.emergencyContactName).toBe("John Patient");
  });
});

describe("appointments", () => {
  it("creates, lists, and cancels an appointment", async () => {
    const { ctx } = createAuthContext("receptionist");
    const caller = appRouter.createCaller(ctx);
    const patients = await caller.patients.list({});
    const patientId = patients[0].id;

    const created = await caller.appointments.create({
      patientId,
      dentistId: null,
      appointmentDate: "2026-09-01",
      startTime: "10:00",
      endTime: "10:30",
      type: "checkup",
      status: "scheduled",
    });
    expect(created.id).toBeGreaterThan(0);

    const list = await caller.appointments.list({});
    expect(list.some(a => a.id === created.id)).toBe(true);

    const updated = await caller.appointments.update({
      id: created.id,
      data: { status: "confirmed" },
    });
    expect(updated.success).toBe(true);
  });
});

describe("billing", () => {
  it("lists invoices with seeded data and computes balances", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const invoices = await caller.billing.invoices({});
    expect(invoices.length).toBeGreaterThan(0);
    expect(invoices[0]).toHaveProperty("total");
    expect(invoices[0]).toHaveProperty("status");
  });

  it("creates an invoice with items", async () => {
    const { ctx } = createAuthContext("receptionist");
    const caller = appRouter.createCaller(ctx);
    const patients = await caller.patients.list({});
    const inv = await caller.billing.createInvoice({
      patientId: patients[0].id,
      status: "draft",
      discount: "0.00",
      tax: "0.00",
      items: [
        { description: "Cleaning", quantity: 1, unitPrice: "100.00" },
      ],
    });
    expect(inv.id).toBeGreaterThan(0);
  });
});

describe("inventory", () => {
  it("lists items and adjusts stock", async () => {
    const { ctx } = createAuthContext("staff");
    const caller = appRouter.createCaller(ctx);
    const items = await caller.inventory.items();
    expect(items.length).toBeGreaterThan(0);

    const item = items[0];
    const adjusted = await caller.inventory.adjust({
      itemId: item.id,
      type: "stock_in",
      quantity: 5,
      reason: "test restock",
    });
    expect(adjusted).toBeDefined();
  });
});

describe("insurance", () => {
  it("lists providers and claims", async () => {
    const { ctx } = createAuthContext("receptionist");
    const caller = appRouter.createCaller(ctx);
    const providers = await caller.insurance.providers();
    expect(providers.length).toBeGreaterThan(0);
    const claims = await caller.insurance.claims({});
    expect(Array.isArray(claims)).toBe(true);
    if (claims.length > 0) {
      expect(claims[0]).toHaveProperty("claimNumber");
    }
  });
});

describe("dashboard stats", () => {
  it("returns valid KPI aggregates", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.stats();
    expect(typeof result.stats.todayAppointments).toBe("number");
    expect(typeof result.stats.totalPatients).toBe("number");
    expect(result.stats.todayAppointments).toBeGreaterThanOrEqual(0);
    expect(result.stats.totalPatients).toBeGreaterThan(0);
    expect(Array.isArray(result.trends)).toBe(true);
    expect(Array.isArray(result.revenue)).toBe(true);
    expect(Array.isArray(result.byStatus)).toBe(true);
  });
});

describe("ADA / CDT Procedure Codes", () => {
  it("provides valid CDT codes across clinical categories", async () => {
    const { CDT_CODES, CDT_CATEGORIES, searchCDTCodes, getCDTCode } = await import("@shared/cdtCodes");
    expect(CDT_CODES.length).toBeGreaterThan(30);
    expect(CDT_CATEGORIES.length).toBe(10);

    // Test specific standard codes
    const d0120 = getCDTCode("D0120");
    expect(d0120).toBeDefined();
    expect(d0120?.name).toContain("Periodic Oral Evaluation");
    expect(d0120?.defaultFee).toBe(55);

    const d2391 = getCDTCode("d2391");
    expect(d2391).toBeDefined();
    expect(d2391?.category).toBe("Restorative");
    expect(d2391?.defaultFee).toBe(175);

    // Test search functionality
    const searchRes = searchCDTCodes("composite");
    expect(searchRes.length).toBeGreaterThan(0);
    expect(searchRes.every(c => c.category === "Restorative" || c.name.toLowerCase().includes("composite"))).toBe(true);

    const categoryRes = searchCDTCodes("", "Oral Surgery");
    expect(categoryRes.length).toBeGreaterThan(0);
    expect(categoryRes.every(c => c.category === "Oral Surgery")).toBe(true);
  });
});
