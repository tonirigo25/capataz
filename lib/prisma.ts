import { PrismaClient } from "@prisma/client";
import { persistenceContext } from "@/lib/platform/persistence-context";

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  return client.$extends({
    query: {
      auditLog: {
        async create({ args, query }) {
          args.data = { ...persistenceContext(), ...args.data };
          return query(args);
        },
        async createMany({ args, query }) {
          const data = Array.isArray(args.data) ? args.data : [args.data];
          args.data = data.map((item) => ({ ...persistenceContext(), ...item }));
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
