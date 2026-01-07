/**
 * Simple pub/sub event bus for cross-feature communication
 * All features communicate through this - no direct imports between features
 */
class EventBus {
  constructor() {
    this.listeners = {};
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name (e.g., 'calculator:result')
   * @param {Function} callback - Handler function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Emit an event with data
   * @param {string} event - Event name
   * @param {*} data - Data to pass to handlers
   */
  emit(event, data) {
    const handlers = this.listeners[event];
    if (handlers) {
      handlers.forEach(callback => callback(data));
    }
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler to remove
   */
  off(event, callback) {
    const handlers = this.listeners[event];
    if (handlers) {
      this.listeners[event] = handlers.filter(cb => cb !== callback);
    }
  }

  /**
   * Subscribe to an event once (auto-unsubscribes after first call)
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  }
}

// Singleton instance - all features share this
export const eventBus = new EventBus();

// Event name constants for type safety
export const EVENTS = {
  // Scene events (emitted by main scene.js)
  SCENE_READY: 'scene:ready',
  SCENE_COMPONENT_SELECTED: 'scene:component-selected',
  SCENE_COMPONENT_HOVERED: 'scene:component-hovered',
  SCENE_STACK_CHANGED: 'scene:stack-changed',

  // Calculator events
  CALCULATOR_CONFIG_CHANGED: 'calculator:config-changed',
  CALCULATOR_RESULT: 'calculator:result',
  CALCULATOR_EXPORT: 'calculator:export',

  // Stories events
  STORIES_LOAD_STACK: 'stories:load-stack',
  STORIES_HIGHLIGHT: 'stories:highlight-component',

  // Neutral mode events
  NEUTRAL_MODE_TOGGLED: 'neutral:mode-toggled',
  NEUTRAL_LEFT_CHANGED: 'neutral:left-stack-changed',
  NEUTRAL_BENCHMARK_LOADED: 'neutral:benchmark-loaded',
};

// Expose for non-module scripts (scene.js)
window.shipwithEventBus = eventBus;
window.shipwithEvents = EVENTS;
