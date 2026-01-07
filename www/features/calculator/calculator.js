/**
 * Calculator Feature - Production Architecture Cost Calculator
 * Calculates real costs and latency for different cloud architectures
 */

import { eventBus, EVENTS } from '../../shared/event-bus.js';

// State management
let state = {
  requests: 1000000, // 1M requests/month default
  storage: '10GB',
  regions: ['us'],
  currentStack: 'cloudflare',
  pricingData: null,
  isVisible: false
};

// Traffic presets (requests per month)
const TRAFFIC_PRESETS = [
  { value: 100000, label: '100K' },
  { value: 500000, label: '500K' },
  { value: 1000000, label: '1M' },
  { value: 5000000, label: '5M' },
  { value: 10000000, label: '10M' },
  { value: 50000000, label: '50M' },
  { value: 100000000, label: '100M' }
];

// Storage presets
const STORAGE_PRESETS = ['1GB', '10GB', '100GB', '1TB'];

// Region options
const REGIONS = [
  { id: 'us', label: 'US' },
  { id: 'eu', label: 'EU' },
  { id: 'asia', label: 'Asia' },
  { id: 'global', label: 'Global' }
];

let panelElement = null;

/**
 * Initialize the calculator feature
 */
export async function init() {
  console.log('[Calculator] Initializing...');

  // Load pricing data
  try {
    const response = await fetch('/features/calculator/pricing-data.json');
    state.pricingData = await response.json();
    console.log('[Calculator] Pricing data loaded');
  } catch (error) {
    console.error('[Calculator] Failed to load pricing data:', error);
    return;
  }

  // Load saved state from localStorage
  loadState();

  // Listen for tab clicks
  const tab = document.querySelector('.feature-tab[data-feature="calculator"]');
  if (tab) {
    tab.addEventListener('click', togglePanel);
  }

  // Listen for stack changes from scene
  eventBus.on(EVENTS.SCENE_STACK_CHANGED, (stack) => {
    console.log('[Calculator] Stack changed:', stack);
    state.currentStack = stack?.provider || 'cloudflare';
    if (state.isVisible) {
      recalculate();
    }
  });

  // Create panel (hidden initially)
  createPanel();

  console.log('[Calculator] Ready');
}

/**
 * Toggle panel visibility
 */
function togglePanel() {
  state.isVisible = !state.isVisible;

  const tab = document.querySelector('.feature-tab[data-feature="calculator"]');
  const panel = document.getElementById('calculator-panel');

  if (state.isVisible) {
    tab?.classList.add('active');
    panel?.classList.add('visible');
    recalculate();
  } else {
    tab?.classList.remove('active');
    panel?.classList.remove('visible');
  }
}

/**
 * Create the calculator panel
 */
function createPanel() {
  const container = document.getElementById('feature-panels');
  if (!container) return;

  const panel = document.createElement('div');
  panel.id = 'calculator-panel';
  panel.className = 'feature-panel';
  panel.setAttribute('data-feature', 'calculator');

  panel.innerHTML = `
    <div class="feature-panel-header">
      <h3 class="feature-panel-title">Cost Calculator</h3>
      <button class="feature-panel-close" aria-label="Close">&times;</button>
    </div>

    <div class="calculator-content">
      <!-- Traffic Slider -->
      <div class="form-group">
        <label class="form-label">Traffic</label>
        <input
          type="range"
          id="traffic-slider"
          class="range-slider"
          min="0"
          max="${TRAFFIC_PRESETS.length - 1}"
          value="2"
          step="1"
        />
        <div class="range-value" id="traffic-value">1M requests/month</div>
      </div>

      <!-- Storage Selector -->
      <div class="form-group">
        <label class="form-label">Storage</label>
        <select id="storage-select" class="form-select">
          ${STORAGE_PRESETS.map(size => `
            <option value="${size}" ${size === state.storage ? 'selected' : ''}>${size}</option>
          `).join('')}
        </select>
      </div>

      <!-- Region Checkboxes -->
      <div class="form-group">
        <label class="form-label">Regions</label>
        <div class="region-checkboxes">
          ${REGIONS.map(region => `
            <label class="checkbox-label">
              <input
                type="checkbox"
                value="${region.id}"
                ${state.regions.includes(region.id) ? 'checked' : ''}
              />
              <span>${region.label}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Results Card -->
      <div class="card results-card">
        <div class="results-header">
          <h4>Cost Breakdown</h4>
          <div class="provider-badge" data-provider="${state.currentStack}">
            ${getProviderName(state.currentStack)}
          </div>
        </div>

        <div class="cost-breakdown" id="cost-breakdown">
          <!-- Populated by recalculate() -->
        </div>

        <div class="total-cost">
          <span class="total-label">Total Monthly Cost</span>
          <span class="total-value" id="total-cost">$0.00</span>
        </div>

        <div class="latency-estimate">
          <span class="latency-label">Estimated p50 Latency</span>
          <span class="latency-value" id="latency-value">--ms</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="btn btn-primary" id="btn-export-terraform">
          <span>Export as Terraform</span>
        </button>
        <button class="btn btn-secondary" id="btn-share-url">
          <span>Share URL</span>
        </button>
      </div>

      <!-- Verification Badge -->
      <div class="verification-footer">
        <span class="verified-badge">Prices verified: ${state.pricingData?.lastVerified || 'N/A'}</span>
      </div>
    </div>
  `;

  container.appendChild(panel);
  panelElement = panel;

  // Attach event listeners
  attachEventListeners();

  // Initial calculation
  recalculate();
}

/**
 * Attach event listeners to panel elements
 */
function attachEventListeners() {
  if (!panelElement) return;

  // Close button
  const closeBtn = panelElement.querySelector('.feature-panel-close');
  closeBtn?.addEventListener('click', togglePanel);

  // Traffic slider
  const trafficSlider = panelElement.querySelector('#traffic-slider');
  trafficSlider?.addEventListener('input', (e) => {
    const index = parseInt(e.target.value);
    state.requests = TRAFFIC_PRESETS[index].value;
    updateTrafficDisplay();
    recalculate();
    saveState();
    emitConfigChanged();
  });

  // Storage selector
  const storageSelect = panelElement.querySelector('#storage-select');
  storageSelect?.addEventListener('change', (e) => {
    state.storage = e.target.value;
    recalculate();
    saveState();
    emitConfigChanged();
  });

  // Region checkboxes
  const regionCheckboxes = panelElement.querySelectorAll('.region-checkboxes input[type="checkbox"]');
  regionCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!state.regions.includes(e.target.value)) {
          state.regions.push(e.target.value);
        }
      } else {
        state.regions = state.regions.filter(r => r !== e.target.value);
      }
      // Ensure at least one region is selected
      if (state.regions.length === 0) {
        state.regions = ['us'];
        e.target.checked = true;
      }
      recalculate();
      saveState();
      emitConfigChanged();
    });
  });

  // Export Terraform button
  const exportBtn = panelElement.querySelector('#btn-export-terraform');
  exportBtn?.addEventListener('click', showTerraformExport);

  // Share URL button
  const shareBtn = panelElement.querySelector('#btn-share-url');
  shareBtn?.addEventListener('click', shareURL);

  // Close panel on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isVisible) {
      togglePanel();
    }
  });

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    if (!state.isVisible) return;

    const panel = document.getElementById('calculator-panel');
    const tab = document.querySelector('.feature-tab[data-feature="calculator"]');

    if (panel && !panel.contains(e.target) && !tab?.contains(e.target)) {
      togglePanel();
    }
  });
}

/**
 * Update traffic display
 */
function updateTrafficDisplay() {
  const slider = panelElement?.querySelector('#traffic-slider');
  const display = panelElement?.querySelector('#traffic-value');

  if (slider && display) {
    const index = parseInt(slider.value);
    const preset = TRAFFIC_PRESETS[index];
    display.textContent = `${preset.label} requests/month`;
  }
}

/**
 * Recalculate costs based on current configuration
 */
function recalculate() {
  if (!state.pricingData || !panelElement) return;

  const provider = state.currentStack;
  const providerData = state.pricingData.providers[provider];

  if (!providerData) {
    console.warn('[Calculator] No pricing data for provider:', provider);
    return;
  }

  const costs = calculateCosts(providerData);
  const latency = calculateLatency(providerData);

  // Update UI
  updateCostBreakdown(costs);
  updateTotalCost(costs.total);
  updateLatency(latency);

  // Update provider badge
  const badge = panelElement.querySelector('.provider-badge');
  if (badge) {
    badge.setAttribute('data-provider', provider);
    badge.textContent = getProviderName(provider);
  }
}

/**
 * Calculate costs for the given provider
 */
function calculateCosts(providerData) {
  const costs = {
    compute: 0,
    storage: 0,
    bandwidth: 0,
    database: 0,
    breakdown: []
  };

  const requestsPerMonth = state.requests;
  const storageGB = parseStorage(state.storage);

  // Compute costs (Workers/Lambda/Functions)
  if (providerData.workers) {
    const { freeRequests, pricePerMillion } = providerData.workers;
    const billableRequests = Math.max(0, requestsPerMonth - freeRequests);
    const cost = (billableRequests / 1000000) * pricePerMillion;
    costs.compute += cost;
    costs.breakdown.push({
      label: providerData.workers.name,
      cost,
      source: providerData.workers.source
    });
  } else if (providerData.lambda) {
    const { freeRequests, pricePerMillion, pricePerGBSecond, memoryMB, durationMs } = providerData.lambda;
    const billableRequests = Math.max(0, requestsPerMonth - freeRequests);
    const requestCost = (billableRequests / 1000000) * pricePerMillion;
    const memoryGB = memoryMB / 1024;
    const durationSeconds = durationMs / 1000;
    const computeCost = billableRequests * memoryGB * durationSeconds * pricePerGBSecond;
    const cost = requestCost + computeCost;
    costs.compute += cost;
    costs.breakdown.push({
      label: providerData.lambda.name,
      cost,
      source: providerData.lambda.source
    });
  } else if (providerData.functions) {
    const { freeGBHours, pricePerGBHour, memoryMB, durationMs } = providerData.functions;
    const memoryGB = memoryMB / 1024;
    const durationHours = (durationMs / 1000) / 3600;
    const totalGBHours = requestsPerMonth * memoryGB * durationHours;
    const billableGBHours = Math.max(0, totalGBHours - freeGBHours);
    const cost = billableGBHours * pricePerGBHour;
    costs.compute += cost;
    costs.breakdown.push({
      label: providerData.functions.name,
      cost,
      source: providerData.functions.source
    });
  }

  // Storage costs (KV/DynamoDB/EdgeConfig/Firestore)
  if (providerData.kv) {
    const { storage } = providerData.kv;
    const billableGB = Math.max(0, storageGB - storage.freeGB);
    const cost = billableGB * storage.pricePerGB;
    costs.storage += cost;
    costs.breakdown.push({
      label: providerData.kv.name,
      cost,
      source: providerData.kv.source
    });
  } else if (providerData.dynamodb) {
    const { storage } = providerData.dynamodb;
    const billableGB = Math.max(0, storageGB - storage.freeGB);
    const cost = billableGB * storage.pricePerGB;
    costs.storage += cost;
    costs.breakdown.push({
      label: providerData.dynamodb.name,
      cost,
      source: providerData.dynamodb.source
    });
  } else if (providerData.blob) {
    const { storage } = providerData.blob;
    const billableGB = Math.max(0, storageGB - storage.freeGB);
    const cost = billableGB * storage.pricePerGB;
    costs.storage += cost;
    costs.breakdown.push({
      label: providerData.blob.name,
      cost,
      source: providerData.blob.source
    });
  } else if (providerData.firestore) {
    const { storage } = providerData.firestore;
    const billableGB = Math.max(0, storageGB - storage.freeGB);
    const cost = billableGB * storage.pricePerGB;
    costs.storage += cost;
    costs.breakdown.push({
      label: providerData.firestore.name,
      cost,
      source: providerData.firestore.source
    });
  }

  // Database operations (reads/writes)
  if (providerData.d1) {
    const readsPerMonth = requestsPerMonth * 3; // Assume 3 reads per request
    const writesPerMonth = requestsPerMonth * 0.5; // Assume 0.5 writes per request
    const freeReadsPerMonth = providerData.d1.reads.freePerDay * 30;
    const freeWritesPerMonth = providerData.d1.writes.freePerDay * 30;
    const billableReads = Math.max(0, readsPerMonth - freeReadsPerMonth);
    const billableWrites = Math.max(0, writesPerMonth - freeWritesPerMonth);
    const readCost = (billableReads / 1000000) * providerData.d1.reads.pricePerMillion;
    const writeCost = (billableWrites / 1000000) * providerData.d1.writes.pricePerMillion;
    costs.database += readCost + writeCost;
    costs.breakdown.push({
      label: `${providerData.d1.name} Operations`,
      cost: readCost + writeCost,
      source: providerData.d1.source
    });
  }

  // Bandwidth/CDN costs
  const bandwidthGB = (requestsPerMonth * 50) / 1024; // Assume 50KB per response

  if (providerData.cdn && providerData.cdn.bandwidth.free) {
    // Cloudflare - free bandwidth
    costs.breakdown.push({
      label: 'Bandwidth (CDN)',
      cost: 0,
      source: providerData.cdn.source
    });
  } else if (providerData.cloudfront) {
    // AWS CloudFront
    const cost = bandwidthGB * providerData.cloudfront.bandwidth.tier1PricePerGB;
    costs.bandwidth += cost;
    costs.breakdown.push({
      label: 'CloudFront Bandwidth',
      cost,
      source: providerData.cloudfront.source
    });
  } else if (providerData.bandwidth) {
    // Vercel bandwidth
    const billableGB = Math.max(0, bandwidthGB - providerData.bandwidth.freeGB);
    const cost = billableGB * providerData.bandwidth.pricePerGB;
    costs.bandwidth += cost;
    costs.breakdown.push({
      label: 'Bandwidth',
      cost,
      source: providerData.bandwidth.source
    });
  }

  costs.total = costs.compute + costs.storage + costs.bandwidth + costs.database;

  return costs;
}

/**
 * Calculate estimated latency
 */
function calculateLatency(providerData) {
  if (!providerData.latency) return null;

  if (state.regions.includes('global') || state.regions.length > 2) {
    return providerData.latency.global;
  }

  // Average latency across selected regions
  const latencies = state.regions.map(region => providerData.latency[region] || 50);
  return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
}

/**
 * Update cost breakdown UI
 */
function updateCostBreakdown(costs) {
  const container = panelElement?.querySelector('#cost-breakdown');
  if (!container) return;

  container.innerHTML = costs.breakdown.map(item => `
    <div class="cost-item">
      <div class="cost-item-header">
        <span class="cost-label">${item.label}</span>
        <span class="cost-value">$${item.cost.toFixed(2)}</span>
      </div>
      ${item.source ? `
        <a href="${item.source}" target="_blank" class="source-link" title="View pricing source">
          Source
        </a>
      ` : ''}
    </div>
  `).join('');
}

/**
 * Update total cost display
 */
function updateTotalCost(total) {
  const display = panelElement?.querySelector('#total-cost');
  if (display) {
    display.textContent = `$${total.toFixed(2)}`;

    // Add color coding
    if (total === 0) {
      display.style.color = 'var(--color-success)';
    } else if (total < 10) {
      display.style.color = 'var(--color-warning)';
    } else {
      display.style.color = 'var(--text-primary)';
    }
  }
}

/**
 * Update latency display
 */
function updateLatency(latency) {
  const display = panelElement?.querySelector('#latency-value');
  if (display && latency !== null) {
    display.textContent = `${latency}ms`;

    // Add color coding
    if (latency < 30) {
      display.style.color = 'var(--color-success)';
    } else if (latency < 60) {
      display.style.color = 'var(--color-warning)';
    } else {
      display.style.color = 'var(--color-error)';
    }
  }
}

/**
 * Show Terraform export modal
 */
function showTerraformExport() {
  const terraform = generateTerraform();

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'terraform-modal';
  modal.innerHTML = `
    <div class="terraform-modal-content">
      <div class="terraform-modal-header">
        <h3>Terraform Configuration</h3>
        <button class="feature-panel-close">&times;</button>
      </div>
      <div class="terraform-code">
        <pre><code>${escapeHtml(terraform)}</code></pre>
      </div>
      <div class="terraform-modal-footer">
        <button class="btn btn-primary" id="btn-copy-terraform">Copy to Clipboard</button>
        <button class="btn btn-secondary" id="btn-download-terraform">Download .tf</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Attach modal event listeners
  modal.querySelector('.feature-panel-close')?.addEventListener('click', () => {
    modal.remove();
  });

  modal.querySelector('#btn-copy-terraform')?.addEventListener('click', () => {
    navigator.clipboard.writeText(terraform).then(() => {
      alert('Terraform code copied to clipboard!');
    });
  });

  modal.querySelector('#btn-download-terraform')?.addEventListener('click', () => {
    const blob = new Blob([terraform], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.currentStack}-infrastructure.tf`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Emit event
  eventBus.emit(EVENTS.CALCULATOR_EXPORT, { terraform });
}

/**
 * Generate Terraform HCL code
 */
function generateTerraform() {
  const provider = state.currentStack;
  const traffic = formatNumber(state.requests);
  const costs = calculateCosts(state.pricingData.providers[provider]);

  let terraform = `# Generated by shipwith.dev Calculator
# Estimated cost: $${costs.total.toFixed(2)}/month for ${traffic} requests/month
# Configuration: ${state.storage} storage, ${state.regions.join(', ')} regions
# Generated: ${new Date().toISOString()}

`;

  switch (provider) {
    case 'cloudflare':
      terraform += generateCloudflareConfig();
      break;
    case 'aws':
      terraform += generateAWSConfig();
      break;
    case 'vercel':
      terraform += generateVercelConfig();
      break;
    case 'gcp':
      terraform += generateGCPConfig();
      break;
    default:
      terraform += '# Provider configuration not available\n';
  }

  return terraform;
}

/**
 * Generate Cloudflare Terraform config
 */
function generateCloudflareConfig() {
  return `terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

# Worker Script
resource "cloudflare_worker_script" "api" {
  account_id = var.account_id
  name       = "my-api-worker"
  content    = file("\${path.module}/worker.js")
}

# Workers KV Namespace
resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.account_id
  title      = "api-cache"
}

# D1 Database
resource "cloudflare_d1_database" "db" {
  account_id = var.account_id
  name       = "production-db"
}

# R2 Bucket
resource "cloudflare_r2_bucket" "storage" {
  account_id = var.account_id
  name       = "production-storage"
  location   = "auto"
}

# Worker Route
resource "cloudflare_worker_route" "api_route" {
  zone_id     = var.zone_id
  pattern     = "api.example.com/*"
  script_name = cloudflare_worker_script.api.name
}

variable "zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
}
`;
}

/**
 * Generate AWS Terraform config
 */
function generateAWSConfig() {
  return `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Lambda Function
resource "aws_lambda_function" "api" {
  filename         = "lambda.zip"
  function_name    = "my-api-function"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  memory_size     = 1024
  timeout         = 30

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.main.name
    }
  }
}

# Lambda IAM Role
resource "aws_iam_role" "lambda_role" {
  name = "lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# DynamoDB Table
resource "aws_dynamodb_table" "main" {
  name           = "production-table"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Environment = "production"
  }
}

# S3 Bucket
resource "aws_s3_bucket" "storage" {
  bucket = "my-production-storage"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cdn" {
  enabled = true

  origin {
    domain_name = aws_s3_bucket.storage.bucket_regional_domain_name
    origin_id   = "S3Origin"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3Origin"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
`;
}

/**
 * Generate Vercel Terraform config (note: limited Terraform support)
 */
function generateVercelConfig() {
  return `# Note: Vercel has limited Terraform support
# This configuration uses the Vercel API provider

terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.15"
    }
  }
}

provider "vercel" {
  api_token = var.vercel_api_token
}

variable "vercel_api_token" {
  description = "Vercel API Token"
  type        = string
  sensitive   = true
}

# Vercel Project
resource "vercel_project" "main" {
  name      = "my-app"
  framework = "nextjs"

  environment = [
    {
      key    = "NODE_ENV"
      value  = "production"
      target = ["production"]
    }
  ]
}

# Edge Config Store
resource "vercel_edge_config" "cache" {
  name = "production-cache"
}

# Note: Blob storage and Functions are configured in vercel.json
# See: https://vercel.com/docs/storage/vercel-blob
`;
}

/**
 * Generate GCP Terraform config
 */
function generateGCPConfig() {
  return `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

# Cloud Function
resource "google_cloudfunctions2_function" "api" {
  name     = "my-api-function"
  location = "us-central1"

  build_config {
    runtime     = "nodejs18"
    entry_point = "handler"
    source {
      storage_source {
        bucket = google_storage_bucket.functions.name
        object = google_storage_bucket_object.function_code.name
      }
    }
  }

  service_config {
    max_instance_count = 100
    available_memory   = "1Gi"
    timeout_seconds    = 60
  }
}

# Cloud Storage Bucket for Functions
resource "google_storage_bucket" "functions" {
  name     = "\${var.project_id}-functions"
  location = "US"
}

# Firestore Database
resource "google_firestore_database" "main" {
  project     = var.project_id
  name        = "(default)"
  location_id = "us-central"
  type        = "FIRESTORE_NATIVE"
}

# Cloud Storage Bucket for Assets
resource "google_storage_bucket" "storage" {
  name     = "\${var.project_id}-storage"
  location = "US"
}

# Cloud CDN
resource "google_compute_backend_bucket" "cdn" {
  name        = "cdn-backend"
  bucket_name = google_storage_bucket.storage.name
  enable_cdn  = true
}
`;
}

/**
 * Share current configuration via URL
 */
function shareURL() {
  const params = new URLSearchParams({
    requests: state.requests,
    storage: state.storage,
    regions: state.regions.join(','),
    provider: state.currentStack
  });

  const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

  navigator.clipboard.writeText(url).then(() => {
    // Show toast notification
    showToast('URL copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy URL:', err);
    // Fallback: show URL in prompt
    prompt('Copy this URL:', url);
  });
}

/**
 * Show toast notification
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('visible');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Save state to localStorage
 */
function saveState() {
  try {
    localStorage.setItem('calculator-config', JSON.stringify({
      requests: state.requests,
      storage: state.storage,
      regions: state.regions
    }));
  } catch (error) {
    console.warn('[Calculator] Failed to save state:', error);
  }
}

/**
 * Load state from localStorage
 */
function loadState() {
  try {
    const saved = localStorage.getItem('calculator-config');
    if (saved) {
      const config = JSON.parse(saved);
      state.requests = config.requests || state.requests;
      state.storage = config.storage || state.storage;
      state.regions = config.regions || state.regions;
    }

    // Check URL parameters
    const params = new URLSearchParams(window.location.search);
    if (params.has('requests')) {
      state.requests = parseInt(params.get('requests'));
    }
    if (params.has('storage')) {
      state.storage = params.get('storage');
    }
    if (params.has('regions')) {
      state.regions = params.get('regions').split(',');
    }
  } catch (error) {
    console.warn('[Calculator] Failed to load state:', error);
  }
}

/**
 * Emit config changed event
 */
function emitConfigChanged() {
  eventBus.emit(EVENTS.CALCULATOR_CONFIG_CHANGED, {
    requests: state.requests,
    storage: state.storage,
    regions: state.regions
  });
}

/**
 * Utility: Parse storage string to GB
 */
function parseStorage(storage) {
  const num = parseFloat(storage);
  if (storage.includes('TB')) {
    return num * 1024;
  }
  return num;
}

/**
 * Utility: Get provider display name
 */
function getProviderName(provider) {
  const names = {
    cloudflare: 'Cloudflare',
    aws: 'AWS',
    vercel: 'Vercel',
    gcp: 'Google Cloud'
  };
  return names[provider] || provider;
}

/**
 * Utility: Format large numbers
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toString();
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
