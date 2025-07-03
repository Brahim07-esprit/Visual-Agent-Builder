import React, { useState } from "react";
import axios from "axios";
import "./RunAgentModal.css";

function RunAgentModal({ nodes, edges, onClose }) {
  const [userInput, setUserInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [executionPath, setExecutionPath] = useState([]);

  const handleRun = async () => {
    if (!userInput.trim()) {
      setError("Please enter a message");
      return;
    }

    setIsRunning(true);
    setError("");
    setResponse("");
    setExecutionPath([]);

    try {
      const graphData = {
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
        userInput: userInput,
      };

      const result = await axios.post(
        "http://localhost:8000/run-agent",
        graphData,
      );

      const responseText =
        typeof result.data.response === "string"
          ? result.data.response
          : JSON.stringify(result.data.response);

      setResponse(responseText);

      const path = Array.isArray(result.data.executionPath)
        ? result.data.executionPath.map((item) => String(item))
        : [];

      setExecutionPath(path);
    } catch (err) {
      const errorMessage = err.response?.data?.detail
        ? typeof err.response.data.detail === "string"
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail)
        : "Error running agent. Please check your graph configuration.";

      setError(errorMessage);
      console.error("Error:", err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isRunning) {
      e.preventDefault();
      handleRun();
    }
  };

  const safeRender = (content) => {
    if (content === null || content === undefined) return "";
    return typeof content === "string" ? content : JSON.stringify(content);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="run-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Test Your Agent</h2>

        <div className="input-section">
          <label>Your Message:</label>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            rows={3}
            disabled={isRunning}
          />
        </div>

        {executionPath.length > 0 && (
          <div className="execution-path">
            <label>Execution Path:</label>
            <div className="path-nodes">
              {executionPath.map((nodeId, index) => {
                const node = nodes.find((n) => n.id === nodeId);
                const label = node?.data?.label || nodeId;
                return (
                  <React.Fragment key={nodeId}>
                    <div className="path-node">{safeRender(label)}</div>
                    {index < executionPath.length - 1 && (
                      <span className="path-arrow">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {response && (
          <div className="response-section">
            <label>Agent Response:</label>
            <div className="response-content">{safeRender(response)}</div>
          </div>
        )}

        {error && (
          <div className="error-section">
            <label>Error:</label>
            <div className="error-content">{safeRender(error)}</div>
          </div>
        )}

        <div className="modal-actions">
          <button className="run-btn" onClick={handleRun} disabled={isRunning}>
            {isRunning ? "Running..." : "Run Agent"}
          </button>
          <button className="close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default RunAgentModal;
