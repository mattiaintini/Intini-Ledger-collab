import { getCotReport } from "@/lib/cot/report";

export const revalidate = 3600;

export async function GET() {
  const report = await getCotReport();
  return Response.json(report);
}
