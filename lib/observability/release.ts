import { prisma } from "@/lib/prisma";

export function releaseMetadata() {
  return {
    releaseSha: process.env.APP_RELEASE_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "unknown",
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? "local",
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "unknown",
    serviceId: process.env.RAILWAY_SERVICE_ID ?? "local",
  };
}

export async function internalReleaseMetadata() {
  const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY finished_at DESC LIMIT 1`;
  return { ...releaseMetadata(), migrationHead: rows[0]?.migration_name ?? "none" };
}
