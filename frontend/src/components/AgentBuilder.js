import React, { useState, useCallback, useRef } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import "./AgentBuilder.css";
import AgentNode from "./AgentNode";
import NodeEditModal from "./NodeEditModal";
import RunAgentModal from "./RunAgentModal";
import axios from "axios";

const nodeTypes = {
  agentNode: AgentNode,
};

const initialNodes = [
  {
    id: "start",
    type: "input",
    data: { label: "START" },
    position: { x: 250, y: 50 },
    style: { backgroundColor: "#90EE90", fontWeight: "bold" },
  },
  {
    id: "end",
    type: "output",
    data: { label: "END" },
    position: { x: 250, y: 400 },
    style: { backgroundColor: "#FFB6C1", fontWeight: "bold" },
  },
];

function AgentBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeEdit, setShowNodeEdit] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [nodeCounter, setNodeCounter] = useState(1);
  const reactFlowWrapper = useRef(null);
  const { project } = useReactFlow();

  const onConnect = useCallback(
    (params) => {
      if (params.target === "start" || params.source === "end") {
        alert("Invalid connection: Cannot connect to START or from END");
        return;
      }
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData("nodeType");

      if (typeof type === "undefined" || !type) {
        return;
      }

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode = {
        id: `node_${nodeCounter}`,
        type: "agentNode",
        position,
        data: {
          label:
            type === "router" ? `Router ${nodeCounter}` : `Node ${nodeCounter}`,
          nodeType: type,
          prompt:
            type === "router"
              ? "You are a helpful assistant that can route messages to the correct node.\nReturn the name of the node to route to."
              : "You are a helpful assistant. Process the user message and respond appropriately.",
          routingOptions: type === "router" ? [] : undefined,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setNodeCounter(nodeCounter + 1);
    },
    [nodeCounter, project, setNodes],
  );

  const onNodeDoubleClick = useCallback((event, node) => {
    if (node.id === "start" || node.id === "end") return;
    setSelectedNode(node);
    setShowNodeEdit(true);
  }, []);

  const onNodeUpdate = useCallback(
    (nodeId, updates) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...updates,
              },
            };
          }
          return node;
        }),
      );
      setShowNodeEdit(false);
    },
    [setNodes],
  );

  const onNodeDelete = useCallback(
    (nodeId) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );
      setShowNodeEdit(false);
    },
    [setNodes, setEdges],
  );

  const validateGraph = () => {
    // Check if there's a path from START
    const hasStartConnection = edges.some((e) => e.source === "start");

    if (!hasStartConnection) {
      alert("Error: START node must be connected to at least one node");
      return false;
    }

    // Check if all non-START/END nodes have incoming edges
    const nonSpecialNodes = nodes.filter(
      (n) => n.id !== "start" && n.id !== "end",
    );
    for (const node of nonSpecialNodes) {
      const hasIncoming = edges.some((e) => e.target === node.id);
      if (!hasIncoming) {
        alert(`Error: Node "${node.data.label}" has no incoming connections`);
        return false;
      }
    }

    // Check router nodes have routing options configured
    const routerNodes = nodes.filter((n) => n.data.nodeType === "router");
    for (const router of routerNodes) {
      const outgoingEdges = edges.filter((e) => e.source === router.id);
      if (outgoingEdges.length === 0) {
        alert(
          `Error: Router "${router.data.label}" has no outgoing connections`,
        );
        return false;
      }

      if (
        !router.data.routingOptions ||
        router.data.routingOptions.length === 0
      ) {
        alert(
          `Error: Router "${router.data.label}" has no routing options configured`,
        );
        return false;
      }
    }

    return true;
  };

  const handleRunAgent = () => {
    if (validateGraph()) {
      setShowRunModal(true);
    }
  };

  const handleExportGraph = async () => {
    try {
      const exportData = {
        nodes: nodes.map((node) => {
          if (node.id === "start" || node.id === "end") {
            return {
              id: node.id,
              type: node.type || "custom",
              data: {
                label: node.data.label,
                nodeType: "system",
                prompt: "",
                routingOptions: [],
              },
            };
          }

          return {
            id: node.id,
            type: node.type || "custom",
            data: {
              label: node.data.label,
              nodeType: node.data.nodeType,
              prompt: node.data.prompt,
              routingOptions: node.data.routingOptions,
            },
          };
        }),
        edges: edges,
      };

      const response = await axios.post(
        "http://localhost:8000/export-code",
        exportData,
      );

      const blob = new Blob([response.data.code], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "agent.py";
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert("Python code exported successfully!");
    } catch (error) {
      console.error("Error exporting code:", error);
      alert(
        "Error exporting code: " +
          (error.response?.data?.detail || error.message),
      );
    }
  };

  const handleExportJSON = () => {
    const graphData = {
      nodes: nodes.filter((n) => n.id !== "start" && n.id !== "end"),
      edges: edges,
    };

    const dataStr = JSON.stringify(graphData, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = "agent-graph.json";

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const handleImportGraph = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const graphData = JSON.parse(e.target.result);

        setNodes(initialNodes);
        setEdges([]);

        const importedNodes = graphData.nodes.map((node) => ({
          ...node,
          position: node.position || { x: 250, y: 200 },
        }));

        setNodes((nds) => [...nds, ...importedNodes]);
        setEdges(graphData.edges || []);

        const maxNodeId = Math.max(
          ...importedNodes
            .map((n) => parseInt(n.id.replace("node_", "")) || 0)
            .filter((id) => !isNaN(id)),
        );
        setNodeCounter(maxNodeId + 1);

        alert("Graph imported successfully!");
      } catch (error) {
        alert("Error importing graph: " + error.message);
      }
    };

    reader.readAsText(file);
    event.target.value = null;
  };

  return (
    <div className="agent-builder">
      <div className="toolbar">
        <h1>Visual Agent Builder</h1>
        <div className="toolbar-actions">
          <button onClick={handleRunAgent} className="run-button">
            ▶ Run Agent
          </button>
          <button onClick={handleExportGraph} className="export-button">
            Export as Python
          </button>
          <button onClick={handleExportJSON} className="export-json-button">
            Export as JSON
          </button>
          <label htmlFor="import-file" className="import-button">
            Import Graph
            <input
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleImportGraph}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      <div className="builder-container">
        <div className="sidebar">
          <h3>Node Types</h3>
          <div
            className="node-type"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("nodeType", "regular");
              event.dataTransfer.effectAllowed = "move";
            }}
          >
            <div className="node-icon regular">📝</div>
            <span>Regular Node</span>
          </div>
          <div
            className="node-type"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("nodeType", "router");
              event.dataTransfer.effectAllowed = "move";
            }}
          >
            <div className="node-icon router">🔀</div>
            <span>Router Node</span>
          </div>

          <div className="instructions">
            <h4>Instructions:</h4>
            <ul>
              <li>Drag nodes to canvas</li>
              <li>Connect nodes by dragging from handles</li>
              <li>Double-click to edit node</li>
              <li>Router nodes can conditionally route to different paths</li>
            </ul>
          </div>
        </div>

        <div className="flow-container" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background variant="dots" gap={12} size={1} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {showNodeEdit && selectedNode && (
        <NodeEditModal
          node={selectedNode}
          edges={edges}
          nodes={nodes}
          onUpdate={onNodeUpdate}
          onDelete={onNodeDelete}
          onClose={() => setShowNodeEdit(false)}
        />
      )}

      {showRunModal && (
        <RunAgentModal
          nodes={nodes}
          edges={edges}
          onClose={() => setShowRunModal(false)}
        />
      )}
    </div>
  );
}

export default function AgentBuilderWithProvider() {
  return (
    <ReactFlowProvider>
      <AgentBuilder />
    </ReactFlowProvider>
  );
}
