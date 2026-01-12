/**
 * Stack State Management for Single-Pane Architecture View
 *
 * Manages the current stack configuration, baseline for comparison,
 * and calculates diffs between configurations.
 */

// Stack presets - each defines the full technology stack
export const STACK_PRESETS = {
    cloudflare: {
        id: 'cloudflare',
        name: 'Cloudflare',
        icon: '☁️',
        color: '#F6821F',
        components: {
            workers: { id: 'cf-workers', name: 'Cloudflare Workers', color: '#F6821F' },
            pages: { id: 'cf-pages', name: 'Cloudflare Pages', color: '#F6821F' },
            kv: { id: 'cf-kv', name: 'Cloudflare KV', color: '#F6821F' },
            d1: { id: 'cf-d1', name: 'Cloudflare D1', color: '#F6821F' }
        },
        metrics: {
            cost: 0,
            latency: 20,
            locations: 300,
            uptime: 99.99
        }
    },
    aws: {
        id: 'aws',
        name: 'AWS',
        icon: '🔶',
        color: '#FF9900',
        components: {
            workers: { id: 'lambda-edge', name: 'Lambda@Edge', color: '#FF9900' },
            pages: { id: 'amplify', name: 'AWS Amplify', color: '#FF9900' },
            kv: { id: 'dynamodb', name: 'DynamoDB', color: '#FF9900' },
            d1: { id: 'aurora', name: 'Aurora Serverless', color: '#FF9900' }
        },
        metrics: {
            cost: 45,
            latency: 50,
            locations: 400,
            uptime: 99.99
        }
    },
    gcp: {
        id: 'gcp',
        name: 'Google Cloud',
        icon: '🔷',
        color: '#4285F4',
        components: {
            workers: { id: 'cloud-run', name: 'Cloud Run', color: '#4285F4' },
            pages: { id: 'firebase', name: 'Firebase Hosting', color: '#FFCA28' },
            kv: { id: 'firestore', name: 'Firestore', color: '#FFCA28' },
            d1: { id: 'cloud-sql', name: 'Cloud SQL', color: '#4285F4' }
        },
        metrics: {
            cost: 35,
            latency: 45,
            locations: 35,
            uptime: 99.95
        }
    },
    azure: {
        id: 'azure',
        name: 'Azure',
        icon: '🔵',
        color: '#0078D4',
        components: {
            workers: { id: 'azure-functions', name: 'Azure Functions', color: '#0078D4' },
            pages: { id: 'static-web-apps', name: 'Static Web Apps', color: '#0078D4' },
            kv: { id: 'cosmos-db', name: 'Cosmos DB', color: '#0078D4' },
            d1: { id: 'azure-sql', name: 'Azure SQL', color: '#0078D4' }
        },
        metrics: {
            cost: 55,
            latency: 55,
            locations: 60,
            uptime: 99.95
        }
    },
    custom: {
        id: 'custom',
        name: 'Custom',
        icon: '⚙️',
        color: '#10B981',
        components: {}, // Filled from overrides
        metrics: {} // Calculated from component selections
    }
};

// Per-component metrics for custom stack calculations
export const COMPONENT_METRICS = {
    // Edge Functions
    'cf-workers': { cost: 0, latency: 12, locations: 300 },
    'lambda-edge': { cost: 17, latency: 100, locations: 700 },
    'cloud-run': { cost: 15, latency: 50, locations: 35 },
    'azure-functions': { cost: 20, latency: 50, locations: 60 },
    'vercel-edge': { cost: 15, latency: 30, locations: 200 },
    'deno-deploy': { cost: 20, latency: 20, locations: 12 },

    // Static Hosting
    'cf-pages': { cost: 0, latency: 10, locations: 300 },
    'amplify': { cost: 3, latency: 15, locations: 450 },
    'firebase': { cost: 0, latency: 15, locations: 100 },
    'static-web-apps': { cost: 0, latency: 15, locations: 60 },
    'vercel-hosting': { cost: 0, latency: 10, locations: 200 },
    'netlify': { cost: 0, latency: 12, locations: 100 },

    // KV Store
    'cf-kv': { cost: 0, latency: 5, locations: 300 },
    'dynamodb': { cost: 25, latency: 5, locations: 25 },
    'firestore': { cost: 10, latency: 20, locations: 35 },
    'cosmos-db': { cost: 30, latency: 10, locations: 60 },
    'upstash-redis': { cost: 5, latency: 5, locations: 200 },
    'momento': { cost: 10, latency: 5, locations: 50 },

    // Database
    'cf-d1': { cost: 0, latency: 20, locations: 300 },
    'aurora': { cost: 45, latency: 30, locations: 25 },
    'cloud-sql': { cost: 35, latency: 50, locations: 35 },
    'azure-sql': { cost: 55, latency: 40, locations: 60 },
    'turso': { cost: 5, latency: 5, locations: 100 },
    'neon': { cost: 10, latency: 8, locations: 20 },
    'planetscale': { cost: 40, latency: 50, locations: 15 }
};

/**
 * Calculate the diff between two metrics values
 */
export function calculateDiff(baseline, current) {
    if (baseline === current) return null;

    const diff = current - baseline;
    const percentChange = baseline !== 0 ? ((diff / baseline) * 100).toFixed(0) : (diff > 0 ? '+∞' : '0');

    return {
        absolute: diff,
        percent: percentChange,
        direction: diff > 0 ? 'increase' : 'decrease',
        isBetter: determineBetter(diff, 'cost') // Will be overridden per metric type
    };
}

/**
 * Determine if a change is "better" based on metric type
 * Lower is better for: cost, latency
 * Higher is better for: locations, uptime
 */
function determineBetter(diff, metricType) {
    const lowerIsBetter = ['cost', 'latency'];
    if (lowerIsBetter.includes(metricType)) {
        return diff < 0;
    }
    return diff > 0;
}

/**
 * Calculate metrics diff between baseline and current stack
 */
export function calculateMetricsDiff(baselineMetrics, currentMetrics) {
    const diffs = {};

    for (const [key, baseValue] of Object.entries(baselineMetrics)) {
        const currentValue = currentMetrics[key];
        if (currentValue === undefined) continue;

        const diff = currentValue - baseValue;
        const percent = baseValue !== 0 ? ((diff / baseValue) * 100) : 0;

        diffs[key] = {
            baseline: baseValue,
            current: currentValue,
            diff,
            percent: Math.round(percent),
            isBetter: determineBetter(diff, key),
            formatted: formatDiff(diff, percent, key)
        };
    }

    return diffs;
}

/**
 * Format a diff for display
 */
function formatDiff(diff, percent, metricType) {
    const sign = diff > 0 ? '+' : '';

    switch (metricType) {
        case 'cost':
            return `${sign}$${diff}/mo (${sign}${Math.round(percent)}%)`;
        case 'latency':
            return `${sign}${diff}ms (${sign}${Math.round(percent)}%)`;
        case 'locations':
            return `${sign}${diff} regions`;
        case 'uptime':
            return `${sign}${diff.toFixed(2)}%`;
        default:
            return `${sign}${diff}`;
    }
}

/**
 * Create the stack state manager
 */
export function createStackState(initialStack = 'cloudflare') {
    const state = {
        baseline: initialStack,
        current: initialStack,
        customOverrides: {},
        listeners: new Set()
    };

    return {
        /**
         * Get current state
         */
        getState() {
            return {
                baseline: state.baseline,
                current: state.current,
                customOverrides: { ...state.customOverrides }
            };
        },

        /**
         * Get the current stack configuration
         */
        getCurrentStack() {
            if (state.current === 'custom') {
                return this.getCustomStack();
            }
            return STACK_PRESETS[state.current];
        },

        /**
         * Get the baseline stack configuration
         */
        getBaselineStack() {
            return STACK_PRESETS[state.baseline];
        },

        /**
         * Build a custom stack from overrides
         */
        getCustomStack() {
            const base = STACK_PRESETS[state.baseline];
            const components = { ...base.components };

            // Apply overrides
            for (const [componentId, override] of Object.entries(state.customOverrides)) {
                components[componentId] = override;
            }

            // Calculate metrics from component selections
            const metrics = this.calculateCustomMetrics(components);

            return {
                id: 'custom',
                name: 'Custom Mix',
                icon: '⚙️',
                color: '#10B981',
                components,
                metrics
            };
        },

        /**
         * Calculate metrics for custom component selection
         */
        calculateCustomMetrics(components) {
            let totalCost = 0;
            let maxLatency = 0;
            let minLocations = Infinity;

            for (const comp of Object.values(components)) {
                const metrics = COMPONENT_METRICS[comp.id];
                if (metrics) {
                    totalCost += metrics.cost;
                    maxLatency = Math.max(maxLatency, metrics.latency);
                    minLocations = Math.min(minLocations, metrics.locations);
                }
            }

            return {
                cost: totalCost,
                latency: maxLatency,
                locations: minLocations === Infinity ? 0 : minLocations,
                uptime: 99.9 // Conservative estimate for mixed stacks
            };
        },

        /**
         * Switch to a different stack
         */
        switchStack(stackId) {
            if (!STACK_PRESETS[stackId]) {
                console.warn(`Unknown stack: ${stackId}`);
                return false;
            }

            const oldStack = state.current;
            state.current = stackId;

            if (stackId !== 'custom') {
                // Clear custom overrides when switching to a preset
                state.customOverrides = {};
            }

            this.notifyListeners({ type: 'stackChange', from: oldStack, to: stackId });
            return true;
        },

        /**
         * Set baseline for comparison
         */
        setBaseline(stackId) {
            if (!STACK_PRESETS[stackId]) {
                console.warn(`Unknown stack: ${stackId}`);
                return false;
            }

            state.baseline = stackId;
            this.notifyListeners({ type: 'baselineChange', baseline: stackId });
            return true;
        },

        /**
         * Override a specific component in custom mode
         */
        setComponentOverride(componentId, componentConfig) {
            state.customOverrides[componentId] = componentConfig;

            // Automatically switch to custom mode if not already
            if (state.current !== 'custom') {
                state.current = 'custom';
            }

            this.notifyListeners({
                type: 'componentOverride',
                componentId,
                config: componentConfig
            });
        },

        /**
         * Clear a component override (revert to baseline)
         */
        clearComponentOverride(componentId) {
            delete state.customOverrides[componentId];
            this.notifyListeners({
                type: 'componentOverrideCleared',
                componentId
            });
        },

        /**
         * Get diff between baseline and current
         */
        getDiff() {
            const baseline = this.getBaselineStack();
            const current = this.getCurrentStack();

            return calculateMetricsDiff(baseline.metrics, current.metrics);
        },

        /**
         * Get component-level diffs
         */
        getComponentDiffs() {
            const baseline = this.getBaselineStack();
            const current = this.getCurrentStack();
            const diffs = {};

            for (const [key, baseComp] of Object.entries(baseline.components)) {
                const currentComp = current.components[key];
                if (!currentComp) continue;

                const isChanged = baseComp.id !== currentComp.id;
                if (isChanged) {
                    const baseMetrics = COMPONENT_METRICS[baseComp.id] || {};
                    const currentMetrics = COMPONENT_METRICS[currentComp.id] || {};

                    diffs[key] = {
                        baseline: baseComp,
                        current: currentComp,
                        changed: true,
                        metrics: calculateMetricsDiff(baseMetrics, currentMetrics)
                    };
                }
            }

            return diffs;
        },

        /**
         * Subscribe to state changes
         */
        subscribe(listener) {
            state.listeners.add(listener);
            return () => state.listeners.delete(listener);
        },

        /**
         * Notify all listeners of state change
         */
        notifyListeners(event) {
            for (const listener of state.listeners) {
                try {
                    listener(event, this.getState());
                } catch (err) {
                    console.error('Stack state listener error:', err);
                }
            }
        },

        /**
         * Reset to default state
         */
        reset() {
            state.baseline = 'cloudflare';
            state.current = 'cloudflare';
            state.customOverrides = {};
            this.notifyListeners({ type: 'reset' });
        }
    };
}

// Singleton instance for global access
let globalStackState = null;

export function getStackState() {
    if (!globalStackState) {
        globalStackState = createStackState();
    }
    return globalStackState;
}

// Make available globally for scene.js
if (typeof window !== 'undefined') {
    window.StackState = {
        createStackState,
        getStackState,
        STACK_PRESETS,
        COMPONENT_METRICS,
        calculateDiff,
        calculateMetricsDiff
    };
}
