const CARDCOM_API = 'https://secure.cardcom.solutions/api/v11/LowProfile';

function getConfig() {
  const terminal = Number(process.env.CARDCOM_TERMINAL_NUMBER);
  const apiName = process.env.CARDCOM_API_NAME;
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
  const serverUrl = (process.env.SERVER_PUBLIC_URL || baseUrl)?.replace(/\/$/, '');
  const price = Number(process.env.PRICE_ILS || 19);

  if (!terminal || !apiName || !baseUrl || !serverUrl) {
    return null;
  }

  return { terminal, apiName, baseUrl, serverUrl, price };
}

export function isCardcomConfigured() {
  return Boolean(getConfig());
}

export function getPrice() {
  return getConfig()?.price ?? Number(process.env.PRICE_ILS || 19);
}

export async function createPaymentPage({ orderId }) {
  const config = getConfig();
  if (!config) {
    throw new Error('Cardcom לא מוגדר. הוסף CARDCOM_TERMINAL_NUMBER, CARDCOM_API_NAME ו-APP_BASE_URL ל-.env');
  }

  const body = {
    TerminalNumber: config.terminal,
    ApiName: config.apiName,
    Operation: 'ChargeOnly',
    Amount: config.price,
    ReturnValue: orderId,
    ProductName: 'ניתוח רילס / TikTok',
    Language: 'he',
    ISOCoinId: 1,
    SuccessRedirectUrl: `${config.baseUrl}/?order=${orderId}&payment=success`,
    FailedRedirectUrl: `${config.baseUrl}/?order=${orderId}&payment=failed`,
    WebHookUrl: `${config.serverUrl}/api/payment/webhook`,
  };

  const res = await fetch(`${CARDCOM_API}/Create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.ResponseCode !== 0 || !data.Url) {
    throw new Error(data.Description || 'שגיאה ביצירת דף תשלום Cardcom');
  }

  return {
    paymentUrl: data.Url,
    lowProfileId: data.LowProfileId,
  };
}

export async function verifyPayment(lowProfileId) {
  const config = getConfig();
  if (!config) {
    throw new Error('Cardcom לא מוגדר');
  }

  const url = new URL(`${CARDCOM_API}/GetLpResult`);
  url.searchParams.set('TerminalNumber', String(config.terminal));
  url.searchParams.set('ApiName', config.apiName);
  url.searchParams.set('LowProfileId', lowProfileId);

  const res = await fetch(url.toString(), { method: 'GET' });
  const data = await res.json();

  return {
    ok: data.ResponseCode === 0,
    orderId: data.ReturnValue,
    transactionId: data.TransactionId || data.TranzactionId,
    data,
  };
}
