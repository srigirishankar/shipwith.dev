/**
 * Neutral Mode Feature
 * Removes vendor bias and provides community-sourced benchmarks
 */

import { eventBus, EVENTS } from "../../shared/event-bus.js";

// State management
const state = {
  enabled: false,
  benchmarksLoaded: false,
  benchmarkData: null,
  votes: loadVotesFromStorage(),
  panelVisible: false,
};

// Load votes from localStorage
function loadVotesFromStorage() {
  try {
    const stored = localStorage.getItem("neutral-votes");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save votes to localStorage
function saveVotesToStorage() {
  try {
    localStorage.setItem("neutral-votes", JSON.stringify(state.votes));
  } catch (error) {
    console.warn("[Neutral] Failed to save votes:", error);
  }
}

// Load neutral mode state from URL or localStorage
function loadNeutralModeState() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("neutral")) {
    return urlParams.get("neutral") === "true";
  }

  try {
    const stored = localStorage.getItem("neutral-mode-enabled");
    return stored === "true";
  } catch {
    return false;
  }
}

// Save neutral mode state
function saveNeutralModeState(enabled) {
  try {
    localStorage.setItem("neutral-mode-enabled", enabled.toString());

    // Update URL parameter
    const url = new URL(window.location);
    if (enabled) {
      url.searchParams.set("neutral", "true");
    } else {
      url.searchParams.delete("neutral");
    }
    window.history.replaceState({}, "", url);
  } catch (error) {
    console.warn("[Neutral] Failed to save state:", error);
  }
}

// Load benchmarks data
async function loadBenchmarks() {
  if (state.benchmarksLoaded) {
    return state.benchmarkData;
  }

  try {
    const response = await fetch("/features/neutral/benchmarks.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.benchmarkData = await response.json();
    state.benchmarksLoaded = true;

    eventBus.emit(EVENTS.NEUTRAL_BENCHMARK_LOADED, state.benchmarkData);

    return state.benchmarkData;
  } catch (error) {
    console.error("[Neutral] Failed to load benchmarks:", error);
    return null;
  }
}

// Create the neutral mode panel
function createPanel() {
  const panel = document.createElement("div");
  panel.className = "feature-panel";
  panel.id = "neutral-panel";
  panel.setAttribute("data-feature", "neutral");

  panel.innerHTML = `
    <div class="feature-panel-header">
      <h2 class="feature-panel-title">Neutral Mode</h2>
      <button class="feature-panel-close" aria-label="Close panel">&times;</button>
    </div>

    <div class="neutral-content">
      <!-- Toggle Section -->
      <div class="neutral-toggle-section">
        <div class="toggle-container">
          <button class="toggle-switch" role="switch" aria-checked="false" aria-label="Enable neutral mode">
            <span class="toggle-track">
              <span class="toggle-thumb"></span>
            </span>
          </button>
          <div class="toggle-label">
            <div class="toggle-title">Enable Neutral Mode</div>
            <div class="toggle-description">Compare any two stacks side-by-side without vendor defaults</div>
          </div>
        </div>

        <div class="neutral-explainer">
          <p>When enabled, the left column unlocks for customization. Compare any provider against any other without bias toward a specific vendor.</p>
        </div>
      </div>

      <!-- Benchmarks Section -->
      <div class="neutral-section">
        <div class="section-header">
          <h3>Community Benchmarks</h3>
          <span class="badge badge-info">Real-world data</span>
        </div>
        <p class="section-description">Performance data sourced from the community. All numbers show variance, not fake precision.</p>

        <div class="benchmarks-container">
          <div class="benchmark-loading skeleton" style="height: 200px;"></div>
        </div>

        <div class="contribute-cta">
          <p>Have benchmark data to share?</p>
          <a href="https://github.com/srigirishankar/shipwith.dev/issues/new?template=benchmark.md"
             target="_blank"
             rel="noopener"
             class="btn btn-secondary btn-sm">
            Report Your Data
          </a>
        </div>
      </div>

      <!-- Migration Complexity Section -->
      <div class="neutral-section">
        <div class="section-header">
          <h3>Migration Complexity</h3>
          <span class="badge badge-warning">Community-rated</span>
        </div>
        <p class="section-description">Real estimates from developers who have done these migrations.</p>

        <div class="migrations-container">
          <div class="migration-loading skeleton" style="height: 150px;"></div>
        </div>
      </div>

      <!-- Data Quality Notice -->
      <div class="data-notice">
        <div class="notice-icon">ℹ️</div>
        <div class="notice-content">
          <strong>About this data:</strong> All benchmarks are community-sourced and may vary based on use case, payload size, and runtime version. Verified benchmarks have 5+ independent confirmations.
        </div>
      </div>
    </div>
  `;

  document.getElementById("feature-panels").appendChild(panel);
  return panel;
}

// Render benchmark cards
function renderBenchmarks(data) {
  const container = document.querySelector(
    "#neutral-panel .benchmarks-container",
  );
  if (!container || !data) return;

  const benchmarks = data.benchmarks;
  let html = "";

  Object.keys(benchmarks).forEach((key) => {
    const benchmark = benchmarks[key];
    const coldStart = benchmark.coldStart;
    const warmLatency = benchmark.warmLatency;

    if (!coldStart) return;

    const isVerified = coldStart.reports >= 5;
    const voteKey = `benchmark-${key}`;
    const votes = state.votes[voteKey] || { up: 0, down: 0, userVote: null };

    // Calculate bar chart percentage for cold start (normalized to 0-100% based on max 1000ms)
    const coldStartPercent = Math.min((coldStart.median / 1000) * 100, 100);
    const warmLatencyPercent = warmLatency
      ? Math.min((warmLatency.median / 100) * 100, 100)
      : 0;

    html += `
      <div class="benchmark-card" data-provider="${benchmark.provider}">
        <div class="benchmark-header">
          <h4 class="benchmark-title">${benchmark.displayName}</h4>
          ${isVerified ? '<span class="verified-badge">Verified</span>' : ""}
        </div>

        <div class="benchmark-metric">
          <div class="metric-name">Cold Start (p50)</div>
          <div class="metric-value">${coldStart.median}${coldStart.unit}</div>
          <div class="metric-bar">
            <div class="metric-bar-fill" style="width: ${coldStartPercent}%"></div>
          </div>
          <div class="metric-range">Range: ${coldStart.min}-${coldStart.max}${coldStart.unit} | p99: ${coldStart.p99}${coldStart.unit}</div>
        </div>

        ${
          warmLatency
            ? `
        <div class="benchmark-metric">
          <div class="metric-name">Warm Latency (p50)</div>
          <div class="metric-value">${warmLatency.median}${warmLatency.unit}</div>
          <div class="metric-bar">
            <div class="metric-bar-fill" style="width: ${warmLatencyPercent}%"></div>
          </div>
          <div class="metric-range">Range: ${warmLatency.min}-${warmLatency.max}${warmLatency.unit} | p99: ${warmLatency.p99}${warmLatency.unit}</div>
        </div>
        `
            : ""
        }

        <div class="benchmark-footer">
          <div class="benchmark-meta">
            <span class="meta-item">${coldStart.reports} reports</span>
            <span class="meta-item">Last: ${formatDate(coldStart.lastReport)}</span>
          </div>
          <div class="benchmark-votes">
            <button class="vote-btn vote-up ${votes.userVote === "up" ? "active" : ""}"
                    data-benchmark="${key}"
                    data-vote="up"
                    aria-label="Upvote">
              ↑ <span class="vote-count">${votes.up || 0}</span>
            </button>
            <button class="vote-btn vote-down ${votes.userVote === "down" ? "active" : ""}"
                    data-benchmark="${key}"
                    data-vote="down"
                    aria-label="Downvote">
              ↓ <span class="vote-count">${votes.down || 0}</span>
            </button>
          </div>
        </div>

        <a href="${coldStart.docsUrl}"
           target="_blank"
           rel="noopener"
           class="source-link">
          ${coldStart.source}
        </a>
      </div>
    `;
  });

  container.innerHTML = html;
  attachVoteHandlers();
}

// Render migration matrix
function renderMigrations(data) {
  const container = document.querySelector(
    "#neutral-panel .migrations-container",
  );
  if (!container || !data) return;

  const migrations = data.migrations;
  let html = "";

  migrations.forEach((migration) => {
    const difficultyDots =
      "●".repeat(migration.difficulty) + "○".repeat(5 - migration.difficulty);
    const difficultyClass =
      migration.difficulty <= 2
        ? "easy"
        : migration.difficulty === 3
          ? "medium"
          : "hard";

    html += `
      <div class="migration-card">
        <div class="migration-header">
          <div class="migration-path">
            <span class="path-from">${formatProviderName(migration.from)}</span>
            <span class="path-arrow">→</span>
            <span class="path-to">${formatProviderName(migration.to)}</span>
          </div>
          <div class="migration-difficulty ${difficultyClass}"
               data-tooltip="Difficulty: ${migration.difficulty}/5">
            <span class="difficulty-dots">${difficultyDots}</span>
            <span class="difficulty-label">${migration.difficulty}/5</span>
          </div>
        </div>

        <div class="migration-stats">
          <div class="stat">
            <span class="stat-value">~${migration.estimatedHours}h</span>
            <span class="stat-label">Est. time</span>
          </div>
          <div class="stat">
            <span class="stat-value">${migration.completions}</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat">
            <span class="stat-value">${migration.communityRating.toFixed(1)}/5</span>
            <span class="stat-label">Rating</span>
          </div>
        </div>

        <details class="migration-details">
          <summary>Challenges & Benefits</summary>
          <div class="migration-content">
            <div class="migration-challenges">
              <strong>Challenges:</strong>
              <ul>
                ${migration.challenges.map((c) => `<li>${c}</li>`).join("")}
              </ul>
            </div>
            <div class="migration-benefits">
              <strong>Benefits:</strong>
              <ul>
                ${migration.benefits.map((b) => `<li>${b}</li>`).join("")}
              </ul>
            </div>
            ${
              migration.resources.length > 0
                ? `
            <div class="migration-resources">
              <strong>Resources:</strong>
              <ul>
                ${migration.resources
                  .map(
                    (r) => `
                  <li><a href="${r.url}" target="_blank" rel="noopener">${r.title}</a></li>
                `,
                  )
                  .join("")}
              </ul>
            </div>
            `
                : ""
            }
          </div>
        </details>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Format provider name for display
function formatProviderName(slug) {
  const names = {
    "aws-lambda": "AWS Lambda",
    "cloudflare-workers": "CF Workers",
    "vercel-edge": "Vercel Edge",
    "deno-deploy": "Deno Deploy",
    "google-cloud-run": "Cloud Run",
    express: "Express.js",
  };
  return names[slug] || slug;
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

// Attach vote button handlers
function attachVoteHandlers() {
  const voteButtons = document.querySelectorAll("#neutral-panel .vote-btn");

  voteButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const benchmarkKey = btn.dataset.benchmark;
      const voteType = btn.dataset.vote;
      handleVote(benchmarkKey, voteType);
    });
  });
}

// Handle vote action
function handleVote(benchmarkKey, voteType) {
  const voteKey = `benchmark-${benchmarkKey}`;

  if (!state.votes[voteKey]) {
    state.votes[voteKey] = { up: 0, down: 0, userVote: null };
  }

  const vote = state.votes[voteKey];

  // If user already voted this way, remove vote
  if (vote.userVote === voteType) {
    vote[voteType]--;
    vote.userVote = null;
  }
  // If user voted opposite way, switch vote
  else if (vote.userVote) {
    vote[vote.userVote]--;
    vote[voteType]++;
    vote.userVote = voteType;
  }
  // New vote
  else {
    vote[voteType]++;
    vote.userVote = voteType;
  }

  saveVotesToStorage();

  // Update UI
  const card = document
    .querySelector(`[data-benchmark="${benchmarkKey}"]`)
    ?.closest(".benchmark-card");
  if (card) {
    const upBtn = card.querySelector(".vote-up");
    const downBtn = card.querySelector(".vote-down");

    upBtn.classList.toggle("active", vote.userVote === "up");
    downBtn.classList.toggle("active", vote.userVote === "down");

    upBtn.querySelector(".vote-count").textContent = vote.up || 0;
    downBtn.querySelector(".vote-count").textContent = vote.down || 0;
  }
}

// Toggle neutral mode
function toggleNeutralMode(enabled) {
  state.enabled = enabled;
  saveNeutralModeState(enabled);

  // Update toggle UI
  const toggle = document.querySelector("#neutral-panel .toggle-switch");
  if (toggle) {
    toggle.setAttribute("aria-checked", enabled.toString());
    toggle.classList.toggle("active", enabled);
  }

  // Emit event for other components to react
  eventBus.emit(EVENTS.NEUTRAL_MODE_TOGGLED, { enabled });

  console.log("[Neutral] Mode toggled:", enabled);
}

// Show panel
function showPanel() {
  const panel = document.getElementById("neutral-panel");
  if (!panel) return;

  // Hide other feature panels
  document.querySelectorAll(".feature-panel").forEach((p) => {
    if (p.id !== "neutral-panel") {
      p.classList.remove("visible");
    }
  });

  // Show this panel
  panel.classList.add("visible");
  state.panelVisible = true;

  // Load benchmarks if not already loaded
  if (!state.benchmarksLoaded) {
    loadBenchmarks().then((data) => {
      if (data) {
        renderBenchmarks(data);
        renderMigrations(data);
      }
    });
  }

  // Update active tab
  document.querySelectorAll(".feature-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.feature === "neutral");
  });
}

// Hide panel
function hidePanel() {
  const panel = document.getElementById("neutral-panel");
  if (panel) {
    panel.classList.remove("visible");
    state.panelVisible = false;
  }

  // Remove active tab
  document.querySelectorAll(".feature-tab").forEach((tab) => {
    if (tab.dataset.feature === "neutral") {
      tab.classList.remove("active");
    }
  });
}

// Initialize the feature
export function init() {
  console.log("[Neutral] Initializing feature...");

  // Create panel
  const panel = createPanel();

  // Load initial state
  state.enabled = loadNeutralModeState();

  // Set toggle initial state
  const toggle = panel.querySelector(".toggle-switch");
  if (toggle) {
    toggle.setAttribute("aria-checked", state.enabled.toString());
    toggle.classList.toggle("active", state.enabled);
  }

  // If neutral mode was enabled, notify on load
  if (state.enabled) {
    setTimeout(() => {
      eventBus.emit(EVENTS.NEUTRAL_MODE_TOGGLED, { enabled: true });
    }, 100);
  }

  // Attach event listeners

  // Tab click
  const tab = document.querySelector('.feature-tab[data-feature="neutral"]');
  if (tab) {
    tab.addEventListener("click", () => {
      if (state.panelVisible) {
        hidePanel();
      } else {
        showPanel();
      }
    });
  }

  // Close button
  const closeBtn = panel.querySelector(".feature-panel-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", hidePanel);
  }

  // Toggle switch
  if (toggle) {
    toggle.addEventListener("click", () => {
      toggleNeutralMode(!state.enabled);
    });

    // Keyboard accessibility
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleNeutralMode(!state.enabled);
      }
    });
  }

  // Close panel when clicking outside
  document.addEventListener("click", (e) => {
    if (
      state.panelVisible &&
      !panel.contains(e.target) &&
      !tab.contains(e.target)
    ) {
      hidePanel();
    }
  });

  // Close panel on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.panelVisible) {
      hidePanel();
    }
  });

  console.log("[Neutral] Feature initialized");
}
