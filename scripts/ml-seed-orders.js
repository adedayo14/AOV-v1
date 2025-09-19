#!/usr/bin/env node
/**
 * ML Seed Orders Script (Node.js)
 *
 * Creates randomized test orders via Shopify Admin REST API to generate co-purchase signal for ML.
 * - 1–5 items per order
 * - Random quantities, optional discounts, shipping methods
 * - Backdated processed_at within a time window (default 90 days)
 * - Marks orders as test and tags them (ML_SEED, CartUplift) for easy cleanup
 *
 * Usage:
 *   node scripts/ml-seed-orders.js \
 *     --shop your-store.myshopify.com \
 *     --token shpat_xxx \
 *     --count 100 \
 *     --variants 1234567890,2345678901,3456789012 \
 *     --windowDays 90 \
 *     --intervalMs 600 \
 *     [--dry-run]
 *
 * Env vars (fallbacks):
 *   SHOPIFY_SHOP, SHOPIFY_ADMIN_TOKEN, VARIANT_IDS (comma-separated), ORDER_COUNT, WINDOW_DAYS, INTERVAL_MS
 *
 * Safety:
 * - Creates test orders (order.test = true) and avoids sending emails.
 * - Adds tags: ML_SEED, CartUplift
 * - Recommend running on a development store.
 */

const https = require('https');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith('--')) out[a.replace(/^--/, '')] = true;
  }
  return out;
}

const args = parseArgs();
const SHOP = (args.shop || process.env.SHOPIFY_SHOP || '').trim();
const TOKEN = (args.token || process.env.SHOPIFY_ADMIN_TOKEN || '').trim();
const COUNT = parseInt(args.count || process.env.ORDER_COUNT || '10', 10);
const VARIANT_IDS = (args.variants || process.env.VARIANT_IDS || '').trim();
const WINDOW_DAYS = parseInt(args.windowDays || process.env.WINDOW_DAYS || '90', 10);
const INTERVAL_MS = parseInt(args.intervalMs || process.env.INTERVAL_MS || '600', 10);
const DRY_RUN = !!args['dry-run'] || String(process.env.DRY_RUN||'').toLowerCase()==='true';
const API_VERSION = '2025-01';

if (!SHOP || !TOKEN) {
  console.error('Missing --shop and/or --token. Set SHOPIFY_SHOP and SHOPIFY_ADMIN_TOKEN env vars or pass CLI flags.');
  process.exit(1);
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function sample(arr, k){
  const copy = arr.slice();
  const out = [];
  while (out.length < k && copy.length) {
    const i = Math.floor(Math.random()*copy.length);
    out.push(copy.splice(i,1)[0]);
  }
  return out;
}
function randomDateInLastDays(days){
  const now = Date.now();
  const past = now - days*24*60*60*1000;
  const t = randInt(past, now);
  return new Date(t);
}

function requestJson(method, path, body){
  const payload = body ? JSON.stringify(body) : undefined;
  const opts = {
    hostname: SHOP,
    method,
    path,
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`${method} ${path} -> ${res.statusCode} ${res.statusMessage}\n${buf}`));
        }
        try { resolve(buf ? JSON.parse(buf) : {}); }
        catch(e) { resolve({ raw: buf }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function fetchVariantPool(limitTotal = 200) {
  if (VARIANT_IDS) {
    const cleaned = VARIANT_IDS.split(',').map(s=>s.trim()).filter(Boolean).map(v=>Number(v));
    if (cleaned.length) return cleaned;
  }
  // Fallback: fetch products and collect variants (limited)
  const collected = [];
  let endpoint = `/admin/api/${API_VERSION}/products.json?limit=100&fields=id,variants`;
  while (collected.length < limitTotal && endpoint) {
    const res = await requestJson('GET', endpoint, undefined);
    const products = Array.isArray(res.products) ? res.products : [];
    for (const p of products) {
      for (const v of (p.variants||[])) {
        if (typeof v.id !== 'undefined') {
          collected.push(Number(v.id));
          if (collected.length >= limitTotal) break;
        }
      }
      if (collected.length >= limitTotal) break;
    }
    // Basic pagination using since_id if provided in response (legacy); modern pagination uses Link headers which we don't have here.
    // To keep it simple, stop after first page if API doesn't provide more data in body.
    if (!products.length || products.length < 100) break;
    const lastId = products[products.length-1]?.id;
    if (!lastId) break;
    endpoint = `/admin/api/${API_VERSION}/products.json?limit=100&fields=id,variants&since_id=${lastId}`;
  }
  if (!collected.length) throw new Error('No variants found. Provide --variants or set VARIANT_IDS env var.');
  return collected;
}

function randomAddress() {
  const first = choice(['Alex','Jordan','Taylor','Riley','Casey','Morgan','Parker','Quinn']);
  const last = choice(['Smith','Brown','Johnson','Lee','Garcia','Martins','Davis','Moore']);
  const city = choice(['San Francisco','New York','Austin','Toronto','London','Berlin']);
  const country = choice(['United States','Canada','United Kingdom','Germany']);
  const province = choice(['California','Texas','Ontario','England','Berlin']);
  return {
    first_name: first,
    last_name: last,
    address1: `${randInt(100,999)} ${choice(['Main','Market','Cedar','Maple','Oak'])} St`,
    phone: `555-01${randInt(10,99)}`,
    city,
    province,
    country,
    zip: `${randInt(10000,99999)}`
  };
}

function maybeDiscount() {
  if (Math.random() < 0.35) {
    const type = Math.random() < 0.5 ? 'percentage' : 'fixed_amount';
    const amount = type === 'percentage' ? String(choice([5,10,15])) : String(choice([5,10,20]));
    return [{ code: `MLSEED${amount}${type==='percentage'?'P':'F'}`, amount, type }];
  }
  return [];
}

function randomShippingLine() {
  const opt = choice([
    { title: 'Standard Shipping', price: '5.00', code: 'STANDARD' },
    { title: 'Express Shipping', price: '15.00', code: 'EXPRESS' },
    { title: 'Free Shipping', price: '0.00', code: 'FREE' }
  ]);
  return [{ title: opt.title, price: opt.price, code: opt.code, source: 'shopify' }];
}

async function createOrder({ variantPool, index }) {
  const itemsPerOrder = randInt(1,5);
  const lineVariantIds = sample(variantPool, itemsPerOrder);
  const line_items = lineVariantIds.map(vid => ({ variant_id: vid, quantity: randInt(1,2) }));
  const when = randomDateInLastDays(WINDOW_DAYS);
  const email = `ml-seed+${index}@example.com`;
  const addr = randomAddress();
  const order = {
    test: true,
    email,
    send_receipt: false,
    send_fulfillment_receipt: false,
    tags: 'ML_SEED,CartUplift',
    line_items,
    financial_status: 'paid',
    fulfillment_status: 'fulfilled',
    processed_at: when.toISOString(),
    shipping_lines: randomShippingLine(),
    discount_codes: maybeDiscount(),
    customer: { first_name: addr.first_name, last_name: addr.last_name, email },
    billing_address: addr,
    shipping_address: addr,
    source_name: 'api'
  };
  if (DRY_RUN) {
    console.log('[DRY RUN] Would create order:', JSON.stringify(order));
    return { dryRun: true };
  }
  const res = await requestJson('POST', `/admin/api/${API_VERSION}/orders.json`, { order });
  return res;
}

async function main(){
  console.log('Shop:', SHOP);
  console.log('Count:', COUNT);
  console.log('Window days:', WINDOW_DAYS);
  console.log('Interval ms:', INTERVAL_MS);
  console.log('Dry run:', DRY_RUN);

  const variantPool = await fetchVariantPool();
  console.log('Variant pool size:', variantPool.length);

  let ok = 0, fail = 0;
  for (let i = 0; i < COUNT; i++) {
    try {
      const res = await createOrder({ variantPool, index: i+1 });
      ok++;
      const id = res?.order?.id || res?.id || 'dry';
      console.log(`[${i+1}/${COUNT}] Created order ${id}`);
    } catch (e) {
      fail++;
      console.warn(`[${i+1}/${COUNT}] Failed:`, e.message);
    }
    if (i < COUNT-1) await sleep(INTERVAL_MS);
  }
  console.log('Done. Success:', ok, 'Failed:', fail);
}

main().catch(err => { console.error(err); process.exit(1); });
