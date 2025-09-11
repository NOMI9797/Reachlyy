import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';

export async function POST(request) {
  try {
    const body = await request.json();
    const { urls, limitPerSource = 10, deepScrape = true, rawData = false } = body || {};

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls must be a non-empty array' }, { status: 400 });
    }

    const token = process.env.APIFY_API_TOKEN || process.env.apify_api_token || process.env.APIFY_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN is not configured on the server' }, { status: 500 });
    }

    const client = new ApifyClient({ token });

    const input = {
      urls,
      limitPerSource,
      deepScrape,
      rawData,
    };

    const run = await client.actor('Wpp1BZ6yGWjySadk3').call(input);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    return NextResponse.json({ items, runId: run.id });
  } catch (error) {
    console.error('Scrape API error', error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}


