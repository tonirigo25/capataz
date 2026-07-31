import { redirect } from "next/navigation";

type AliasSearchParams = Record<string, string | string[] | undefined>;

export default async function WorkAliasPage({ searchParams }: { searchParams: Promise<AliasSearchParams> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  const suffix = params.toString();
  redirect(suffix ? `/obras?${suffix}` : "/obras");
}
