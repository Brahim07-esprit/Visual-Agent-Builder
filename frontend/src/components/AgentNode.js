import React from "react";
import { Handle, Position } from "reactflow";
import "./AgentNode.css";

function AgentNode({ data, isConnectable }) {
  return (
    <div className={`agent-node ${data.nodeType}`}>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />

      <div className="node-header">
        <span className="node-type-icon">
          {data.nodeType === "router" ? "🔀" : "📝"}
        </span>
        <span className="node-label">{data.label}</span>
      </div>

      <div className="node-content">
        <p className="node-prompt">{data.prompt?.substring(0, 50)}...</p>
        {data.nodeType === "router" && data.routingOptions && (
          <div className="routing-info">
            Routes: {data.routingOptions.length}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </div>
  );
}

export default AgentNode;
