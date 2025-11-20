export const STAGE_DESCRIPTIONS = {
  initializing: 'Initializing workflow...',
  connecting: 'Connecting to server...',
  starting: 'Starting to process lead...',
  navigating: 'Visiting profile...',
  checking: 'Checking connection status...',
  finding_button: 'Finding Connect button...',
  clicking: 'Clicking Connect button...',
  waiting_modal: 'Waiting for modal...',
  sending: 'Sending invitation...',
  completed: 'Invite sent successfully!',
  already_processed: 'Lead already processed',
  already_pending: 'Invite already pending',
  already_connected: 'Already connected',
  failed: 'Failed to process',
  processing: 'Processing...',
};

export const getStageDescription = (stage) => {
  if (!stage) {
    return 'Processing...';
  }

  return STAGE_DESCRIPTIONS[stage] || `Processing: ${stage}`;
};

