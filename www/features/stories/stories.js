/**
 * Stack Stories Feature
 * Curated case studies of real production architectures
 */

import { eventBus, EVENTS } from '../../shared/event-bus.js';

let stories = [];
let currentFilters = {
  industry: 'all',
  scale: 'all'
};
let expandedStoryId = null;

/**
 * Initialize the Stories feature
 */
export function init() {
  console.log('[Stories] Initializing Stack Stories feature');

  const tab = document.querySelector('.feature-tab[data-feature="stories"]');
  if (!tab) {
    console.error('[Stories] Tab not found');
    return;
  }

  // Handle tab click
  tab.addEventListener('click', () => handleTabClick(tab));

  // Load filters from URL on init
  loadFiltersFromURL();
}

/**
 * Handle tab click - load data and show panel
 */
async function handleTabClick(tab) {
  // Toggle active state
  const wasActive = tab.classList.contains('active');

  // Deactivate all tabs
  document.querySelectorAll('.feature-tab').forEach(t => t.classList.remove('active'));

  // Hide all panels
  document.querySelectorAll('.feature-panel').forEach(p => p.classList.remove('visible'));

  if (wasActive) {
    // Close panel if already active
    return;
  }

  // Activate this tab
  tab.classList.add('active');

  // Load data if not loaded yet
  if (stories.length === 0) {
    await loadStories();
  }

  // Show or create panel
  showPanel();
}

/**
 * Load case studies from JSON
 */
async function loadStories() {
  try {
    const response = await fetch('/features/stories/case-studies.json');
    if (!response.ok) throw new Error('Failed to load case studies');

    const data = await response.json();
    stories = data.stories;
    console.log(`[Stories] Loaded ${stories.length} case studies`);
  } catch (error) {
    console.error('[Stories] Error loading case studies:', error);
    stories = [];
  }
}

/**
 * Show the stories panel
 */
function showPanel() {
  let panel = document.querySelector('.feature-panel[data-feature="stories"]');

  if (!panel) {
    panel = createPanel();
    document.getElementById('feature-panels').appendChild(panel);
  }

  // Render content
  renderPanel(panel);

  // Show panel with animation
  requestAnimationFrame(() => {
    panel.classList.add('visible');
  });
}

/**
 * Create the panel structure
 */
function createPanel() {
  const panel = document.createElement('div');
  panel.className = 'feature-panel';
  panel.setAttribute('data-feature', 'stories');

  panel.innerHTML = `
    <div class="feature-panel-header">
      <h2 class="feature-panel-title">Real Production Stacks</h2>
      <button class="feature-panel-close" aria-label="Close">&times;</button>
    </div>
    <div class="stories-content">
      <!-- Filter bar -->
      <div class="stories-filters">
        <div class="filter-group">
          <label class="filter-label">Industry</label>
          <div class="filter-pills">
            <button class="filter-pill active" data-filter="industry" data-value="all">All</button>
            <button class="filter-pill" data-filter="industry" data-value="saas">SaaS</button>
            <button class="filter-pill" data-filter="industry" data-value="e-commerce">E-commerce</button>
            <button class="filter-pill" data-filter="industry" data-value="dev-tools">Dev Tools</button>
          </div>
        </div>
        <div class="filter-group">
          <label class="filter-label">Scale</label>
          <div class="filter-pills">
            <button class="filter-pill active" data-filter="scale" data-value="all">All</button>
            <button class="filter-pill" data-filter="scale" data-value="startup">Startup</button>
            <button class="filter-pill" data-filter="scale" data-value="growth">Growth</button>
            <button class="filter-pill" data-filter="scale" data-value="enterprise">Enterprise</button>
          </div>
        </div>
      </div>

      <!-- Stories list -->
      <div class="stories-list"></div>

      <!-- Submit CTA -->
      <div class="stories-submit-cta">
        <div class="submit-cta-content">
          <h3>Share Your Stack</h3>
          <p>Help others learn from your production architecture</p>
          <a href="https://github.com/srigirishankar/shipwith.dev/issues/new?template=stack-submission.md&title=%5BStack%5D%20Company%20Name"
             target="_blank"
             rel="noopener noreferrer"
             class="btn btn-secondary">
            Submit Your Stack
          </a>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  const closeBtn = panel.querySelector('.feature-panel-close');
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('visible');
    document.querySelector('.feature-tab[data-feature="stories"]').classList.remove('active');
  });

  // Filter event listeners
  panel.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => handleFilterClick(pill, panel));
  });

  return panel;
}

/**
 * Handle filter pill click
 */
function handleFilterClick(pill, panel) {
  const filterType = pill.dataset.filter;
  const filterValue = pill.dataset.value;

  // Update active state
  const group = pill.closest('.filter-group');
  group.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');

  // Update filters
  currentFilters[filterType] = filterValue;

  // Update URL
  updateURL();

  // Re-render stories
  renderStories(panel);
}

/**
 * Render panel content
 */
function renderPanel(panel) {
  // Set filter pills to current state
  Object.entries(currentFilters).forEach(([filterType, value]) => {
    const pill = panel.querySelector(`.filter-pill[data-filter="${filterType}"][data-value="${value}"]`);
    if (pill) {
      const group = pill.closest('.filter-group');
      group.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    }
  });

  // Render stories
  renderStories(panel);
}

/**
 * Render the stories list
 */
function renderStories(panel) {
  const listContainer = panel.querySelector('.stories-list');
  const filteredStories = getFilteredStories();

  if (filteredStories.length === 0) {
    listContainer.innerHTML = `
      <div class="stories-empty">
        <p>No stories found for these filters.</p>
        <button class="btn btn-ghost" onclick="window.dispatchEvent(new CustomEvent('stories:reset-filters'))">
          Reset Filters
        </button>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filteredStories.map(story => createStoryCard(story)).join('');

  // Attach event listeners
  listContainer.querySelectorAll('.story-card').forEach(card => {
    const storyId = card.dataset.storyId;
    const story = stories.find(s => s.id === storyId);

    // Card click to expand/collapse
    card.addEventListener('click', (e) => {
      // Don't expand if clicking on interactive elements
      if (e.target.closest('.story-load-btn') || e.target.closest('.story-blog-link')) {
        return;
      }
      toggleStoryExpand(storyId, panel);
    });

    // Load stack button
    const loadBtn = card.querySelector('.story-load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadStack(story);
      });
    }

    // Stack badge hover to highlight component
    card.querySelectorAll('.stack-badge').forEach(badge => {
      badge.addEventListener('mouseenter', () => {
        const componentId = badge.dataset.componentId;
        if (componentId) {
          eventBus.emit(EVENTS.STORIES_HIGHLIGHT, { componentId, active: true });
        }
      });
      badge.addEventListener('mouseleave', () => {
        const componentId = badge.dataset.componentId;
        if (componentId) {
          eventBus.emit(EVENTS.STORIES_HIGHLIGHT, { componentId, active: false });
        }
      });
    });
  });
}

/**
 * Create HTML for a story card
 */
function createStoryCard(story) {
  const isExpanded = expandedStoryId === story.id;
  const verificationBadge = story.verified
    ? '<span class="badge badge-success">✓ Verified</span>'
    : '<span class="badge badge-info">Example</span>';

  const stackBadges = Object.entries(story.stack).map(([type, config]) => {
    const componentId = getComponentId(type, config.provider, config.service);
    return `<span class="stack-badge" data-component-id="${componentId}">${config.service}</span>`;
  }).join('');

  const expandedContent = isExpanded ? `
    <div class="story-expanded">
      <div class="story-section">
        <h4>Why This Stack</h4>
        <ul class="story-reasons">
          ${story.whyThisStack.map(reason => `<li>${reason}</li>`).join('')}
        </ul>
      </div>
      <div class="story-section">
        <h4>Key Metrics</h4>
        <div class="story-metrics">
          <div class="story-metric">
            <span class="metric-label">P99 Latency</span>
            <span class="metric-value">${story.metrics.p99Latency}</span>
          </div>
          <div class="story-metric">
            <span class="metric-label">Monthly Cost</span>
            <span class="metric-value">${story.metrics.monthlyInfra}</span>
          </div>
          <div class="story-metric">
            <span class="metric-label">Uptime</span>
            <span class="metric-value">${story.metrics.uptime}</span>
          </div>
        </div>
      </div>
      ${story.blogUrl ? `
        <a href="${story.blogUrl}"
           class="story-blog-link"
           target="_blank"
           rel="noopener noreferrer"
           onclick="event.stopPropagation()">
          Read Engineering Blog Post →
        </a>
      ` : ''}
      ${story.note ? `
        <p class="story-note">${story.note}</p>
      ` : ''}
    </div>
  ` : '';

  return `
    <div class="story-card ${isExpanded ? 'expanded' : ''}" data-story-id="${story.id}">
      <div class="story-header">
        <div class="story-company">
          <img src="${story.logo}" alt="${story.company}" class="story-logo" onerror="this.style.display='none'">
          <div class="story-company-info">
            <h3 class="story-company-name">${story.company}</h3>
            <p class="story-tagline">${story.tagline}</p>
          </div>
        </div>
        <div class="story-badges">
          ${verificationBadge}
        </div>
      </div>
      <div class="story-meta">
        <span class="story-traffic">${story.traffic}</span>
        <span class="story-scale">${formatScale(story.scale)}</span>
      </div>
      <div class="story-stack-badges">
        ${stackBadges}
      </div>
      <div class="story-actions">
        <button class="btn btn-secondary story-load-btn">Load This Stack</button>
      </div>
      ${expandedContent}
    </div>
  `;
}

/**
 * Toggle story expand/collapse
 */
function toggleStoryExpand(storyId, panel) {
  if (expandedStoryId === storyId) {
    expandedStoryId = null;
  } else {
    expandedStoryId = storyId;
  }
  renderStories(panel);
}

/**
 * Load a stack into the visualization
 */
function loadStack(story) {
  console.log('[Stories] Loading stack:', story.company);

  eventBus.emit(EVENTS.STORIES_LOAD_STACK, {
    stackId: story.id,
    stack: story.stack,
    company: story.company
  });

  // Show success feedback
  showLoadFeedback(story.company);
}

/**
 * Show feedback when stack is loaded
 */
function showLoadFeedback(companyName) {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = 'story-toast';
  toast.textContent = `Loaded ${companyName} stack`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * Get filtered stories based on current filters
 */
function getFilteredStories() {
  return stories.filter(story => {
    if (currentFilters.industry !== 'all' && story.industry !== currentFilters.industry) {
      return false;
    }
    if (currentFilters.scale !== 'all' && story.scale !== currentFilters.scale) {
      return false;
    }
    return true;
  });
}

/**
 * Map component type + provider + service to component ID for highlighting
 */
function getComponentId(type, provider, service) {
  // This mapping should match the actual component IDs in scene.js
  // For now, return a generic ID based on type
  const typeMap = {
    'compute': 'workers',
    'database': 'database',
    'cache': 'cache',
    'hosting': 'hosting',
    'queue': 'queue'
  };
  return typeMap[type] || type;
}

/**
 * Format scale for display
 */
function formatScale(scale) {
  return scale.charAt(0).toUpperCase() + scale.slice(1);
}

/**
 * Load filters from URL parameters
 */
function loadFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const industry = params.get('industry');
  const scale = params.get('scale');

  if (industry && ['all', 'saas', 'e-commerce', 'dev-tools'].includes(industry)) {
    currentFilters.industry = industry;
  }
  if (scale && ['all', 'startup', 'growth', 'enterprise'].includes(scale)) {
    currentFilters.scale = scale;
  }
}

/**
 * Update URL with current filters
 */
function updateURL() {
  const params = new URLSearchParams();

  if (currentFilters.industry !== 'all') {
    params.set('industry', currentFilters.industry);
  }
  if (currentFilters.scale !== 'all') {
    params.set('scale', currentFilters.scale);
  }

  const newURL = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;

  window.history.replaceState({}, '', newURL);
}

/**
 * Reset filters (called from empty state)
 */
window.addEventListener('stories:reset-filters', () => {
  currentFilters = { industry: 'all', scale: 'all' };
  updateURL();

  const panel = document.querySelector('.feature-panel[data-feature="stories"]');
  if (panel) {
    renderPanel(panel);
  }
});
