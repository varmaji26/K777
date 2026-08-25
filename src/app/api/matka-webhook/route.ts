import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let body: any = {};

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
    } else {
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }

    console.log("========== M-API WEBHOOK ==========");
    console.log("Headers:", Object.fromEntries(request.headers.entries()));
    console.log("Body:", body);
    console.log("====================================");

    return NextResponse.json({
      success: true,
      message: "Webhook received",
      received: body,
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Webhook error",
      },
      { status: 500 }
    );
  }
}
