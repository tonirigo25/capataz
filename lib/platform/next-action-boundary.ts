import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withActionEffects } from "@/lib/application/action-effects";
import { getOptionalSession, requireCompanyContext, withCompanyContext } from "@/lib/auth/session";
import { enrichRequestContext, getRequestContext, requestContextFromHeaders, withRequestContext } from "@/lib/platform/request-context";

export type NextActionDescriptor = {
  operation: string;
};

export async function executeNextAction<T>(descriptor: NextActionDescriptor, operation: () => Promise<T>): Promise<T> {
  const inherited = getRequestContext();
  const requestContext = inherited ?? await requestContextFromHeaders();

  return withRequestContext(
    { ...requestContext, operation: descriptor.operation },
    async () => {
      const session = await getOptionalSession();
      if (session) enrichRequestContext({ actor: { type: "user", id: session.userId } });
      const invoke = () => withActionEffects(
        {
          revalidatePath: (path, type) => revalidatePath(path, type),
          redirect: (path) => redirect(path),
        },
        operation,
      );
      if (!descriptor.operation.startsWith("app/(app)/")) return invoke();
      const companyContext = await requireCompanyContext();
      return withCompanyContext(companyContext, invoke);
    },
  );
}
