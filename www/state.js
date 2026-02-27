// State management for Visual Architecture Canvas
// Wraps GraphSpec and provides reactive state updates

import { GraphSpec, NodeSpec, EdgeSpec } from './graph-model.js';
import {
    COMPONENT_SPECS,
    getComponentSpec,
    isTypeCompatible,
    getPortOffset,
    getTypeColor
} from './component-specs.js';

// Canvas state singleton
class CanvasState {
    constructor() {
        this.graph = new GraphSpec();
        this.selectedNodeIds = new Set();
        this.selectedEdgeIds = new Set();
        this.listeners = new Set();

        // Interaction state
        this.mode = 'idle'; // idle, dragging, connecting, panning, selecting
        this.dragStart = null;
        this.wirePreview = null;
        this.selectionBox = null;

        // Camera/viewport state
        this.pan = { x: 0, y: 0 };
        this.zoom = 1;
        this.minZoom = 0.25;
        this.maxZoom = 4;
    }

    // Subscribe to state changes
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // Notify all listeners
    notify() {
        for (const listener of this.listeners) {
            listener(this);
        }
    }

    // Add a node to the graph
    addNode(componentId, x, y) {
        const spec = getComponentSpec(componentId);
        if (!spec) {
            console.warn(`Unknown component: ${componentId}`);
            return null;
        }

        const node = new NodeSpec(componentId, { x, y });
        // Store display info from spec
        node.width = 180;
        node.height = 120;
        node.color = spec.color;
        node.name = spec.name;
        node.role = spec.role;
        node.icon = spec.icon;
        node.description = spec.description;
        node.category = spec.category;

        // Populate provider info from spec
        node.provider = {
            id: spec.metadata?.provider || null,
            name: spec.name,
            alternatives: spec.metadata?.alternatives || [],
        };

        // Override defaults from spec if available
        if (spec.defaultConfig) {
            node.config = { ...node.config, ...spec.defaultConfig };
        }

        this.graph.addNode(node);
        this.notify();
        return node;
    }

    // Remove a node and its connected edges
    removeNode(nodeId) {
        this.graph.removeNode(nodeId);
        this.selectedNodeIds.delete(nodeId);
        this.notify();
    }

    // Add an edge between two ports (using port IDs from specs)
    addEdge(sourceNodeId, sourcePortId, targetNodeId, targetPortId) {
        const sourceNode = this.graph.nodes.get(sourceNodeId);
        const targetNode = this.graph.nodes.get(targetNodeId);

        if (!sourceNode || !targetNode) {
            console.warn('Invalid node IDs for edge');
            return null;
        }

        const sourceSpec = getComponentSpec(sourceNode.componentId);
        const targetSpec = getComponentSpec(targetNode.componentId);

        if (!sourceSpec || !targetSpec) {
            console.warn('Component has no spec');
            return null;
        }

        const sourcePort = sourceSpec.outputs[sourcePortId];
        const targetPort = targetSpec.inputs[targetPortId];

        if (!sourcePort || !targetPort) {
            console.warn(`Invalid port: ${sourcePortId} or ${targetPortId}`);
            return null;
        }

        // Validate connection using type system
        if (!isTypeCompatible(sourcePort.type, targetPort.type)) {
            console.warn(`Type mismatch: ${sourcePort.type} -> ${targetPort.type}`);
            return null;
        }

        const edge = new EdgeSpec(sourceNodeId, sourcePortId, targetNodeId, targetPortId);
        edge.sourcePortType = sourcePort.type;
        edge.targetPortType = targetPort.type;

        this.graph.addEdge(edge);
        this.notify();
        return edge;
    }

    // Remove an edge
    removeEdge(edgeId) {
        this.graph.removeEdge(edgeId);
        this.selectedEdgeIds.delete(edgeId);
        this.notify();
    }

    // Selection management
    selectNode(nodeId, additive = false) {
        if (!additive) {
            this.selectedNodeIds.clear();
            this.selectedEdgeIds.clear();
        }
        this.selectedNodeIds.add(nodeId);
        this.notify();
    }

    selectEdge(edgeId, additive = false) {
        if (!additive) {
            this.selectedNodeIds.clear();
            this.selectedEdgeIds.clear();
        }
        this.selectedEdgeIds.add(edgeId);
        this.notify();
    }

    deselectAll() {
        this.selectedNodeIds.clear();
        this.selectedEdgeIds.clear();
        this.notify();
    }

    isNodeSelected(nodeId) {
        return this.selectedNodeIds.has(nodeId);
    }

    isEdgeSelected(edgeId) {
        return this.selectedEdgeIds.has(edgeId);
    }

    // Delete all selected items
    deleteSelected() {
        for (const edgeId of this.selectedEdgeIds) {
            this.graph.removeEdge(edgeId);
        }
        this.selectedEdgeIds.clear();

        for (const nodeId of this.selectedNodeIds) {
            this.graph.removeNode(nodeId);
        }
        this.selectedNodeIds.clear();

        this.notify();
    }

    // Move selected nodes by delta
    moveSelectedNodes(dx, dy) {
        for (const nodeId of this.selectedNodeIds) {
            const node = this.graph.nodes.get(nodeId);
            if (node) {
                node.position.x += dx;
                node.position.y += dy;
            }
        }
        this.graph.metadata.modified = Date.now();
        this.notify();
    }

    // Get node at canvas position (in world coordinates)
    getNodeAt(worldX, worldY) {
        const nodes = Array.from(this.graph.nodes.values()).reverse();
        for (const node of nodes) {
            const halfW = node.width / 2;
            const halfH = node.height / 2;
            if (worldX >= node.position.x - halfW &&
                worldX <= node.position.x + halfW &&
                worldY >= node.position.y - halfH &&
                worldY <= node.position.y + halfH) {
                return node;
            }
        }
        return null;
    }

    // Get port at position using new spec system
    getPortAt(worldX, worldY) {
        const portRadius = 10;
        const nodes = Array.from(this.graph.nodes.values());

        for (const node of nodes) {
            const spec = getComponentSpec(node.componentId);
            if (!spec) continue;

            // Check input ports
            for (const [portId, portSpec] of Object.entries(spec.inputs)) {
                const pos = this.getPortWorldPosition(node, portSpec.position, false);
                const dist = Math.hypot(worldX - pos.x, worldY - pos.y);
                if (dist <= portRadius) {
                    return {
                        node,
                        portId,
                        portSpec,
                        portType: portSpec.type,
                        isOutput: false,
                        x: pos.x,
                        y: pos.y
                    };
                }
            }

            // Check output ports
            for (const [portId, portSpec] of Object.entries(spec.outputs)) {
                const pos = this.getPortWorldPosition(node, portSpec.position, true);
                const dist = Math.hypot(worldX - pos.x, worldY - pos.y);
                if (dist <= portRadius) {
                    return {
                        node,
                        portId,
                        portSpec,
                        portType: portSpec.type,
                        isOutput: true,
                        x: pos.x,
                        y: pos.y
                    };
                }
            }
        }
        return null;
    }

    // Get port world position
    getPortWorldPosition(node, position, isOutput) {
        const offset = getPortOffset(position, node.width, node.height);
        return {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y
        };
    }

    // Get all ports for a node (for rendering)
    getNodePorts(node) {
        const spec = getComponentSpec(node.componentId);
        if (!spec) return { inputs: [], outputs: [] };

        const inputs = Object.entries(spec.inputs).map(([portId, portSpec]) => ({
            portId,
            ...portSpec,
            color: getTypeColor(portSpec.type),
            worldPos: this.getPortWorldPosition(node, portSpec.position, false)
        }));

        const outputs = Object.entries(spec.outputs).map(([portId, portSpec]) => ({
            portId,
            ...portSpec,
            color: getTypeColor(portSpec.type),
            worldPos: this.getPortWorldPosition(node, portSpec.position, true)
        }));

        return { inputs, outputs };
    }

    // Pan/zoom controls
    setPan(x, y) {
        this.pan.x = x;
        this.pan.y = y;
        this.notify();
    }

    adjustPan(dx, dy) {
        this.pan.x += dx;
        this.pan.y += dy;
        this.notify();
    }

    setZoom(zoom, pivotX = null, pivotY = null) {
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));

        if (pivotX !== null && pivotY !== null) {
            const zoomRatio = newZoom / this.zoom;
            this.pan.x = pivotX - (pivotX - this.pan.x) * zoomRatio;
            this.pan.y = pivotY - (pivotY - this.pan.y) * zoomRatio;
        }

        this.zoom = newZoom;
        this.notify();
    }

    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.pan.x) / this.zoom,
            y: (screenY - this.pan.y) / this.zoom
        };
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.zoom + this.pan.x,
            y: worldY * this.zoom + this.pan.y
        };
    }

    // Restore state from serialized JSON
    fromJSON(json) {
        this.graph = new GraphSpec();
        this.selectedNodeIds.clear();
        this.selectedEdgeIds.clear();

        if (json.id) this.graph.id = json.id;
        if (json.version) this.graph.version = json.version;
        if (json.name) this.graph.name = json.name;
        if (json.metadata) this.graph.metadata = { ...this.graph.metadata, ...json.metadata };

        for (const n of (json.nodes || [])) {
            const spec = getComponentSpec(n.componentId);
            if (!spec) continue;

            const node = new NodeSpec(n.componentId, n.position);
            node.id = n.id;
            node.width = 180;
            node.height = 120;
            node.color = spec.color;
            node.name = spec.name;
            node.role = spec.role;
            node.icon = spec.icon;
            node.description = spec.description;
            node.category = spec.category;

            // Restore config (merge with defaults for backward compat)
            if (n.config) {
                node.config = {
                    capacity: { ...node.config.capacity, ...n.config.capacity },
                    scaling: { ...node.config.scaling, ...n.config.scaling },
                    reliability: { ...node.config.reliability, ...n.config.reliability },
                    cost: { ...node.config.cost, ...n.config.cost },
                    latency: { ...node.config.latency, ...n.config.latency },
                };
            }

            // Restore provider
            if (n.provider) {
                node.provider = { ...node.provider, ...n.provider };
            } else {
                node.provider = {
                    id: spec.metadata?.provider || null,
                    name: spec.name,
                    alternatives: spec.metadata?.alternatives || [],
                };
            }

            this.graph.addNode(node);
        }

        for (const e of (json.edges || [])) {
            const edge = new EdgeSpec(e.source.nodeId, e.source.portId, e.target.nodeId, e.target.portId);
            edge.id = e.id;
            edge.label = e.label || null;

            // Restore edge config
            if (e.config) {
                edge.config = { ...edge.config, ...e.config };
            }

            // Restore port type info
            const sourceNode = this.graph.nodes.get(e.source.nodeId);
            const targetNode = this.graph.nodes.get(e.target.nodeId);
            if (sourceNode && targetNode) {
                const sourceSpec = getComponentSpec(sourceNode.componentId);
                const targetSpec = getComponentSpec(targetNode.componentId);
                if (sourceSpec && targetSpec) {
                    const srcPort = sourceSpec.outputs[e.source.portId];
                    const tgtPort = targetSpec.inputs[e.target.portId];
                    if (srcPort) edge.sourcePortType = srcPort.type;
                    if (tgtPort) edge.targetPortType = tgtPort.type;
                }
            }

            this.graph.addEdge(edge);
        }

        this.notify();
    }

    // Serialize for save/export
    toJSON() {
        return {
            id: this.graph.id,
            version: this.graph.version,
            name: this.graph.name,
            metadata: this.graph.metadata,
            nodes: Array.from(this.graph.nodes.values()).map(n => ({
                id: n.id,
                componentId: n.componentId,
                position: n.position,
                config: n.config,
                provider: n.provider,
            })),
            edges: Array.from(this.graph.edges.values()).map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                config: e.config,
            }))
        };
    }
}

// Export singleton
export const canvasState = new CanvasState();

// Expose on window for debugging
if (typeof window !== 'undefined') {
    window.canvasState = canvasState;
}
