"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Maximize2, Save, Target, Undo2, Trash2, Play, Pause, X, AlertCircle } from "lucide-react";
import ReactFlow, { Background, Controls, MiniMap, addEdge, useEdgesState, useNodesState, MarkerType, BaseEdge, getBezierPath, Handle, Position, EdgeLabelRenderer } from "reactflow";
import "reactflow/dist/style.css";

const edgeStyle = { stroke: "#3b475e", strokeWidth: 5 };

function DelayEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = edgeStyle, data }) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const pill = data?.pill || "";
  const caption = data?.caption || "";
  const captionColor = data?.captionColor || "#94a3b8";
  const dashed = data?.dashed;
  const captionOnTop = data?.captionOnTop;
  return (
    <g>
      <BaseEdge id={id} path={path} style={{ ...style, strokeDasharray: dashed ? "4 4" : undefined }} />
      <EdgeLabelRenderer>
        <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'none', zIndex: 1000 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {captionOnTop && caption && (
              <div style={{ marginBottom: 6, color: captionColor, fontSize: 9, textAlign: 'center', whiteSpace: 'nowrap' }}>{caption}</div>
            )}
            {pill && (
              <div style={{ background: '#F87941', color: '#fff', borderRadius: 9999, fontSize: 9, padding: '6px 13px', lineHeight: 1, boxShadow: '0 0 0 2px rgba(15,23,42,0.15)', whiteSpace: 'nowrap' }}>{pill}</div>
            )}
            {!captionOnTop && caption && (
              <div style={{ marginTop: 6, color: captionColor, fontSize: 9, textAlign: 'center', whiteSpace: 'nowrap' }}>{caption}</div>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}

const nodeWrapperStyle = { boxShadow: 'none', background: 'transparent', border: 'none', padding: 0 };

const initialNodes = [
  { id: "start", position: { x: 250, y: 100 }, data: { label: "Start", icon: "🛈" }, type: "default", style: nodeWrapperStyle },
  { id: "invite", position: { x: 250, y: 300 }, data: { label: "Send invite", icon: "✉" }, style: nodeWrapperStyle },
  { id: "end", position: { x: 250, y: 500 }, data: { label: "End of sequence", isEnd: true, icon: "■" }, style: nodeWrapperStyle },
];

const initialEdges = [
  { id: "e-start-invite", source: "start", target: "invite", type: "delay", data: { pill: "Immediately" }, style: edgeStyle, markerEnd: { type: MarkerType.ArrowClosed, color: "#3b475e" } },
  { id: "e-invite-end", source: "invite", target: "end", type: "delay", data: { pill: "No delay" }, style: edgeStyle, markerEnd: { type: MarkerType.ArrowClosed, color: "#3b475e" } },
];

function DarkNode({ data, id }) {
  const isEnd = data?.isEnd;
  const [showDelete, setShowDelete] = useState(false);
  
  const handleDelete = (e) => {
    e.stopPropagation();
    const event = new CustomEvent('deleteNode', { detail: { nodeId: id } });
    window.dispatchEvent(event);
  };

  return (
    <div 
      className="relative min-w-[250px] group"
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <div className={`relative rounded-xl border ${isEnd ? "border-[#2b3447] bg-[#2a3446]" : "border-[#2b3447] bg-[#1c2434]"} px-5 py-4 shadow-none`} style={{ boxShadow: "none" }}>
        <div className="text-[12px] text-[#dbe4f3] font-medium flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#2f3a4e] text-[#c7d2fe] text-sm">{data?.icon || "◎"}</span>
          <span>{data?.label}</span>
        </div>
        {isEnd && (
          <div className="text-[9px] text-[#9aa6bd] mt-2">Withdraw requests if not accepted yet</div>
        )}
        
        {/* Delete button */}
        {showDelete && (
          <button
            onClick={handleDelete}
            className="absolute top-1/2 right-2 -translate-y-1/2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-all duration-200 z-10"
            title="Delete node"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <Handle type="target" position={Position.Top} style={{ width: 7, height: 7, background: "#64748b", borderRadius: 9999 }} />
      <Handle type="source" position={Position.Bottom} style={{ width: 7, height: 7, background: "#64748b", borderRadius: 9999 }} />
    </div>
  );
}

const nodeTypes = { default: DarkNode };
const edgeTypes = { delay: DelayEdge };

export default function SendInviteCanvas({ campaignName, campaignId }) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const rf = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [isDark, setIsDark] = useState(true);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Workflow state
  const [isRunning, setIsRunning] = useState(false);
  const [activationStatus, setActivationStatus] = useState(null);
  
  // Progress state for SSE
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Background mode state
  const [currentJobId, setCurrentJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const pollIntervalRef = useRef(null);

  const onInit = useCallback((instance) => {
    rf.current = instance;
    instance.fitView({ padding: 0.2 });
  }, []);

  const onConnect = useCallback((connection) => setEdges((eds) => addEdge({ ...connection, type: "smoothstep", style: edgeStyle, markerEnd: { type: MarkerType.ArrowClosed, color: "#596780" } }, eds)), [setEdges]);

  const zoomIn = () => rf.current?.zoomIn?.({ duration: 100 });
  const zoomOut = () => rf.current?.zoomOut?.({ duration: 100 });
  const fit = () => rf.current?.fitView?.({ padding: 0.2 });

  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  // Background workflow with polling
  const handleRunWorkflowBackground = async () => {
    if (!campaignId) {
      setActivationStatus({
        type: 'error',
        message: 'Campaign ID is required to run workflow'
      });
      return;
    }

    // Clear any old job data before starting new workflow
    localStorage.removeItem('currentJobId');
    localStorage.removeItem('currentCampaignId');

    setIsRunning(true);
    setActivationStatus(null);
    setProgress({ current: 0, total: 0 });
    setIsProcessing(true);

    try {
      // Start workflow (returns immediately)
      const response = await fetch(`/api/campaigns/${campaignId}/start-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customMessage: "Hi! I'd like to connect with you."
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle existing workflow case (409 Conflict)
        if (response.status === 409 && errorData.jobId) {
          console.log(`🔄 Found existing running job: ${errorData.jobId}`);
          
          // Check if it's for the same campaign or a different one
          if (errorData.isSameCampaign) {
            // Same campaign - resume polling
            setCurrentJobId(errorData.jobId);
            localStorage.setItem('currentJobId', errorData.jobId);
            localStorage.setItem('currentCampaignId', campaignId);
            
            setProgress({ 
              current: errorData.processedLeads || 0, 
              total: errorData.totalLeads || 0 
            });
            
            setActivationStatus({ 
              type: 'info', 
              message: '🔄 Workflow already running',
              details: `Resuming existing workflow (${errorData.progress || 0}% complete). Progress: ${errorData.processedLeads || 0}/${errorData.totalLeads || 0}`
            });
            
            // Start polling the existing job
            startPolling(errorData.jobId);
            return;
          } else {
            // Different campaign - show error and don't proceed
            setActivationStatus({ 
              type: 'warning', 
              message: '⚠️ Another workflow is running',
              details: `Workflow for campaign "${errorData.campaignName || 'Unknown'}" is currently running (${errorData.progress || 0}% complete). Please wait for it to finish before starting a new one.`
            });
            
            setIsRunning(false);
            setIsProcessing(false);
            return;
          }
        }
        
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const { jobId, message, campaignName: cName } = await response.json();
      setCurrentJobId(jobId);
      
      // Save to localStorage so we can resume if user navigates away
      localStorage.setItem('currentJobId', jobId);
      localStorage.setItem('currentCampaignId', campaignId);
      
      setActivationStatus({ 
        type: 'info', 
        message: message || 'Workflow started in background',
        details: 'You can close this page. The workflow will continue running on the server.'
      });

      console.log(`✅ Workflow started: Job ${jobId}`);

      // Start polling
      startPolling(jobId);

    } catch (error) {
      console.error('❌ Start workflow error:', error);
      setActivationStatus({ 
        type: 'error', 
        message: 'Failed to start workflow', 
        details: error.message 
      });
      setIsRunning(false);
      setIsProcessing(false);
    }
  };

  const startPolling = (jobId) => {
    console.log(`📊 Starting polling for job: ${jobId}`);
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/jobs/${jobId}/status`);
        
        if (!statusRes.ok) {
          console.error(`❌ Failed to fetch job status: ${statusRes.status}`);
          return;
        }
        
        const status = await statusRes.json();
        
        console.log(`📊 Poll result: ${status.status} - ${status.processedLeads}/${status.totalLeads}`);
        
        // Update status state
        setStatus(status);
        
        // Update progress
        setProgress({ 
          current: status.processedLeads || 0, 
          total: status.totalLeads || 0 
        });
        
        // Check if job is complete
        if (status.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsRunning(false);
          setIsProcessing(false);
          
          // Check if it was skipped (0 eligible leads or other no-op scenarios)
          if (status.results?.skipped) {
            setActivationStatus({
              type: 'info',
              message: '✅ Workflow completed - Nothing to do',
              details: status.results.message || 'All leads in this campaign have already been processed.'
            });
            console.log(`ℹ️  Workflow completed with no action needed`);
          } else {
            // Normal completion with results
            setActivationStatus({
              type: 'success',
              message: '✅ Workflow completed!',
              details: status.results ? 
                `Sent: ${status.results.sent}, Already Connected: ${status.results.alreadyConnected}, Already Pending: ${status.results.alreadyPending}, Failed: ${status.results.failed}` : 
                'Workflow completed successfully'
            });
            console.log(`🎉 Workflow completed!`);
          }
          
          console.log(`✅ Polling stopped - Job completed`);
          
          // Clear localStorage
          localStorage.removeItem('currentJobId');
          localStorage.removeItem('currentCampaignId');
          
        } else if (status.status === 'paused') {
          // STOP POLLING - Job is idle
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsRunning(false);
          setIsProcessing(false);
          
          setActivationStatus({
            type: 'info',
            message: '⏸️ Workflow paused',
            details: 'Click Resume to continue where you left off.'
          });
          
          console.log(`⏸️ Polling stopped - Job paused (idle state)`);
          
        } else if (status.status === 'cancelled') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsRunning(false);
          setIsProcessing(false);
          
          setActivationStatus({
            type: 'warning',
            message: '🛑 Workflow cancelled',
            details: 'Workflow was cancelled by user.'
          });
          
          // Reset all state after cancellation
          setCurrentJobId(null);
          setProgress({ current: 0, total: 0 });
          
          console.log(`🛑 Polling stopped - Job cancelled`);
          
          // Clear localStorage
          localStorage.removeItem('currentJobId');
          localStorage.removeItem('currentCampaignId');
          
          console.log(`🛑 Workflow cancelled`);
          
        } else if (status.status === 'failed' || status.status === 'timeout') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsRunning(false);
          setIsProcessing(false);
          
          const isTimeout = status.status === 'timeout';
          
          setActivationStatus({ 
            type: 'error', 
            message: isTimeout ? '⏱️ Workflow timed out' : '❌ Workflow failed', 
            details: status.errorMessage || (isTimeout ? 'The workflow took too long and may have crashed. Please try again.' : 'An error occurred during workflow execution.')
          });
          
          console.log(`❌ Polling stopped - Job ${isTimeout ? 'timed out' : 'failed'}`);
          
          // Clear localStorage
          localStorage.removeItem('currentJobId');
          localStorage.removeItem('currentCampaignId');
          
          console.error(`❌ Workflow ${status.status}: ${status.errorMessage}`);
        }
      } catch (pollError) {
        console.error('❌ Poll error:', pollError);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Pause workflow
  const handlePauseWorkflow = async () => {
    if (!currentJobId) return;
    
    try {
      const response = await fetch(`/api/jobs/${currentJobId}/pause`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to pause');
      }
      
      setActivationStatus({
        type: 'info',
        message: '⏸️ Workflow pausing...',
        details: 'The workflow will pause after the current batch completes.'
      });
    } catch (error) {
      console.error('❌ Pause error:', error);
      setActivationStatus({
        type: 'error',
        message: 'Failed to pause workflow',
        details: error.message
      });
    }
  };

  // Resume workflow
  const handleResumeWorkflow = async () => {
    if (!currentJobId) return;
    
    try {
      const response = await fetch(`/api/jobs/${currentJobId}/resume`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle concurrent workflow case
        if (response.status === 409) {
          setActivationStatus({
            type: 'warning',
            message: '⚠️ Another workflow is running',
            details: errorData.message
          });
          return;
        }
        
        throw new Error(errorData.error || 'Failed to resume');
      }
      
      setActivationStatus({
        type: 'info',
        message: '▶️ Workflow resumed',
        details: 'Continuing from where you left off...'
      });
      
      // Set processing state
      setIsRunning(true);
      setIsProcessing(true);
      
      // Restart polling for resumed job
      console.log(`🔄 Restarting polling for resumed job: ${currentJobId.substring(0, 8)}...`);
      startPolling(currentJobId);
      
    } catch (error) {
      console.error('❌ Resume error:', error);
      setActivationStatus({
        type: 'error',
        message: 'Failed to resume workflow',
        details: error.message
      });
    }
  };

  // Cancel workflow
  const handleCancelWorkflow = async () => {
    if (!currentJobId) return;
    
    const confirmCancel = window.confirm(
      'Are you sure? This will permanently cancel the workflow and you cannot resume it.'
    );
    
    if (!confirmCancel) return;
    
    try {
      const response = await fetch(`/api/jobs/${currentJobId}/cancel`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel');
      }
      
      setActivationStatus({
        type: 'warning',
        message: '🛑 Workflow cancelled',
        details: 'You can start a new workflow.'
      });
      
      // Reset all state
      setIsRunning(false);
      setIsProcessing(false);
      setCurrentJobId(null);
      setProgress({ current: 0, total: 0 });
      setStatus(null);
      
      // Clear localStorage
      localStorage.removeItem('currentJobId');
      localStorage.removeItem('currentCampaignId');
      
      // Stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    } catch (error) {
      console.error('❌ Cancel error:', error);
      setActivationStatus({
        type: 'error',
        message: 'Failed to cancel workflow',
        details: error.message
      });
    }
  };

  // Run Workflow function - uses SSE for real-time progress
  const handleRunWorkflow = async () => {
    if (!campaignId) {
      setActivationStatus({
        type: 'error',
        message: 'Campaign ID is required to run workflow'
      });
      return;
    }

    setIsRunning(true);
    setActivationStatus(null);
    setProgress({ current: 0, total: 0 });
    setIsProcessing(true);

    console.log(`🚀 Starting SSE workflow for campaign: ${campaignId}`);

    try {
      const response = await fetch(`/api/redis-workflow/campaigns/${campaignId}/activate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customMessage: "Hi there! I'd like to connect with you.",
          batchSize: 10
        })
      });

      console.log('📡 SSE Response:', { ok: response.ok, status: response.status });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null - streaming not supported');
      }

      console.log('📡 Starting to read SSE stream...');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventCount = 0;

      let reading = true;
      while (reading) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ SSE stream completed');
          reading = false;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventCount++;
            const jsonData = line.slice(6);
            
            try {
              const data = JSON.parse(jsonData);
              console.log(`📡 SSE Event #${eventCount}:`, data.type, data);

              if (data.type === 'start') {
                console.log(`🎬 START: ${data.total} leads, ${data.batches} batches`);
                setProgress({ current: 0, total: data.total });
              } 
              else if (data.type === 'progress') {
                console.log(`⏳ PROGRESS: ${data.current}/${data.total} (${data.percentage}%)`);
                setProgress({ current: data.current, total: data.total });
              } 
              else if (data.type === 'batch_delay') {
                console.log(`⏱️ DELAY: Waiting ${data.delayMinutes} min before batch ${data.nextBatch}`);
                setActivationStatus({
                  type: 'info',
                  message: `Waiting ${data.delayMinutes} minutes before next batch (${data.nextBatch}/${data.totalBatches})...`
                });
              }
              else if (data.type === 'limit_reached') {
                console.log(`⚠️ LIMIT REACHED: ${data.message}`);
                setActivationStatus({
                  type: 'warning',
                  message: data.message,
                  details: `${data.remaining} batches remaining. Resume tomorrow.`
                });
              }
              else if (data.type === 'complete') {
                console.log(`🎉 COMPLETE:`, data);
                setProgress({ current: data.total, total: data.total });
                setActivationStatus({
                  type: 'success',
                  message: `Workflow completed!`,
                  details: `Sent: ${data.sent}, Already Connected: ${data.alreadyConnected}, Already Pending: ${data.alreadyPending}, Failed: ${data.failed}`
                });
                setIsProcessing(false);
              } 
              else if (data.type === 'error') {
                console.log(`❌ ERROR:`, data.message);
                setActivationStatus({
                  type: 'error',
                  message: data.message,
                  details: data.details
                });
                setIsProcessing(false);
              }
            } catch (parseError) {
              console.error('❌ Failed to parse SSE JSON:', parseError);
            }
          }
        }
      }
      
      console.log(`✅ Total SSE events: ${eventCount}`);
    } catch (error) {
      console.error('❌ SSE Error:', error);
      setActivationStatus({
        type: 'error',
        message: 'Network error occurred while activating workflow',
        details: error.message
      });
      setIsProcessing(false);
    } finally {
      setIsRunning(false);
      console.log('🏁 Workflow execution finished');
    }
  };

  useEffect(() => {
    const detect = () => {
      const html = document.documentElement;
      const darkThemes = ['dark','business','night','dracula','forest','black','dim','sunset','halloween','synthwave','reachly-dark'];
      const lightThemes = ['light','corporate','cupcake','emerald','winter','lofi','pastel','bumblebee','garden','reachly'];
      const attrTheme = (html.getAttribute('data-theme') || document.body.getAttribute('data-theme') || '').toLowerCase();
      const hasDarkClass = html.classList.contains('dark') || document.body.classList.contains('dark');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDarkActive = attrTheme
        ? (darkThemes.includes(attrTheme) || /dark/i.test(attrTheme))
        : (hasDarkClass || prefersDark);
      setIsDark(isDarkActive);
    };
    detect();
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => detect();
    mql.addEventListener?.('change', handler);
    const obs = new MutationObserver(detect);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'], subtree: true });
    if (document.body) {
      obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    }
    return () => {
      mql.removeEventListener?.('change', handler);
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current?.requestFullscreen?.();
    }
  };

  // Handle fullscreen changes to ensure workflow fits properly
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        // In fullscreen, fit the workflow to the entire screen
        setTimeout(() => {
          if (rf.current) {
            rf.current.fitView({ padding: 0.05 });
          }
        }, 100);
      } else {
        // Exit fullscreen, fit back to normal view
        setTimeout(() => {
          if (rf.current) {
            rf.current.fitView({ padding: 0.1 });
          }
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle node deletion
  useEffect(() => {
    const handleDeleteNode = (event) => {
      const { nodeId } = event.detail;
      deleteNode(nodeId);
    };

    window.addEventListener('deleteNode', handleDeleteNode);
    return () => window.removeEventListener('deleteNode', handleDeleteNode);
  }, [deleteNode]);

  // Check for active jobs on mount (handles navigation back to campaign with paused job)
  useEffect(() => {
    const checkForActiveJob = async () => {
      if (!campaignId) return;
      
      try {
        console.log(`🔍 Checking for active jobs for campaign: ${campaignId.substring(0, 8)}...`);
        
        // Check database for any active job for this campaign
        const response = await fetch(`/api/campaigns/${campaignId}/active-job`);
        
        if (!response.ok) {
          console.log('No active job found or error checking');
          return;
        }
        
        const { job } = await response.json();
        
        if (job && ['processing', 'queued', 'paused'].includes(job.status)) {
          console.log(`✅ Found active job: ${job.id.substring(0, 8)}... | Status: ${job.status}`);
          
          // Restore job state
          setCurrentJobId(job.id);
          setStatus({ ...job, status: job.status });
          setIsRunning(job.status !== 'paused');
          setIsProcessing(job.status === 'processing');
          setProgress({ 
            current: job.processedLeads || 0, 
            total: job.totalLeads || 0 
          });
          
          // Save to localStorage
          localStorage.setItem('currentJobId', job.id);
          localStorage.setItem('currentCampaignId', campaignId);
          
          // Show appropriate status message
          if (job.status === 'paused') {
            setActivationStatus({
              type: 'info',
              message: '⏸️ Workflow paused',
              details: 'Click Resume to continue where you left off.'
            });
          } else {
            setActivationStatus({
              type: 'info',
              message: '🔄 Workflow in progress',
              details: `Processing ${job.processedLeads || 0}/${job.totalLeads || 0} leads`
            });
          }
          
          // Start polling
          startPolling(job.id);
        } else {
          console.log('No active jobs found for this campaign');
        }
      } catch (error) {
        console.error('❌ Error checking for active job:', error);
      }
    };
    
    checkForActiveJob();
    
    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        console.log('🧹 Cleaning up polling interval on unmount');
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [campaignId]);

  return (
    <div ref={containerRef} className={`w-full ${isFullscreen ? 'h-screen' : 'min-h-[1200px]'} ${isDark ? 'bg-gray-900' : 'bg-white/60'}`}>
      <div className={`${isFullscreen ? 'h-screen' : 'min-h-[1200px]'} relative p-5`}>
        <div className={`absolute inset-0 m-0 rounded-2xl ${isDark ? 'bg-gray-800 ring-gray-700' : 'bg-white ring-slate-300'} ring-1 shadow-inner overflow-hidden`}>        
        {/* Right vertical toolbar */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-50">
          <div className="flex flex-col items-stretch bg-[#0f172a]/90 border border-slate-700 rounded-2xl shadow-lg relative">
            <div className="tooltip tooltip-left" data-tip="Zoom in" role="tooltip">
              <button className="p-4 text-slate-200 hover:bg-white/5" onClick={zoomIn} aria-label="Zoom in" tabIndex={0}>
                <Plus className="h-6 w-6" />
              </button>
            </div>
            <div className="tooltip tooltip-left" data-tip="Center view" role="tooltip">
              <button className="p-4 text-slate-200 hover:bg-white/5" onClick={fit} aria-label="Center view" tabIndex={0}>
                <Target className="h-6 w-6" />
              </button>
            </div>
            <div className="tooltip tooltip-left" data-tip="Zoom out" role="tooltip">
              <button className="p-4 text-slate-200 hover:bg-white/5" onClick={zoomOut} aria-label="Zoom out" tabIndex={0}>
                <Minus className="h-6 w-6" />
              </button>
            </div>
            <div className="border-t border-slate-700 mx-4" />
            <div className="tooltip tooltip-left" data-tip={isFullscreen ? "Exit fullscreen" : "Fullscreen"} role="tooltip">
              <button className="p-4 text-slate-200 hover:bg-white/5" onClick={toggleFullscreen} aria-label="Fullscreen" tabIndex={0}>
                <Maximize2 className="h-6 w-6" />
              </button>
            </div>
            <div className="border-t border-slate-700 mx-4" />
            <div className="tooltip tooltip-left" data-tip="Save" role="tooltip">
              <button className="p-4 text-slate-200 hover:bg-white/5" onClick={() => { /* TODO: save handler */ }} aria-label="Save" tabIndex={0}>
                <Save className="h-6 w-6" />
              </button>
            </div>
            <div className="border-t border-slate-700 mx-4" />
            <div className="tooltip tooltip-left" data-tip="Back" role="tooltip">
              <button className="p-4 text-slate-200 hover:bg-white/5" onClick={() => {
                const params = new URLSearchParams();
                if (campaignId) params.set('campaignId', campaignId);
                if (campaignName) params.set('campaign', campaignName);
                router.push(`/dashboard/workflow?${params.toString()}`);
              }} aria-label="Back" tabIndex={0}>
                <Undo2 className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <ReactFlow
          key={`rf-${isDark ? 'dark' : 'light'}`}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={onInit}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          snapToGrid
          snapGrid={[16, 16]}
          minZoom={0.3}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          translateExtent={[[-200, 0], [2200, 3000]]}
          nodeExtent={[[-200, 50], [2200, 2950]]}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          selectNodesOnDrag={false}
          connectOnClick={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={true}
          preventScrolling={false}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: false,
            style: { stroke: "#94a3b8", strokeWidth: 5 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#94a3b8" },
          }}
          connectionLineStyle={{ stroke: "#94a3b8", strokeWidth: 5 }}
          className="react-flow__dark"
        >
          {/* Removed default ReactFlow controls to avoid bottom-left plus button */}
          <Background variant="dots" gap={18} size={1} color={isDark ? "#6b7280" : "#cbd5e1"} />
        </ReactFlow>
        {/* Progress Bar - Compact Top-Right */}
        {isProcessing && progress.total > 0 && (
          <div className="absolute top-4 right-4 z-[100] w-80">
            <div className="bg-base-100 rounded-lg shadow-xl border border-base-300 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-base-content flex items-center gap-1.5">
                  <span className="loading loading-spinner loading-xs text-primary"></span>
                  {progress.current === 0 && progress.total === 1 ? 'Connecting...' : 'Processing'}
                </span>
                <span className="text-xs font-mono font-semibold text-primary">
                  {progress.current === 0 && progress.total === 1 
                    ? '...' 
                    : `${progress.current}/${progress.total} (${Math.round((progress.current / progress.total) * 100)}%)`
                  }
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-300 ease-out"
                  style={{ 
                    width: progress.current === 0 && progress.total === 1 
                      ? '0%' 
                      : `${(progress.current / progress.total) * 100}%` 
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Status Display */}
        {activationStatus && !isProcessing && (
          <div className={`absolute top-4 left-4 right-4 z-50 alert ${
            activationStatus.type === 'success' ? 'alert-success' : 
            activationStatus.type === 'warning' ? 'alert-warning' :
            activationStatus.type === 'info' ? 'alert-info' : 'alert-error'
          } shadow-xl`}>
            <AlertCircle className="h-4 w-4" />
            <div>
              <div className="font-medium">{activationStatus.message}</div>
              {activationStatus.details && (
                <div className="text-xs opacity-75">{activationStatus.details}</div>
              )}
            </div>
          </div>
        )}

        {/* Bottom action bar */}
        <div className={`absolute left-0 right-0 bottom-0 px-6 h-16 ${isDark ? 'bg-[#0f172a] border-slate-700' : 'bg-slate-50 border-slate-200'} border-t flex items-center justify-between backdrop-blur-sm`}>
          <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'} max-w-2xl leading-relaxed`}>
            {campaignId ? (
              <>Campaign: <span className="font-medium">{campaignName}</span> (ID: {campaignId})</>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span>No campaign selected. Please navigate from a campaign to run this workflow.</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-sm text-slate-400 hover:text-slate-200" onClick={() => router.back()}>
              Back
            </button>
            
            {/* Run Background Button */}
            <button 
              className="btn btn-primary btn-sm px-4 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={handleRunWorkflowBackground}
              disabled={(currentJobId && ['processing', 'paused'].includes(status?.status)) || isRunning || !campaignId}
              title={
                !campaignId ? 'No campaign selected' :
                (currentJobId && ['processing', 'paused'].includes(status?.status))
                  ? 'A workflow is already running' 
                  : 'Run in background (survives browser close)'
              }
            >
              <Play className="h-4 w-4 mr-2" />
              Run Background
            </button>
            
            {/* Dynamic Stop/Resume Button */}
            <button 
              className={`btn btn-sm px-4 font-medium shadow-lg transition-all duration-200 ${
                status?.status === 'paused' ? 'btn-success' : 'btn-warning'
              }`}
              onClick={status?.status === 'paused' ? handleResumeWorkflow : handlePauseWorkflow}
              disabled={!currentJobId || !['processing', 'paused'].includes(status?.status)}
              title={
                status?.status === 'paused' ? 'Resume workflow' : 
                status?.status === 'processing' ? 'Pause workflow' : 
                'Only available when processing or paused'
              }
            >
              {status?.status === 'paused' ? (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Stop
                </>
              )}
            </button>
            
            {/* Cancel Button */}
            <button 
              className="btn btn-error btn-sm px-4 font-medium shadow-lg transition-all duration-200"
              onClick={handleCancelWorkflow}
              disabled={!currentJobId || !['processing', 'paused'].includes(status?.status)}
              title={
                (currentJobId && ['processing', 'paused'].includes(status?.status))
                  ? 'Permanently cancel workflow' 
                  : 'No active workflow to cancel'
              }
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
