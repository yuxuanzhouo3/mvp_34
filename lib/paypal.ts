import { NextResponse } from "next/server";

const isLive = process.env.PAYPAL_ENVIRONMENT === "live" || process.env.PAYPAL_ENVIRONMENT === "production";
const PAYPAL_API_BASE = isLive
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

function getBasicAuthHeader() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials");
  }
  const token = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${token}`;
}

async function getAccessToken(): Promise<string> {
  const auth = getBasicAuthHeader();
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get PayPal access token: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

export async function createPayPalOrder(params: {
  amount: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
  userId?: string;
  customId?: string;
  description?: string;
}) {
  const accessToken = await getAccessToken();
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: params.currency,
          value: params.amount.toFixed(2),
        },
        custom_id: params.customId || params.userId || undefined,
        description: params.description?.slice(0, 127),
      },
    ],
    application_context: {
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
    },
  };

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create PayPal order: ${res.status} ${text}`);
  }

  const json = await res.json();
  const approvalUrl =
    json.links?.find((l: any) => l.rel === "approve")?.href || null;

  return { orderId: json.id as string, approvalUrl };
}

export async function capturePayPalOrder(orderId: string) {
  const accessToken = await getAccessToken();
  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to capture PayPal order: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json;
}

export function paypalErrorResponse(err: unknown) {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "PayPal error";
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
