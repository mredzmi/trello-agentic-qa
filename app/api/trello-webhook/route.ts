import { NextResponse } from "next/server";

export async function GET(){return new Response("Trello Agentic QA webhook is alive",{status:200});}
export async function HEAD(){return new Response(null,{status:200});}
export async function POST(req:Request){
  const body=await req.json().catch(()=>({}));
  console.log("TRELLO_WEBHOOK",JSON.stringify(body));
  return NextResponse.json({received:true});
}