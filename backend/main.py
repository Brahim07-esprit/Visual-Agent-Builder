from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Annotated
from typing_extensions import TypedDict

from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph.message import add_messages

from dotenv import load_dotenv
import os
import traceback

load_dotenv()

app = FastAPI(title="Agent Builder Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    llm = ChatOpenAI(model="gpt-4o-mini")
except Exception as e:
    print(f"Error initializing OpenAI: {str(e)}")
    try:
        llm = ChatOpenAI(model="gpt-3.5-turbo")
    except BaseException:
        print("Could not initialize any OpenAI model. Check your API key.")


class NodeData(BaseModel):
    label: str
    nodeType: str
    prompt: str
    routingOptions: Optional[List[Dict[str, str]]] = None


class Node(BaseModel):
    id: str
    type: str
    data: NodeData


class Edge(BaseModel):
    id: str
    source: str
    target: str


class GraphRequest(BaseModel):
    nodes: List[Node]
    edges: List[Edge]
    userInput: str


class GraphResponse(BaseModel):
    response: str
    executionPath: List[str]


class CodeExportRequest(BaseModel):
    nodes: List[Node]
    edges: List[Edge]


class CodeExportResponse(BaseModel):
    code: str


class State(TypedDict):
    messages: Annotated[list, add_messages]
    execution_path: list


def create_node_function(node_data: NodeData, node_id: str):

    if node_data.nodeType == "system":
        return None

    if node_data.nodeType == "router":
        def router_node(state: State):
            last_message = state["messages"][-1]
            router_prompt = node_data.prompt

            try:
                response = llm.invoke([SystemMessage(router_prompt), last_message])
                route_content = response.content.strip().lower()

                if node_data.routingOptions:
                    for option in node_data.routingOptions:
                        if option["keyword"].lower() in route_content:
                            state["execution_path"].append(node_id)
                            return {"next": option["targetNode"]}

                if node_data.routingOptions and len(node_data.routingOptions) > 0:
                    state["execution_path"].append(node_id)
                    return {"next": node_data.routingOptions[0]["targetNode"]}

                raise ValueError(f"No valid routing found for node {node_id}")
            except Exception as e:
                state["execution_path"].append(node_id)
                raise ValueError(f"Error in router node {node_id}: {str(e)}")

        return router_node
    else:
        def regular_node(state: State):
            last_message = state["messages"][-1]
            node_prompt = node_data.prompt

            try:
                response = llm.invoke([SystemMessage(node_prompt), last_message])
                state["execution_path"].append(node_id)
                return {"messages": [response]}
            except Exception as e:
                state["execution_path"].append(node_id)
                raise ValueError(f"Error in node {node_id}: {str(e)}")

        return regular_node


@app.post("/run-agent", response_model=GraphResponse)
async def run_agent(request: GraphRequest):
    try:
        validation_errors = []

        if not request.nodes:
            validation_errors.append("No nodes found in the graph")

        if not request.edges:
            validation_errors.append("No edges found in the graph")

        start_edges = [e for e in request.edges if e.source == "start"]
        if not start_edges:
            validation_errors.append("START node is not connected to any node")

        for node in request.nodes:
            if node.data.nodeType == "router":
                outgoing_edges = [e for e in request.edges if e.source == node.id]
                if not outgoing_edges:
                    validation_errors.append(f"Router '{node.data.label}' has no outgoing connections")

                if not node.data.routingOptions or len(node.data.routingOptions) == 0:
                    validation_errors.append(f"Router '{node.data.label}' has no routing rules configured")

                for option in (node.data.routingOptions or []):
                    target_exists = any(e.target == option["targetNode"] for e in outgoing_edges)
                    if not target_exists:
                        validation_errors.append(f"Router '{node.data.label}' has routing rule for '{option['targetNode']}' but no edge to that node")

        if validation_errors:
            raise ValueError("Graph validation failed:\n" + "\n".join(validation_errors))

        graph_builder = StateGraph(State)

        router_nodes = set()

        for node in request.nodes:
            if node.id not in ["start", "end"]:
                node_func = create_node_function(node.data, node.id)
                if node_func:
                    graph_builder.add_node(node.id, node_func)

                    if node.data.nodeType == "router":
                        router_nodes.add(node.id)

        for edge in request.edges:
            if edge.source == "start":
                graph_builder.add_edge(START, edge.target)
            elif edge.target == "end":
                graph_builder.add_edge(edge.source, END)
            elif edge.source in router_nodes:
                pass
            else:
                graph_builder.add_edge(edge.source, edge.target)

        for router_id in router_nodes:
            outgoing_edges = [e for e in request.edges if e.source == router_id]

            if outgoing_edges:
                routing_map = {edge.target: edge.target for edge in outgoing_edges}

                def make_router_func(rid):
                    def router_func(state):
                        next_node = state.get("next")
                        if not next_node:
                            router_node = next((n for n in request.nodes if n.id == rid), None)
                            router_name = router_node.data.label if router_node else rid
                            raise ValueError(f"Router '{router_name}' did not return a 'next' value")
                        return next_node
                    return router_func

                graph_builder.add_conditional_edges(
                    router_id,
                    make_router_func(router_id),
                    routing_map
                )

        try:
            graph = graph_builder.compile()
        except Exception as e:
            raise ValueError(f"Failed to compile graph: {str(e)}")

        initial_state = {
            "messages": [HumanMessage(request.userInput)],
            "execution_path": ["start"]
        }

        try:
            result = graph.invoke(initial_state)
        except Exception as e:
            raise ValueError(f"Error during graph execution: {str(e)}")

        final_message = result["messages"][-1].content
        if not isinstance(final_message, str):
            final_message = str(final_message)

        execution_path = result.get("execution_path", ["start"])
        execution_path.append("end")

        execution_path = [str(item) for item in execution_path]

        return GraphResponse(
            response=final_message,
            executionPath=execution_path
        )

    except ValueError as ve:
        print(f"Validation error: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(status_code=400, detail=f"Unexpected error: {str(e)}")


@app.post("/export-code", response_model=CodeExportResponse)
async def export_code(request: CodeExportRequest):
    try:
        code_lines = []

        code_lines.extend([
            "from typing import Annotated",
            "from typing_extensions import TypedDict",
            "from langchain_openai import ChatOpenAI",
            "",
            "from langgraph.graph import StateGraph, START, END",
            "from langchain_core.messages import HumanMessage, SystemMessage",
            "from langgraph.graph.message import add_messages",
            "",
            "from dotenv import load_dotenv",
            "load_dotenv()",
            "",
            "# Define the LLM",
            "llm = ChatOpenAI(model=\"gpt-4o-mini\")",
            "",
            "# Define the state of the graph",
            "class State(TypedDict):",
            "    messages: Annotated[list, add_messages]",
            "",
        ])

        node_functions = {}
        router_nodes = set()

        for node in request.nodes:
            if node.id not in ["start", "end"]:
                node_name = node.id.replace("-", "_")
                node_functions[node.id] = node_name

                if node.data.nodeType == "router":
                    router_nodes.add(node.id)
                    escaped_prompt = node.data.prompt.replace('"""', '\\"\\"\\""')

                    code_lines.extend([
                        f"# Router node: {node.data.label}",
                        f"def {node_name}(state: State):",
                        "    last_message = state[\"messages\"][-1]",
                        f"    router_prompt = \"\"\"",
                        f"{escaped_prompt}",
                        "    \"\"\"",
                        "    ",
                        "    response = llm.invoke([SystemMessage(router_prompt), last_message])",
                        "    print(response)",
                        "    route = response.content.strip().lower()",
                        "    "
                    ])

                    if node.data.routingOptions:
                        for i, option in enumerate(node.data.routingOptions):
                            if_statement = "if" if i == 0 else "elif"
                            code_lines.append(f"    {if_statement} \"{option['keyword']}\" in route:")
                            code_lines.append(f"        return {{\"next\": \"{option['targetNode']}\"}}")

                    if node.data.routingOptions:
                        code_lines.append(f"    else:")
                        code_lines.append(f"        return {{\"next\": \"{node.data.routingOptions[0]['targetNode']}\"}}")

                    code_lines.extend(["", ""])

                else:
                    escaped_prompt = node.data.prompt.replace('"""', '\\"\\"\\""')

                    code_lines.extend([
                        f"# Node: {node.data.label}",
                        f"def {node_name}(state: State):",
                        "    last_message = state[\"messages\"][-1]",
                        f"    prompt = \"\"\"",
                        f"{escaped_prompt}",
                        "    \"\"\"",
                        "    return {\"messages\": llm.invoke([SystemMessage(prompt), last_message])}",
                        "",
                        ""
                    ])

        code_lines.extend([
            "# Build the graph",
            "graph_builder = StateGraph(State)",
            "",
            "# Add nodes"
        ])

        for node_id, func_name in node_functions.items():
            code_lines.append(f"graph_builder.add_node(\"{node_id}\", {func_name})")

        code_lines.extend(["", "# Add edges"])

        for edge in request.edges:
            if edge.source == "start":
                code_lines.append(f"graph_builder.add_edge(START, \"{edge.target}\")")
            elif edge.target == "end":
                code_lines.append(f"graph_builder.add_edge(\"{edge.source}\", END)")
            elif edge.source not in router_nodes:
                code_lines.append(f"graph_builder.add_edge(\"{edge.source}\", \"{edge.target}\")")

        code_lines.append("")
        for router_id in router_nodes:
            outgoing_edges = [e for e in request.edges if e.source == router_id]
            if outgoing_edges:
                code_lines.append(f"# Conditional edges for router: {router_id}")
                code_lines.append(f"graph_builder.add_conditional_edges(")
                code_lines.append(f"    \"{router_id}\",")
                code_lines.append(f"    lambda x: x[\"next\"],")
                code_lines.append(f"    {{")

                for edge in outgoing_edges:
                    code_lines.append(f"        \"{edge.target}\": \"{edge.target}\",")

                code_lines.append(f"    }}")
                code_lines.append(f")")
                code_lines.append("")

        code_lines.extend([
            "# Compile the graph",
            "graph = graph_builder.compile()",
            "",
            "# Run the graph (example)",
            "if __name__ == \"__main__\":",
            "    # Example usage",
            "    response = graph.invoke({\"messages\": [HumanMessage(\"Your message here\")]})",
            "    print(response[\"messages\"][-1].content)"
        ])

        python_code = "\n".join(code_lines)

        return CodeExportResponse(code=python_code)

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
async def health_check():
    api_key = os.getenv("OPENAI_API_KEY")
    return {
        "status": "healthy",
        "openai_api_key_set": bool(api_key),
        "api_key_preview": api_key[:5] + "..." if api_key else None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
