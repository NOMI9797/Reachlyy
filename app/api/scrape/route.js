import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';

export async function POST(request) {
  try {
    const body = await request.json();
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
            
            while (runInfo.status === 'RUNNING' || runInfo.status === 'READY') {
              await new Promise(resolve => setTimeout(resolve, 1500)); // Check every 1.5 seconds
              runInfo = await client.run(run.id).get();
              checkCount++;
              
              // Gradually increase progress based on status and time
              if (runInfo.status === 'RUNNING') {
                progressValue = Math.min(40 + (checkCount * 8), 85); // Gradually increase to 85%
              } else {
                progressValue = Math.min(40 + (checkCount * 4), 60); // Slower increase for READY status
              }
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                progress: progressValue, 
                status: `Actor ${runInfo.status.toLowerCase()}... (${checkCount * 1.5}s elapsed)` 
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
            
            // Send final results
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              progress: 100, 
              status: 'Complete!', 
              items,
              completed: true 
            })}\n\n`));
            
            controller.close();
          } catch (error) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              progress: 0, 
              status: 'Error', 
              error: error.message,
              completed: true 
            })}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(stream, {
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

    return NextResponse.json({ items, runId: run.id });
  } catch (error) {
    console.error('Scrape API error', error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}


