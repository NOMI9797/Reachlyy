import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/libs/next-auth';
import { db } from '@/libs/db';
import { workflowJobs } from '@/libs/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * POST /api/jobs/[jobId]/pause
 * Pause a running workflow
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { jobId } = params;

    // Find the job and verify ownership
    const job = await db.query.workflowJobs.findFirst({
      where: and(
        eq(workflowJobs.id, jobId),
        eq(workflowJobs.userId, session.user.id)
      )
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Only allow pausing jobs that are currently processing
    if (job.status !== 'processing') {
      return NextResponse.json(
        { error: `Cannot pause job with status: ${job.status}` },
        { status: 400 }
      );
    }

    // Update job status to paused
    const updatedJob = await db.update(workflowJobs)
      .set({
        status: 'paused',
        pausedAt: new Date(),
        pauseCount: sql`${workflowJobs.pauseCount} + 1`
      })
      .where(eq(workflowJobs.id, jobId))
      .returning();

    console.log(`⏸️  Job paused: ${jobId.substring(0, 8)}... | Pause count: ${updatedJob[0].pauseCount}`);

    return NextResponse.json({
      success: true,
      jobId: updatedJob[0].id,
      status: updatedJob[0].status,
      pausedAt: updatedJob[0].pausedAt,
      pauseCount: updatedJob[0].pauseCount,
      processedLeads: updatedJob[0].processedLeads,
      totalLeads: updatedJob[0].totalLeads
    });

  } catch (error) {
    console.error('❌ Error pausing job:', error);
    return NextResponse.json(
      { error: 'Failed to pause job', details: error.message },
      { status: 500 }
    );
  }
}

