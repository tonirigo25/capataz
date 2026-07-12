import { NextRequest, NextResponse } from "next/server";
import { processDueAutomations } from "@/lib/automations/automation-scheduler";
export async function POST(request:NextRequest){const expected=process.env.CRON_SECRET||process.env.PROACTIVE_CRON_SECRET;if(!expected||request.headers.get("authorization")!==`Bearer ${expected}`)return NextResponse.json({ok:false},{status:401});const results=await processDueAutomations();return NextResponse.json({ok:true,processed:results.length});}
