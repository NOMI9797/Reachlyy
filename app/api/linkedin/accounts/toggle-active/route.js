import { NextResponse } from 'next/server';
import LinkedInSessionManager from '@/libs/linkedin-session';
import { withAuth } from "@/libs/auth-middleware";

const sessionManager = new LinkedInSessionManager();

export const POST = withAuth(async (request, { user }) => {
  try {
    const { accountId, isActive } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Get all sessions
    const sessions = sessionManager.getAllSessions();
    
    // Find the target session
    const targetSession = sessions.find(session => session.sessionId === accountId);
    
    if (!targetSession) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (isActive) {
      // If activating this account, deactivate all others first
      for (const session of sessions) {
        if (session.sessionId !== accountId) {
          sessionManager.updateSessionStatus(session.sessionId, { isActive: false });
        }
      }
    }

    // Update the target session's active status
    sessionManager.updateSessionStatus(accountId, { isActive });

    return NextResponse.json({
      success: true,
      message: isActive ? 'Account activated' : 'Account deactivated',
      accountId,
      isActive
    });

  } catch (error) {
    console.error('Error toggling account status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
