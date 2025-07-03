import React, { useState, useEffect } from "react";
import "./NodeEditModal.css";

function NodeEditModal({ node, edges, nodes, onUpdate, onDelete, onClose }) {
  const [label, setLabel] = useState(node.data.label || "");
  const [prompt, setPrompt] = useState(node.data.prompt || "");
  const [routingOptions, setRoutingOptions] = useState(
    node.data.routingOptions || [],
  );

  useEffect(() => {
    if (node.data.nodeType === "router") {
      const outgoingEdges = edges.filter((e) => e.source === node.id);
      const connectedNodes = outgoingEdges
        .map((edge) => {
          const targetNode = nodes.find((n) => n.id === edge.target);
          return targetNode
            ? { nodeId: targetNode.id, label: targetNode.data.label }
            : null;
        })
        .filter(Boolean);

      if (routingOptions.length === 0 && connectedNodes.length > 0) {
        setRoutingOptions(
          connectedNodes.map((cn) => ({
            keyword: cn.label.toLowerCase(),
            targetNode: cn.nodeId,
            targetLabel: cn.label,
          })),
        );
      }
    }
  }, [node, edges, nodes, routingOptions.length]);

  const handleSave = () => {
    const updates = {
      label,
      prompt,
    };

    if (node.data.nodeType === "router") {
      updates.routingOptions = routingOptions;
    }

    onUpdate(node.id, updates);
  };

  const addRoutingOption = () => {
    const outgoingEdges = edges.filter((e) => e.source === node.id);
    if (outgoingEdges.length > 0) {
      const firstEdge = outgoingEdges[0];
      const targetNode = nodes.find((n) => n.id === firstEdge.target);

      setRoutingOptions([
        ...routingOptions,
        {
          keyword: "",
          targetNode: firstEdge.target,
          targetLabel: targetNode?.data.label || firstEdge.target,
        },
      ]);
    }
  };

  const updateRoutingOption = (index, field, value) => {
    const updated = [...routingOptions];
    updated[index][field] = value;

    if (field === "targetNode") {
      const targetNode = nodes.find((n) => n.id === value);
      updated[index].targetLabel = targetNode?.data.label || value;
    }

    setRoutingOptions(updated);
  };

  const removeRoutingOption = (index) => {
    setRoutingOptions(routingOptions.filter((_, i) => i !== index));
  };

  const availableTargets = edges
    .filter((e) => e.source === node.id)
    .map((edge) => {
      const targetNode = nodes.find((n) => n.id === edge.target);
      return { id: edge.target, label: targetNode?.data.label || edge.target };
    });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Edit {node.data.nodeType === "router" ? "Router" : "Node"}</h2>

        <div className="form-group">
          <label>Node Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter node label"
          />
        </div>

        <div className="form-group">
          <label>System Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder="Enter the system prompt for this node..."
          />
        </div>

        {node.data.nodeType === "router" && (
          <div className="form-group">
            <label>Routing Rules</label>
            <p className="help-text">
              Define keywords that will route to specific nodes. The router will
              check if the response contains these keywords.
            </p>

            {routingOptions.map((option, index) => (
              <div key={index} className="routing-option">
                <input
                  type="text"
                  value={option.keyword}
                  onChange={(e) =>
                    updateRoutingOption(index, "keyword", e.target.value)
                  }
                  placeholder="Keyword to match"
                />
                <select
                  value={option.targetNode}
                  onChange={(e) =>
                    updateRoutingOption(index, "targetNode", e.target.value)
                  }
                >
                  {availableTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </select>
                <button
                  className="remove-btn"
                  onClick={() => removeRoutingOption(index)}
                >
                  ✕
                </button>
              </div>
            ))}

            {availableTargets.length > 0 && (
              <button className="add-routing-btn" onClick={addRoutingOption}>
                + Add Routing Rule
              </button>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="delete-btn" onClick={() => onDelete(node.id)}>
            Delete Node
          </button>
          <div className="action-group">
            <button className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="save-btn" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NodeEditModal;
