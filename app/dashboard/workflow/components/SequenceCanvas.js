"use client";

import { useCallback, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RefreshCcw, Save, LayoutTemplate } from "lucide-react";
import ReactFlow, { Background, Controls, MiniMap, addEdge, Handle, Position, useEdgesState, useNodesState } from "reactflow";
import "reactflow/dist/style.css";

function BaseNode({ icon, title, subtitle, status = "pending", isStart = false }) {
  const getStatusColor = () => {
    switch (status) {
      case "completed": return "border-green-500 bg-green-50";
      case "running": return "border-blue-500 bg-blue-50";
      case "error": return "border-red-500 bg-red-50";
      default: return "border-gray-300 bg-white";
    }
  };

  return (
    <div className={`px-4 py-3 shadow-sm rounded-lg border-2 ${getStatusColor()} min-w-[200px]`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-900">{title}</div>
          {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
        </div>
        {isStart && (
          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
            START
          </div>
        )}
      </div>
    </div>
  );
}

const VisitNode = ({ data }) => (
  <div>
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <BaseNode 
      icon="👁️" 
      title="Visit Profile" 
      subtitle="View profile page" 
      status={data?.status}
      isStart={data?.isStart}
    />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const FollowNode = ({ data }) => (
  <div>
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <BaseNode 
      icon="➕" 
      title="Follow" 
      subtitle="Follow the user" 
      status={data?.status}
    />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const ConnectNode = ({ data }) => (
  <div>
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <BaseNode 
      icon="🤝" 
      title="Connect" 
      subtitle="Send connection request" 
      status={data?.status}
    />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const DelayNode = ({ data }) => (
  <div>
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <BaseNode 
      icon="⏱️" 
      title="Wait" 
      subtitle={data?.delay || "2-4 hours"} 
      status={data?.status}
    />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const MessageNode = ({ data }) => (
  <div>
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <BaseNode 
      icon="💬" 
      title="Message" 
      subtitle={data?.messageType || "Message 1"} 
      status={data?.status}
    />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const BranchNode = ({ data }) => (
  <div>
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <BaseNode 
      icon="🔀" 
      title="Branch" 
      subtitle={data?.condition || "Reply detected?"} 
      status={data?.status}
    />
    <Handle id="yes" type="source" position={Position.Right} className="w-3 h-3" />
    <Handle id="no" type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const nodeTypes = {
  visit: VisitNode,
  follow: FollowNode,
  connect: ConnectNode,
  wait: DelayNode,
  message: MessageNode,
  branch: BranchNode,
};

const initialNodes = [
  { id: "n1", type: "visit", position: { x: 300, y: 50 }, data: { status: "completed", isStart: true } },
  { id: "n2", type: "follow", position: { x: 300, y: 200 }, data: { status: "completed" } },
  { id: "n3", type: "connect", position: { x: 300, y: 350 }, data: { status: "running" } },
  { id: "n4", type: "wait", position: { x: 300, y: 500 }, data: { status: "pending", delay: "2-4 hours" } },
  { id: "n5", type: "message", position: { x: 300, y: 650 }, data: { status: "pending", messageType: "Follow-up message" } },
  { id: "n6", type: "branch", position: { x: 500, y: 650 }, data: { status: "pending", condition: "Reply detected?" } },
  { id: "n7", type: "message", position: { x: 700, y: 650 }, data: { status: "pending", messageType: "Reply to message" } },
  { id: "n8", type: "message", position: { x: 300, y: 800 }, data: { status: "pending", messageType: "No reply - continue" } },
];

const initialEdges = [
  { id: "e1-2", source: "n1", target: "n2", type: "smoothstep" },
  { id: "e2-3", source: "n2", target: "n3", type: "smoothstep" },
  { id: "e3-4", source: "n3", target: "n4", type: "smoothstep" },
  { id: "e4-5", source: "n4", target: "n5", type: "smoothstep" },
  { id: "e5-6", source: "n5", target: "n6", type: "smoothstep" },
  { id: "e6-7", source: "n6", sourceHandle: "yes", target: "n7", type: "smoothstep", label: "Yes" },
  { id: "e6-8", source: "n6", sourceHandle: "no", target: "n8", type: "smoothstep", label: "No" },
];

export default function SequenceCanvas() {
  const [fullscreen, setFullscreen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const wrapperRef = useRef(null);
  const rfInstance = useRef(null);

  const onInit = useCallback((instance) => {
    rfInstance.current = instance;
    instance.fitView({ padding: 0.2 });
  }, []);

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const handleZoomIn = () => rfInstance.current?.zoomIn?.({ duration: 100 });
  const handleZoomOut = () => rfInstance.current?.zoomOut?.({ duration: 100 });
  const handleReset = () => rfInstance.current?.fitView?.({ padding: 0.2 });
  const toggleFullscreen = () => setFullscreen((v) => !v);

  const onDragStartPalette = (event, type) => {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = rfInstance.current.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      const id = `n-${Date.now()}`;
      setNodes((nds) => nds.concat({ id, type, position, data: {} }));
    },
    [setNodes]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div className={`h-full w-full ${fullscreen ? "fixed inset-0 z-50 bg-base-100" : ""}`}>
      <div className="h-full flex">
        {/* Left Palette */}
        <div className="w-64 border-r border-base-300 p-4 bg-base-100 flex-shrink-0">
          <div className="text-sm font-semibold mb-3">Workflow Steps</div>
          <div className="grid grid-cols-1 gap-2">
            {[
              { type: "visit", label: "Visit Profile", emoji: "👁️" },
              { type: "follow", label: "Follow", emoji: "➕" },
              { type: "connect", label: "Connect", emoji: "🤝" },
              { type: "wait", label: "Wait", emoji: "⏱️" },
              { type: "message", label: "Message", emoji: "💬" },
              { type: "branch", label: "Branch", emoji: "🔀" },
            ].map((n) => (
              <div
                key={n.type}
                className="p-3 rounded border bg-base-100 hover:bg-base-200 cursor-grab active:cursor-grabbing select-none"
                draggable
                onDragStart={(e) => onDragStartPalette(e, n.type)}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span>{n.emoji}</span>
                  <span>{n.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" ref={wrapperRef}>
          {/* Vertical Toolbar */}
          <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
            <button className="btn btn-sm btn-square" onClick={handleZoomIn} title="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button className="btn btn-sm btn-square" onClick={handleReset} title="Reset position">
              <RefreshCcw className="h-4 w-4" />
            </button>
            <button className="btn btn-sm btn-square" onClick={handleZoomOut} title="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </button>
            <div className="divider my-1"></div>
            <button className="btn btn-sm btn-square" onClick={toggleFullscreen} title={fullscreen ? "Exit full screen" : "Enter full screen"}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button className="btn btn-sm btn-square" title="Save as template">
              <Save className="h-4 w-4" />
            </button>
            <button className="btn btn-sm btn-square" title="Back to templates">
              <LayoutTemplate className="h-4 w-4" />
            </button>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            nodeTypes={nodeTypes}
            fitView
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <MiniMap />
            <Controls showInteractive={false} />
            <Background variant="dots" gap={16} size={1} />
          </ReactFlow>
        </div>

        {/* Right Inspector placeholder */}
        <div className="w-80 border-l border-base-300 p-4 bg-base-100 flex-shrink-0">
          <div className="text-sm font-semibold mb-3">Configuration</div>
          <div className="text-xs text-base-content/60">Select a node to configure its settings.</div>
        </div>
      </div>
    </div>
  );
}


