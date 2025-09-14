import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';

interface ScrapeRequestBody {
  urls: string[];
  limitPerSource?: number;
  deepScrape?: boolean;
  rawData?: boolean;
  streamProgress?: boolean;
}

interface ApifyItem {
  sourceUrl: string;
  text?: string;
  content?: string;
  timestamp?: string;
  time?: string;
  postDate?: string;
  likeCount?: number;
  likes?: number;
  commentCount?: number;
  comments?: number;
  repostCount?: number;
  reposts?: number;
  shares?: number;
  postUrl?: string;
  url?: string;
  [key: string]: any;
}

interface ScrapeResponse {
  items: ApifyItem[];
  totalItems?: number;
  completed?: boolean;
  progress?: number;
  message?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ScrapeRequestBody = await request.json();
    const { urls, limitPerSource = 10, deepScrape = true, rawData = false, streamProgress = false } = body || {};

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

    // If streaming is requested, use Server-Sent Events
    if (streamProgress) {
      const encoder = new TextEncoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial progress
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress: 5, status: 'Initializing scraping...' })}\n\n`));
            
            // Simulate gradual progress during initialization
            for (let i = 10; i <= 25; i += 5) {
              await new Promise(resolve => setTimeout(resolve, 200));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                progress: i, 
                status: 'Preparing actor...' 
              })}\n\n`));
            }
            
            // Start the actor run
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress: 30, status: 'Starting actor...' })}\n\n`));
            const run = await client.actor('Wpp1BZ6yGWjySadk3').call(input);
            
            // Send progress update
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress: 40, status: 'Actor started, monitoring progress...' })}\n\n`));
            
            // Get the run status and wait for completion with gradual progress
            let runInfo = await client.run(run.id).get();
            let progressValue = 40;
            let checkCount = 0;
            
            while (runInfo && (runInfo.status === 'RUNNING' || runInfo.status === 'READY')) {
              await new Promise(resolve => setTimeout(resolve, 1500)); // Check every 1.5 seconds
              runInfo = await client.run(run.id).get();
              checkCount++;
              
              // Gradually increase progress based on status and time
              if (runInfo && runInfo.status === 'RUNNING') {
                progressValue = Math.min(40 + (checkCount * 8), 85); // Gradually increase to 85%
              } else {
                progressValue = Math.min(40 + (checkCount * 4), 60); // Slower increase for READY status
              }
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                progress: progressValue, 
                status: `Actor ${runInfo?.status?.toLowerCase() || 'unknown'}... (${checkCount * 1.5}s elapsed)` 
              })}\n\n`));
            }
            
            // Send progress update
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress: 90, status: 'Actor completed, processing results...' })}\n\n`));
            
            // Simulate processing time with gradual progress
            for (let i = 92; i <= 98; i += 2) {
              await new Promise(resolve => setTimeout(resolve, 300));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                progress: i, 
                status: 'Processing results...' 
              })}\n\n`));
            }
            
            // Fetch results
            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            
            // Add source URL tracking to each item
            const itemsWithSource = items.map((item, index) => {
              // Try to get sourceUrl from the item first
              if (item.sourceUrl) {
                return { ...item, sourceUrl: item.sourceUrl };
              }
              
              // Distribute items evenly across URLs
              const sourceIndex = Math.floor(index / Math.ceil(items.length / urls.length));
              const assignedUrl = urls[Math.min(sourceIndex, urls.length - 1)];
              
              return {
                ...item,
                sourceUrl: assignedUrl
              };
            });
            
            // Send final results
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              progress: 100, 
              status: 'Complete!', 
              items: itemsWithSource,
              completed: true 
            })}\n\n`));
            
            controller.close();
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              progress: 0, 
              status: 'Error', 
              error: errorMessage,
              completed: true 
            })}\n\n`));
            controller.close();
          }
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Regular non-streaming response
    const run = await client.actor('Wpp1BZ6yGWjySadk3').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Add source URL tracking to each item
    const itemsWithSource = items.map((item, index) => {
      // Try to get sourceUrl from the item first
      if (item.sourceUrl) {
        return { ...item, sourceUrl: item.sourceUrl };
      }
      
      // Distribute items evenly across URLs
      const sourceIndex = Math.floor(index / Math.ceil(items.length / urls.length));
      const assignedUrl = urls[Math.min(sourceIndex, urls.length - 1)];
      
      return {
        ...item,
        sourceUrl: assignedUrl
      };
    });

    return NextResponse.json({ items: itemsWithSource, runId: run.id });
  } catch (error) {
    console.error('Scrape API error', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


