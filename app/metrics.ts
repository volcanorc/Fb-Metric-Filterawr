import Papa from "papaparse";

export type MetricKey =
  | "views"
  | "reach"
  | "engagement"
  | "reactions"
  | "comments"
  | "shares"
  | "totalClicks"
  | "otherClicks"
  | "photoClicks";

export type TableMetricKey = MetricKey | "engagementRate";
export type TableColumnId = "post" | "publishedAt" | TableMetricKey;
export type TableColumnWidths = Record<TableColumnId, number>;
export type RankingMetricKey =
  | "views"
  | "reach"
  | "engagement"
  | "reactions"
  | "comments"
  | "shares"
  | "totalClicks";
export type DashboardView = "table" | "bars" | "lines";
export type ChartGrouping = "post" | "day" | "week" | "month";
export type ChartMotionPhase = "idle" | "series-change" | "data-change";
export interface ChartMetricTransitionState {
  requestedMetrics: TableMetricKey[];
  renderedMetrics: TableMetricKey[];
  enteringMetrics: TableMetricKey[];
  exitingMetrics: TableMetricKey[];
  phase: ChartMotionPhase;
  revision: number;
}
export type DatePreset = "7d" | "30d" | "3m" | "6m" | "custom";
export const DEFAULT_DATE_PRESET: DatePreset = "30d";
export type NumericRange = { min?: number; max?: number };
export type SortBy = TableMetricKey | "overallPerformance" | "publishedAt";
export type SortOrder = "desc" | "asc";
export type SortRule = { id: SortBy; desc: boolean };
export type ResultOrder =
  | "performance-desc"
  | "performance-asc"
  | "date-desc"
  | "date-asc";
export type DuplicateTitleMode = "include" | "exclude";

export interface PostMetric {
  postId: string;
  pageId: string;
  pageName: string;
  title: string;
  publishedAt: number;
  permalink: string;
  postType: string;
  views: number;
  reach: number;
  reactions: number;
  comments: number;
  shares: number;
  totalClicks: number;
  otherClicks: number;
  photoClicks: number;
  engagement: number;
  engagementRate: number | null;
}

export interface CsvParseResult {
  posts: PostMetric[];
  skippedRows: number;
  duplicateRows: number;
  mismatchRows: number;
  invalidNumericCells: number;
  parserWarnings: number;
}

export interface DuplicateTitleResult {
  posts: PostMetric[];
  hiddenCount: number;
}

export interface BalancedPerformanceScore {
  primary: number;
  tieBreaker: number;
}

export interface RankingMetricToggleResult {
  metrics: RankingMetricKey[];
  removedMetrics: RankingMetricKey[];
  changed: boolean;
}

export interface RankingMetricSelectionUpdate
  extends RankingMetricToggleResult {
  visibleMetrics: TableMetricKey[];
}

export interface FilterState {
  search: string;
  datePreset: DatePreset;
  customStart: string;
  customEnd: string;
  pageName: string;
  postType: string;
  ranges: Partial<Record<TableMetricKey, NumericRange>>;
}

export interface MetricTotals {
  posts: number;
  views: number;
  reach: number;
  engagement: number;
  reactions: number;
  comments: number;
  shares: number;
  totalClicks: number;
  otherClicks: number;
  photoClicks: number;
  engagementRate: number | null;
}

export interface ChartDatum {
  key: string;
  label: string;
  start: number;
  end: number;
  title: string;
  pageName: string;
  permalink: string;
  postCount: number;
  posts: PostMetric[];
  views: number;
  reach: number;
  engagement: number;
  reactions: number;
  comments: number;
  shares: number;
  totalClicks: number;
  otherClicks: number;
  photoClicks: number;
  engagementRate: number | null;
  normalized: Record<TableMetricKey, number | null>;
}

export interface ChartInteractionState {
  activeTooltipIndex?: number | string | null;
  activeIndex?: number | string | null;
}

export interface DashboardPreferencesV7 {
  version: 7;
  view: DashboardView;
  visibleMetrics: TableMetricKey[];
  rankingMetrics: RankingMetricKey[];
  resultOrder: ResultOrder;
  chartGrouping: ChartGrouping;
  pageSize: 25 | 50 | 100;
  showMetricQuickControls: boolean;
  tableInternalScroll: boolean;
  columnWidths: TableColumnWidths;
  tableRowResizeEnabled: boolean;
  tableRowHeight: number;
}

export interface MetricDefinition {
  key: TableMetricKey;
  label: string;
  compactLabel: string;
  chartColor: string;
  lineDash?: string;
  rankingEligible?: boolean;
  rankingDescription?: string;
  rankingFamily?: "engagement";
  quickControl?: boolean;
}

export const PREFERENCES_STORAGE_KEY = "postpulse-preferences-v7";
export const LEGACY_V6_PREFERENCES_STORAGE_KEY = "postpulse-preferences-v6";
export const LEGACY_V5_PREFERENCES_STORAGE_KEY = "postpulse-preferences-v5";
export const LEGACY_PREFERENCES_STORAGE_KEY = "postpulse-preferences-v4";
export const LEGACY_V3_PREFERENCES_STORAGE_KEY = "postpulse-preferences-v3";
export const LEGACY_V2_PREFERENCES_STORAGE_KEY = "postpulse-preferences-v2";
export const LEGACY_VISIBILITY_KEY = "postpulse-column-visibility";
export const LEGACY_VIEW_KEY = "postpulse-view";

export const tableMetricDefinitions: MetricDefinition[] = [
  {
    key: "views",
    label: "Views",
    compactLabel: "Views",
    chartColor: "#2563eb",
    rankingEligible: true,
    quickControl: true,
  },
  {
    key: "reach",
    label: "Reach",
    compactLabel: "Reach",
    chartColor: "#0891b2",
    lineDash: "8 3",
    rankingEligible: true,
    quickControl: true,
  },
  {
    key: "engagement",
    label: "Engagement",
    compactLabel: "Eng.",
    chartColor: "#7c3aed",
    rankingEligible: true,
    rankingDescription: "Reactions + Comments + Shares",
    rankingFamily: "engagement",
    quickControl: true,
  },
  {
    key: "reactions",
    label: "Reactions",
    compactLabel: "React.",
    chartColor: "#e11d48",
    lineDash: "3 3",
    rankingEligible: true,
    rankingFamily: "engagement",
    quickControl: true,
  },
  {
    key: "comments",
    label: "Comments",
    compactLabel: "Comments",
    chartColor: "#0d9488",
    lineDash: "10 3 2 3",
    rankingEligible: true,
    rankingFamily: "engagement",
    quickControl: true,
  },
  {
    key: "shares",
    label: "Shares",
    compactLabel: "Shares",
    chartColor: "#ea580c",
    rankingEligible: true,
    rankingFamily: "engagement",
    quickControl: true,
  },
  {
    key: "totalClicks",
    label: "Total clicks",
    compactLabel: "Clicks",
    chartColor: "#16a34a",
    lineDash: "6 3",
    rankingEligible: true,
    rankingDescription: "All clicks reported in the export",
    quickControl: true,
  },
  {
    key: "otherClicks",
    label: "Other clicks",
    compactLabel: "Other",
    chartColor: "#4f46e5",
    lineDash: "2 3",
  },
  {
    key: "photoClicks",
    label: "Photo clicks",
    compactLabel: "Photo",
    chartColor: "#c026d3",
    lineDash: "11 4",
  },
  {
    key: "engagementRate",
    label: "Engagement rate",
    compactLabel: "Eng. rate",
    chartColor: "#d97706",
    lineDash: "5 2 1 2",
  },
];

export const metricDefinitions = tableMetricDefinitions.filter(
  (metric): metric is MetricDefinition & { key: MetricKey } =>
    metric.key !== "engagementRate",
);

export const RANKING_METRICS: RankingMetricKey[] = [
  "views",
  "reach",
  "engagement",
  "reactions",
  "comments",
  "shares",
  "totalClicks",
];

export const ENGAGEMENT_COMPONENT_METRICS: RankingMetricKey[] = [
  "reactions",
  "comments",
  "shares",
];
const LEGACY_CORE_PERFORMANCE_METRICS: RankingMetricKey[] =
  RANKING_METRICS.filter((key) => key !== "totalClicks");

export const DEFAULT_VISIBLE_METRICS: TableMetricKey[] = ["views"];

export const TABLE_COLUMN_IDS: TableColumnId[] = [
  "post",
  "publishedAt",
  ...tableMetricDefinitions.map(({ key }) => key),
];

export const TABLE_COLUMN_DEFAULT_WIDTHS: TableColumnWidths = {
  post: 310,
  publishedAt: 112,
  views: 128,
  reach: 128,
  engagement: 128,
  reactions: 128,
  comments: 128,
  shares: 128,
  totalClicks: 128,
  otherClicks: 128,
  photoClicks: 128,
  engagementRate: 128,
};

export const TABLE_COLUMN_MIN_WIDTHS: TableColumnWidths = {
  post: 240,
  publishedAt: 112,
  views: 112,
  reach: 112,
  engagement: 112,
  reactions: 112,
  comments: 112,
  shares: 112,
  totalClicks: 112,
  otherClicks: 112,
  photoClicks: 112,
  engagementRate: 112,
};

export const TABLE_ROW_DEFAULT_HEIGHT = 78;
export const TABLE_ROW_MIN_HEIGHT = 44;
export const TABLE_ROW_COMPACT_THRESHOLD = 58;

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferencesV7 = {
  version: 7,
  view: "table",
  visibleMetrics: DEFAULT_VISIBLE_METRICS,
  rankingMetrics: ["views"],
  resultOrder: "performance-desc",
  chartGrouping: "post",
  pageSize: 25,
  showMetricQuickControls: true,
  tableInternalScroll: false,
  columnWidths: { ...TABLE_COLUMN_DEFAULT_WIDTHS },
  tableRowResizeEnabled: false,
  tableRowHeight: TABLE_ROW_DEFAULT_HEIGHT,
};

const metricKeys = new Set<TableMetricKey>(
  tableMetricDefinitions.map(({ key }) => key),
);
const rankingMetricKeys = new Set<RankingMetricKey>(RANKING_METRICS);
const viewKeys = new Set<DashboardView>(["table", "bars", "lines"]);
const groupingKeys = new Set<ChartGrouping>(["post", "day", "week", "month"]);
const pageSizes = new Set([25, 50, 100]);
const resultOrders = new Set<ResultOrder>([
  "performance-desc",
  "performance-asc",
  "date-desc",
  "date-asc",
]);

const requiredColumns = [
  "Post ID",
  "Page name",
  "Publish time",
  "Views",
  "Reach",
  "Reactions",
  "Comments",
  "Shares",
] as const;

type RawRow = Record<string, string | undefined>;

function cloneDefaultPreferences(): DashboardPreferencesV7 {
  return {
    ...DEFAULT_DASHBOARD_PREFERENCES,
    visibleMetrics: [...DEFAULT_DASHBOARD_PREFERENCES.visibleMetrics],
    rankingMetrics: [...DEFAULT_DASHBOARD_PREFERENCES.rankingMetrics],
    columnWidths: { ...DEFAULT_DASHBOARD_PREFERENCES.columnWidths },
  };
}

export function clampTableRowHeight(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return TABLE_ROW_DEFAULT_HEIGHT;
  }
  return Math.min(
    TABLE_ROW_DEFAULT_HEIGHT,
    Math.max(TABLE_ROW_MIN_HEIGHT, Math.round(value)),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function validateVisibleMetrics(value: unknown): TableMetricKey[] | null {
  if (!Array.isArray(value)) return null;
  const visible = [
    ...new Set(
      value.filter(
        (key): key is TableMetricKey =>
          typeof key === "string" && metricKeys.has(key as TableMetricKey),
      ),
    ),
  ];
  return visible.length ? visible : null;
}

function validateColumnWidths(value: unknown): TableColumnWidths {
  const widths = { ...TABLE_COLUMN_DEFAULT_WIDTHS };
  if (!isRecord(value)) return widths;

  for (const id of TABLE_COLUMN_IDS) {
    const candidate = value[id];
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) continue;
    widths[id] = Math.max(TABLE_COLUMN_MIN_WIDTHS[id], candidate);
  }
  return widths;
}

function roundColumnWidth(value: number): number {
  return Math.round(value * 100) / 100;
}

function getColumnWidth(
  widths: Partial<Record<TableColumnId, number>>,
  id: TableColumnId,
): number {
  const candidate = widths[id];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? Math.max(TABLE_COLUMN_MIN_WIDTHS[id], candidate)
    : TABLE_COLUMN_DEFAULT_WIDTHS[id];
}

function growColumns(
  widths: TableColumnWidths,
  ids: readonly TableColumnId[],
  amount: number,
): TableColumnWidths {
  if (amount <= 0 || !ids.length) return widths;
  const next = { ...widths };
  const totalWeight = ids.reduce(
    (sum, id) => sum + Math.max(1, next[id]),
    0,
  );
  let distributed = 0;
  ids.forEach((id, index) => {
    const share =
      index === ids.length - 1
        ? amount - distributed
        : amount * (Math.max(1, next[id]) / totalWeight);
    next[id] = roundColumnWidth(next[id] + share);
    distributed += share;
  });
  return next;
}

function shrinkColumns(
  widths: TableColumnWidths,
  ids: readonly TableColumnId[],
  amount: number,
): TableColumnWidths {
  if (amount <= 0 || !ids.length) return widths;
  const next = { ...widths };
  const capacities = ids.map((id) =>
    Math.max(0, next[id] - TABLE_COLUMN_MIN_WIDTHS[id]),
  );
  const totalCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
  if (totalCapacity <= 0) return next;

  const appliedAmount = Math.min(amount, totalCapacity);
  let distributed = 0;
  ids.forEach((id, index) => {
    const share =
      index === ids.length - 1
        ? appliedAmount - distributed
        : appliedAmount * (capacities[index] / totalCapacity);
    next[id] = roundColumnWidth(
      Math.max(TABLE_COLUMN_MIN_WIDTHS[id], next[id] - share),
    );
    distributed += share;
  });
  return next;
}

export function fitTableColumnWidths(
  currentWidths: Partial<Record<TableColumnId, number>>,
  visibleColumnIds: readonly TableColumnId[],
  availableWidth: number,
): TableColumnWidths {
  const next = Object.fromEntries(
    TABLE_COLUMN_IDS.map((id) => [id, getColumnWidth(currentWidths, id)]),
  ) as TableColumnWidths;
  if (!visibleColumnIds.length || !Number.isFinite(availableWidth)) return next;

  const minimumTotal = visibleColumnIds.reduce(
    (sum, id) => sum + TABLE_COLUMN_MIN_WIDTHS[id],
    0,
  );
  const targetTotal = Math.max(minimumTotal, availableWidth);
  const currentTotal = visibleColumnIds.reduce(
    (sum, id) => sum + next[id],
    0,
  );
  if (Math.abs(currentTotal - targetTotal) < 0.5) return next;

  return currentTotal < targetTotal
    ? growColumns(next, visibleColumnIds, targetTotal - currentTotal)
    : shrinkColumns(next, visibleColumnIds, currentTotal - targetTotal);
}

function shrinkTableColumnsInOrder(
  widths: TableColumnWidths,
  columnIds: readonly TableColumnId[],
  requestedAmount: number,
): number {
  let remaining = Math.max(0, requestedAmount);
  let transferred = 0;

  for (const id of columnIds) {
    if (remaining <= 0) break;
    const currentWidth = widths[id];
    const capacity = Math.max(
      0,
      currentWidth - TABLE_COLUMN_MIN_WIDTHS[id],
    );
    if (capacity <= 0) continue;

    const nextWidth = roundColumnWidth(
      currentWidth - Math.min(capacity, remaining),
    );
    const applied = roundColumnWidth(currentWidth - nextWidth);
    widths[id] = nextWidth;
    transferred = roundColumnWidth(transferred + applied);
    remaining = roundColumnWidth(Math.max(0, remaining - applied));
  }

  return transferred;
}

export function resizeCascadingTableColumns(
  currentWidths: Partial<Record<TableColumnId, number>>,
  visibleColumnIds: readonly TableColumnId[],
  leftColumnId: TableColumnId,
  rightColumnId: TableColumnId,
  requestedLeftWidth: number,
): TableColumnWidths {
  const next = Object.fromEntries(
    TABLE_COLUMN_IDS.map((id) => [id, getColumnWidth(currentWidths, id)]),
  ) as TableColumnWidths;
  if (!Number.isFinite(requestedLeftWidth)) return next;

  const leftIndex = visibleColumnIds.indexOf(leftColumnId);
  const rightIndex = visibleColumnIds.indexOf(rightColumnId);
  if (leftIndex < 0 || rightIndex !== leftIndex + 1) return next;

  const delta = requestedLeftWidth - next[leftColumnId];
  if (Math.abs(delta) < 0.005) return next;

  if (delta > 0) {
    const donorIds = visibleColumnIds.slice(rightIndex);
    const transferred = shrinkTableColumnsInOrder(next, donorIds, delta);
    next[leftColumnId] = roundColumnWidth(
      next[leftColumnId] + transferred,
    );
    return next;
  }

  const donorIds = visibleColumnIds.slice(0, rightIndex).reverse();
  const transferred = shrinkTableColumnsInOrder(next, donorIds, -delta);
  next[rightColumnId] = roundColumnWidth(
    next[rightColumnId] + transferred,
  );
  return next;
}

export function getCascadingTableDividerRange(
  currentWidths: Partial<Record<TableColumnId, number>>,
  visibleColumnIds: readonly TableColumnId[],
  leftColumnId: TableColumnId,
  rightColumnId: TableColumnId,
): { min: number; max: number; now: number } {
  const leftIndex = visibleColumnIds.indexOf(leftColumnId);
  const rightIndex = visibleColumnIds.indexOf(rightColumnId);
  if (leftIndex < 0 || rightIndex !== leftIndex + 1) {
    return { min: 0, max: 0, now: 0 };
  }

  const widths = Object.fromEntries(
    TABLE_COLUMN_IDS.map((id) => [id, getColumnWidth(currentWidths, id)]),
  ) as TableColumnWidths;
  const leftIds = visibleColumnIds.slice(0, rightIndex);
  const rightIds = visibleColumnIds.slice(rightIndex);
  const totalWidth = visibleColumnIds.reduce(
    (sum, id) => sum + widths[id],
    0,
  );
  const min = leftIds.reduce(
    (sum, id) => sum + TABLE_COLUMN_MIN_WIDTHS[id],
    0,
  );
  const reservedRightWidth = rightIds.reduce(
    (sum, id) => sum + TABLE_COLUMN_MIN_WIDTHS[id],
    0,
  );

  return {
    min: roundColumnWidth(min),
    max: roundColumnWidth(Math.max(min, totalWidth - reservedRightWidth)),
    now: roundColumnWidth(
      leftIds.reduce((sum, id) => sum + widths[id], 0),
    ),
  };
}

export function resetAdjacentTableColumns(
  currentWidths: Partial<Record<TableColumnId, number>>,
  leftColumnId: TableColumnId,
  rightColumnId: TableColumnId,
): TableColumnWidths {
  const leftWidth = getColumnWidth(currentWidths, leftColumnId);
  const rightWidth = getColumnWidth(currentWidths, rightColumnId);
  const pairTotal = leftWidth + rightWidth;
  const defaultPairTotal =
    TABLE_COLUMN_DEFAULT_WIDTHS[leftColumnId] +
    TABLE_COLUMN_DEFAULT_WIDTHS[rightColumnId];
  const defaultLeftRatio =
    TABLE_COLUMN_DEFAULT_WIDTHS[leftColumnId] / defaultPairTotal;
  return resizeCascadingTableColumns(
    currentWidths,
    [leftColumnId, rightColumnId],
    leftColumnId,
    rightColumnId,
    pairTotal * defaultLeftRatio,
  );
}

export function normalizeRankingMetrics(
  value: readonly RankingMetricKey[],
): RankingMetricKey[] {
  const selected = RANKING_METRICS.filter((key) => value.includes(key));
  const hasComponent = ENGAGEMENT_COMPONENT_METRICS.some((key) =>
    selected.includes(key),
  );
  return hasComponent
    ? selected.filter((key) => key !== "engagement")
    : selected;
}

function validateRankingMetrics(value: unknown): RankingMetricKey[] | null {
  if (!Array.isArray(value)) return null;
  const ranking = normalizeRankingMetrics(
    value.filter(
      (key): key is RankingMetricKey =>
        typeof key === "string" &&
        rankingMetricKeys.has(key as RankingMetricKey),
    ),
  );
  return ranking.length ? ranking : null;
}

export function toggleRankingMetricSelection(
  currentMetrics: readonly RankingMetricKey[],
  key: RankingMetricKey,
  checked: boolean,
): RankingMetricToggleResult {
  const current = normalizeRankingMetrics(currentMetrics);
  if (!checked && current.includes(key) && current.length === 1) {
    return { metrics: current, removedMetrics: [], changed: false };
  }

  let requested = checked
    ? [...current.filter((metric) => metric !== key), key]
    : current.filter((metric) => metric !== key);

  if (checked && key === "engagement") {
    requested = requested.filter(
      (metric) => !ENGAGEMENT_COMPONENT_METRICS.includes(metric),
    );
    requested.push("engagement");
  } else if (checked && ENGAGEMENT_COMPONENT_METRICS.includes(key)) {
    requested = requested.filter((metric) => metric !== "engagement");
  }

  const metrics = normalizeRankingMetrics(requested);
  const removedMetrics = current.filter((metric) => !metrics.includes(metric));
  return {
    metrics: metrics.length ? metrics : current,
    removedMetrics,
    changed:
      metrics.length !== current.length ||
      metrics.some((metric, index) => metric !== current[index]),
  };
}

export function updateRankingMetricAndVisibility(
  currentRankingMetrics: readonly RankingMetricKey[],
  currentVisibleMetrics: readonly TableMetricKey[],
  key: RankingMetricKey,
  checked: boolean,
): RankingMetricSelectionUpdate {
  const rankingUpdate = toggleRankingMetricSelection(
    currentRankingMetrics,
    key,
    checked,
  );
  const requestedVisible =
    checked && rankingUpdate.changed
      ? [...currentVisibleMetrics, key]
      : [...currentVisibleMetrics];
  const visibleMetrics = tableMetricDefinitions
    .map(({ key: metricKey }) => metricKey)
    .filter(
      (metricKey, index, allKeys) =>
        requestedVisible.includes(metricKey) &&
        allKeys.indexOf(metricKey) === index,
    );
  return { ...rankingUpdate, visibleMetrics };
}

function validateSorting(value: unknown): SortRule[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.length) return [];
  const first = value[0];
  if (
    !isRecord(first) ||
    typeof first.id !== "string" ||
    typeof first.desc !== "boolean"
  ) {
    return null;
  }
  const id = first.id as SortBy;
  if (
    id !== "publishedAt" &&
    id !== "overallPerformance" &&
    !metricKeys.has(id as TableMetricKey)
  ) {
    return null;
  }
  return [{ id, desc: first.desc }];
}

function validateSortBy(value: unknown): SortBy | null {
  if (value === "publishedAt" || value === "overallPerformance") return value;
  return typeof value === "string" && metricKeys.has(value as TableMetricKey)
    ? (value as TableMetricKey)
    : null;
}

function validateSortOrder(value: unknown): SortOrder | null {
  return value === "desc" || value === "asc" ? value : null;
}

function validateResultOrder(value: unknown): ResultOrder | null {
  return typeof value === "string" && resultOrders.has(value as ResultOrder)
    ? (value as ResultOrder)
    : null;
}

function getLegacyRankingMetrics(
  visibleMetrics: TableMetricKey[],
  sortBy: SortBy,
): RankingMetricKey[] {
  if (rankingMetricKeys.has(sortBy as RankingMetricKey)) {
    return [sortBy as RankingMetricKey];
  }
  if (sortBy === "overallPerformance" || sortBy === "publishedAt") {
    const visibleCoreMetrics = LEGACY_CORE_PERFORMANCE_METRICS.filter((key) =>
      visibleMetrics.includes(key),
    );
    const normalized = normalizeRankingMetrics(visibleCoreMetrics);
    return normalized.length ? normalized : ["views"];
  }
  return ["views"];
}

function getLegacyResultOrder(
  sortBy: SortBy,
  sortOrder: SortOrder,
): ResultOrder {
  if (sortBy === "publishedAt") {
    return sortOrder === "asc" ? "date-asc" : "date-desc";
  }
  return sortOrder === "asc" ? "performance-asc" : "performance-desc";
}

export function parseDashboardPreferences(
  storedValue: string | null,
  legacyVisibilityValue: string | null = null,
  legacyViewValue: string | null = null,
): DashboardPreferencesV7 {
  const defaults = cloneDefaultPreferences();
  const stored = parseJson(storedValue);

  if (
    isRecord(stored) &&
    (stored.version === 7 || stored.version === 6 || stored.version === 5)
  ) {
    return {
      version: 7,
      view:
        typeof stored.view === "string" &&
        viewKeys.has(stored.view as DashboardView)
          ? (stored.view as DashboardView)
          : defaults.view,
      visibleMetrics:
        validateVisibleMetrics(stored.visibleMetrics) ?? defaults.visibleMetrics,
      rankingMetrics:
        validateRankingMetrics(stored.rankingMetrics) ??
        defaults.rankingMetrics,
      resultOrder:
        validateResultOrder(stored.resultOrder) ?? defaults.resultOrder,
      chartGrouping:
        typeof stored.chartGrouping === "string" &&
        groupingKeys.has(stored.chartGrouping as ChartGrouping)
          ? (stored.chartGrouping as ChartGrouping)
          : defaults.chartGrouping,
      pageSize:
        typeof stored.pageSize === "number" && pageSizes.has(stored.pageSize)
          ? (stored.pageSize as 25 | 50 | 100)
          : defaults.pageSize,
      showMetricQuickControls:
        typeof stored.showMetricQuickControls === "boolean"
          ? stored.showMetricQuickControls
          : defaults.showMetricQuickControls,
      tableInternalScroll:
        typeof stored.tableInternalScroll === "boolean"
          ? stored.tableInternalScroll
          : defaults.tableInternalScroll,
      columnWidths:
        stored.version === 7 || stored.version === 6
          ? validateColumnWidths(stored.columnWidths)
          : { ...defaults.columnWidths },
      tableRowResizeEnabled:
        stored.version === 7 &&
        typeof stored.tableRowResizeEnabled === "boolean"
          ? stored.tableRowResizeEnabled
          : defaults.tableRowResizeEnabled,
      tableRowHeight:
        stored.version === 7
          ? clampTableRowHeight(stored.tableRowHeight)
          : defaults.tableRowHeight,
    };
  }

  if (isRecord(stored) && stored.version === 4) {
    return {
      version: 7,
      view:
        typeof stored.view === "string" &&
        viewKeys.has(stored.view as DashboardView)
          ? (stored.view as DashboardView)
          : defaults.view,
      visibleMetrics:
        validateVisibleMetrics(stored.visibleMetrics) ?? defaults.visibleMetrics,
      rankingMetrics:
        validateRankingMetrics(stored.rankingMetrics) ??
        defaults.rankingMetrics,
      resultOrder:
        validateResultOrder(stored.resultOrder) ?? defaults.resultOrder,
      chartGrouping:
        typeof stored.chartGrouping === "string" &&
        groupingKeys.has(stored.chartGrouping as ChartGrouping)
          ? (stored.chartGrouping as ChartGrouping)
          : defaults.chartGrouping,
      pageSize:
        typeof stored.pageSize === "number" && pageSizes.has(stored.pageSize)
          ? (stored.pageSize as 25 | 50 | 100)
          : defaults.pageSize,
      showMetricQuickControls:
        typeof stored.showMetricQuickControls === "boolean"
          ? stored.showMetricQuickControls
          : defaults.showMetricQuickControls,
      tableInternalScroll:
        typeof stored.tableInternalScroll === "boolean"
          ? stored.tableInternalScroll
          : defaults.tableInternalScroll,
      columnWidths: { ...defaults.columnWidths },
      tableRowResizeEnabled: defaults.tableRowResizeEnabled,
      tableRowHeight: defaults.tableRowHeight,
    };
  }

  if (isRecord(stored) && stored.version === 3) {
    const sortBy = validateSortBy(stored.sortBy) ?? "views";
    const sortOrder = validateSortOrder(stored.sortOrder) ?? "desc";
    const visibleMetrics =
      validateVisibleMetrics(stored.visibleMetrics) ?? defaults.visibleMetrics;

    return {
      version: 7,
      view:
        typeof stored.view === "string" &&
        viewKeys.has(stored.view as DashboardView)
          ? (stored.view as DashboardView)
          : defaults.view,
      visibleMetrics,
      rankingMetrics: getLegacyRankingMetrics(visibleMetrics, sortBy),
      resultOrder: getLegacyResultOrder(sortBy, sortOrder),
      chartGrouping:
        typeof stored.chartGrouping === "string" &&
        groupingKeys.has(stored.chartGrouping as ChartGrouping)
          ? (stored.chartGrouping as ChartGrouping)
          : defaults.chartGrouping,
      pageSize:
        typeof stored.pageSize === "number" && pageSizes.has(stored.pageSize)
          ? (stored.pageSize as 25 | 50 | 100)
          : defaults.pageSize,
      showMetricQuickControls:
        typeof stored.showMetricQuickControls === "boolean"
          ? stored.showMetricQuickControls
          : defaults.showMetricQuickControls,
      tableInternalScroll:
        typeof stored.tableInternalScroll === "boolean"
          ? stored.tableInternalScroll
          : defaults.tableInternalScroll,
      columnWidths: { ...defaults.columnWidths },
      tableRowResizeEnabled: defaults.tableRowResizeEnabled,
      tableRowHeight: defaults.tableRowHeight,
    };
  }

  if (isRecord(stored) && stored.version === 2) {
    const legacySorting = validateSorting(stored.sorting);
    const legacyAnalyzeMetric =
      typeof stored.analyzeMetric === "string" &&
      metricKeys.has(stored.analyzeMetric as TableMetricKey)
        ? (stored.analyzeMetric as TableMetricKey)
        : null;
    const sortBy =
      legacySorting?.[0]?.id ?? legacyAnalyzeMetric ?? "views";
    const sortOrder: SortOrder =
      legacySorting?.[0]?.desc === false ? "asc" : "desc";
    const visibleMetrics =
      validateVisibleMetrics(stored.visibleMetrics) ?? defaults.visibleMetrics;

    return {
      version: 7,
      view:
        typeof stored.view === "string" &&
        viewKeys.has(stored.view as DashboardView)
          ? (stored.view as DashboardView)
          : defaults.view,
      visibleMetrics,
      rankingMetrics: getLegacyRankingMetrics(visibleMetrics, sortBy),
      resultOrder: getLegacyResultOrder(sortBy, sortOrder),
      chartGrouping:
        typeof stored.chartGrouping === "string" &&
        groupingKeys.has(stored.chartGrouping as ChartGrouping)
          ? (stored.chartGrouping as ChartGrouping)
          : defaults.chartGrouping,
      pageSize:
        typeof stored.pageSize === "number" && pageSizes.has(stored.pageSize)
          ? (stored.pageSize as 25 | 50 | 100)
          : defaults.pageSize,
      showMetricQuickControls:
        typeof stored.showMetricQuickControls === "boolean"
          ? stored.showMetricQuickControls
          : defaults.showMetricQuickControls,
      tableInternalScroll:
        typeof stored.tableInternalScroll === "boolean"
          ? stored.tableInternalScroll
          : defaults.tableInternalScroll,
      columnWidths: { ...defaults.columnWidths },
      tableRowResizeEnabled: defaults.tableRowResizeEnabled,
      tableRowHeight: defaults.tableRowHeight,
    };
  }

  const legacyVisibility = parseJson(legacyVisibilityValue);
  const legacyVisible = isRecord(legacyVisibility)
    ? tableMetricDefinitions
        .filter(({ key }) => legacyVisibility[key] !== false)
        .map(({ key }) => key)
    : null;
  const legacyView =
    legacyViewValue === "table"
      ? "table"
      : legacyViewValue === "trends"
        ? "bars"
        : null;

  return {
    ...defaults,
    visibleMetrics: legacyVisible?.length
      ? legacyVisible
      : defaults.visibleMetrics,
    view: legacyView ?? defaults.view,
  };
}

function readNumber(
  row: RawRow,
  column: string,
  invalidCounter: { value: number },
): number {
  const raw = row[column]?.trim();
  if (!raw) return 0;
  const numeric = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    invalidCounter.value += 1;
    return 0;
  }
  return Math.max(0, numeric);
}

export function parsePublishTime(value: string | undefined): number | null {
  if (!value) return null;
  const match = value
    .trim()
    .match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
  if (match) {
    const [, month, day, year, hour = "0", minute = "0", second = "0"] =
      match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback.getTime();
}

export function parseFacebookCsv(csv: string): CsvParseResult {
  const parsed = Papa.parse<RawRow>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const fields = parsed.meta.fields ?? [];
  const missing = requiredColumns.filter((column) => !fields.includes(column));
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`);
  }

  const seen = new Set<string>();
  const posts: PostMetric[] = [];
  const invalidCounter = { value: 0 };
  let skippedRows = 0;
  let duplicateRows = 0;
  let mismatchRows = 0;

  for (const row of parsed.data) {
    const postId = row["Post ID"]?.trim() ?? "";
    const publishedAt = parsePublishTime(row["Publish time"]);
    if (!postId || publishedAt === null) {
      skippedRows += 1;
      continue;
    }
    if (seen.has(postId)) {
      duplicateRows += 1;
      continue;
    }
    seen.add(postId);

    const reactions = readNumber(row, "Reactions", invalidCounter);
    const comments = readNumber(row, "Comments", invalidCounter);
    const shares = readNumber(row, "Shares", invalidCounter);
    const engagement = reactions + comments + shares;
    const reach = readNumber(row, "Reach", invalidCounter);
    const exportedEngagement =
      row["Reactions, Comments and Shares"]?.trim() ?? "";

    if (
      exportedEngagement &&
      Number(exportedEngagement.replace(/,/g, "")) !== engagement
    ) {
      mismatchRows += 1;
    }

    posts.push({
      postId,
      pageId: row["Page ID"]?.trim() ?? "",
      pageName: row["Page name"]?.trim() || "Unknown page",
      title: row.Title?.trim() ?? "",
      publishedAt,
      permalink: row.Permalink?.trim() ?? "",
      postType: row["Post type"]?.trim() || "Unknown",
      views: readNumber(row, "Views", invalidCounter),
      reach,
      reactions,
      comments,
      shares,
      totalClicks: readNumber(row, "Total clicks", invalidCounter),
      otherClicks: readNumber(row, "Other Clicks", invalidCounter),
      photoClicks: readNumber(
        row,
        "Matched Audience Targeting Consumption (Photo Click)",
        invalidCounter,
      ),
      engagement,
      engagementRate: reach > 0 ? (engagement / reach) * 100 : null,
    });
  }

  if (!posts.length) {
    throw new Error("No valid Facebook post rows were found in this CSV.");
  }

  return {
    posts,
    skippedRows,
    duplicateRows,
    mismatchRows,
    invalidNumericCells: invalidCounter.value,
    parserWarnings: parsed.errors.length,
  };
}

export function getMetricValue(
  post: PostMetric,
  key: TableMetricKey,
): number | null {
  return post[key];
}

export function calculateTotals(posts: PostMetric[]): MetricTotals {
  const totals = posts.reduce(
    (result, post) => {
      result.views += post.views;
      result.reach += post.reach;
      result.engagement += post.engagement;
      result.reactions += post.reactions;
      result.comments += post.comments;
      result.shares += post.shares;
      result.totalClicks += post.totalClicks;
      result.otherClicks += post.otherClicks;
      result.photoClicks += post.photoClicks;
      return result;
    },
    {
      posts: posts.length,
      views: 0,
      reach: 0,
      engagement: 0,
      reactions: 0,
      comments: 0,
      shares: 0,
      totalClicks: 0,
      otherClicks: 0,
      photoClicks: 0,
      engagementRate: null as number | null,
    },
  );
  totals.engagementRate =
    totals.reach > 0 ? (totals.engagement / totals.reach) * 100 : null;
  return totals;
}

function startOfDay(timestamp: number): Date {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(timestamp: number): Date {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date;
}

function subtractCalendarMonths(date: Date, months: number): void {
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() - months);
  const lastDayInTargetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  date.setDate(Math.min(day, lastDayInTargetMonth));
}

export function getDateBounds(
  posts: PostMetric[],
  preset: DatePreset,
  customStart: string,
  customEnd: string,
): { start: number; end: number } | null {
  if (!posts.length) return null;
  const latest = Math.max(...posts.map((post) => post.publishedAt));
  const end = endOfDay(latest);
  const start = startOfDay(latest);

  if (preset === "custom") {
    const parsedStart = customStart
      ? startOfDay(new Date(`${customStart}T00:00:00`).getTime()).getTime()
      : Number.NEGATIVE_INFINITY;
    const parsedEnd = customEnd
      ? endOfDay(new Date(`${customEnd}T00:00:00`).getTime()).getTime()
      : Number.POSITIVE_INFINITY;
    if (parsedStart > parsedEnd) {
      return {
        start: Number.POSITIVE_INFINITY,
        end: Number.NEGATIVE_INFINITY,
      };
    }
    return { start: parsedStart, end: parsedEnd };
  }

  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "3m") subtractCalendarMonths(start, 3);
  if (preset === "6m") subtractCalendarMonths(start, 6);
  return { start: start.getTime(), end: end.getTime() };
}

export function isCustomDateRangeValid(
  customStart: string,
  customEnd: string,
): boolean {
  if (!customStart || !customEnd) return true;
  return (
    new Date(`${customStart}T00:00:00`).getTime() <=
    new Date(`${customEnd}T00:00:00`).getTime()
  );
}

export function filterPosts(
  posts: PostMetric[],
  filters: FilterState,
): PostMetric[] {
  const bounds = getDateBounds(
    posts,
    filters.datePreset,
    filters.customStart,
    filters.customEnd,
  );
  const query = filters.search.trim().toLocaleLowerCase();

  return posts.filter((post) => {
    if (
      bounds &&
      (post.publishedAt < bounds.start || post.publishedAt > bounds.end)
    ) {
      return false;
    }
    if (
      query &&
      !`${post.title} ${post.pageName} ${post.postType}`
        .toLocaleLowerCase()
        .includes(query)
    ) {
      return false;
    }
    if (filters.pageName && post.pageName !== filters.pageName) return false;
    if (filters.postType && post.postType !== filters.postType) return false;

    for (const [key, range] of Object.entries(filters.ranges) as Array<
      [TableMetricKey, NumericRange]
    >) {
      const value = getMetricValue(post, key);
      if (value === null) {
        if (range.min !== undefined || range.max !== undefined) return false;
        continue;
      }
      if (range.min !== undefined && value < range.min) return false;
      if (range.max !== undefined && value > range.max) return false;
    }
    return true;
  });
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  desc: boolean,
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return desc ? right - left : left - right;
}

type RankingMetricValues = Record<RankingMetricKey, number>;

function getSelectedRankingMetrics(
  selectedMetrics: readonly RankingMetricKey[],
): RankingMetricKey[] {
  const selected = normalizeRankingMetrics(selectedMetrics);
  return selected.length ? selected : ["views"];
}

export function calculateBalancedPerformanceDetails<
  T extends RankingMetricValues,
>(
  items: readonly T[],
  selectedMetrics: readonly RankingMetricKey[],
): BalancedPerformanceScore[] {
  if (!items.length) return [];
  const selected = getSelectedRankingMetrics(selectedMetrics);
  const informativeMetrics = selected.filter((key) =>
    items.some((item) => item[key] > 0),
  );
  if (!informativeMetrics.length) {
    return items.map(() => ({ primary: 0, tieBreaker: 0 }));
  }

  const maxima = Object.fromEntries(
    informativeMetrics.map((key) => [
      key,
      Math.max(...items.map((item) => item[key])),
    ]),
  ) as Partial<Record<RankingMetricKey, number>>;

  return items.map((item) => {
    const normalized = informativeMetrics.map(
      (key) => item[key] / Number(maxima[key]),
    );
    const tieBreaker =
      (normalized.reduce((sum, value) => sum + value, 0) /
        normalized.length) *
      100;
    if (normalized.some((value) => value === 0)) {
      return { primary: 0, tieBreaker };
    }
    const meanLog =
      normalized.reduce((sum, value) => sum + Math.log(value), 0) /
      normalized.length;
    return { primary: Math.exp(meanLog) * 100, tieBreaker };
  });
}

export function calculateBalancedPerformanceScores<
  T extends RankingMetricValues,
>(
  items: readonly T[],
  selectedMetrics: readonly RankingMetricKey[],
): number[] {
  return calculateBalancedPerformanceDetails(items, selectedMetrics).map(
    ({ primary }) => primary,
  );
}

export function getResultSortRule(resultOrder: ResultOrder): SortRule[] {
  if (resultOrder === "date-desc") {
    return [{ id: "publishedAt", desc: true }];
  }
  if (resultOrder === "date-asc") {
    return [{ id: "publishedAt", desc: false }];
  }
  return [
    {
      id: "overallPerformance",
      desc: resultOrder === "performance-desc",
    },
  ];
}

export function sortPosts(
  posts: PostMetric[],
  sorting: SortRule[],
  selectedMetrics: readonly RankingMetricKey[] = ["views"],
): PostMetric[] {
  if (!sorting.length) return [...posts];
  const [{ id, desc }] = sorting;
  const performanceScores =
    id === "overallPerformance"
      ? calculateBalancedPerformanceDetails(posts, selectedMetrics)
      : null;

  return posts
    .map((post, sourceIndex) => ({
      post,
      sourceIndex,
      performanceScore: performanceScores?.[sourceIndex] ?? {
        primary: 0,
        tieBreaker: 0,
      },
    }))
    .sort((left, right) => {
      const comparison =
        id === "publishedAt"
          ? desc
            ? right.post.publishedAt - left.post.publishedAt
            : left.post.publishedAt - right.post.publishedAt
          : id === "overallPerformance"
            ? desc
              ? right.performanceScore.primary - left.performanceScore.primary
              : left.performanceScore.primary - right.performanceScore.primary
            : compareNullableNumbers(
                getMetricValue(left.post, id),
                getMetricValue(right.post, id),
                desc,
              );
      if (comparison) return comparison;
      if (id === "overallPerformance") {
        const tieComparison = desc
          ? right.performanceScore.tieBreaker -
            left.performanceScore.tieBreaker
          : left.performanceScore.tieBreaker -
            right.performanceScore.tieBreaker;
        if (tieComparison) return tieComparison;
        const newestFirst = right.post.publishedAt - left.post.publishedAt;
        if (newestFirst) return newestFirst;
      }
      return comparison || left.sourceIndex - right.sourceIndex;
    })
    .map(({ post }) => post);
}

function normalizeDuplicateTitlePart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getDuplicateTitleKey(post: PostMetric): string {
  const cleanedTitle = normalizeDuplicateTitlePart(
    stripHashtagWords(post.title),
  );
  const originalTitle = normalizeDuplicateTitlePart(post.title);
  const pageKey = normalizeDuplicateTitlePart(
    post.pageId || post.pageName || "unknown page",
  );
  const titleKey = originalTitle
    ? cleanedTitle || originalTitle
    : `post:${post.postId}`;
  return `${pageKey}\u0000${titleKey}`;
}

export function applyDuplicateTitleMode(
  posts: PostMetric[],
  mode: DuplicateTitleMode,
  selectedMetrics: readonly RankingMetricKey[] = ["views"],
): DuplicateTitleResult {
  if (mode === "include") {
    return { posts: [...posts], hiddenCount: 0 };
  }

  const orderedPosts = sortPosts(
    posts,
    [{ id: "overallPerformance", desc: true }],
    selectedMetrics,
  );
  const seenTitles = new Set<string>();
  const survivingPosts = orderedPosts.filter((post) => {
    const key = getDuplicateTitleKey(post);
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  return {
    posts: survivingPosts,
    hiddenCount: posts.length - survivingPosts.length,
  };
}

function getBucketStart(
  timestamp: number,
  grouping: Exclude<ChartGrouping, "post">,
): Date {
  const date = startOfDay(timestamp);
  if (grouping === "week") {
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
  }
  if (grouping === "month") date.setDate(1);
  return date;
}

function getBucketEnd(
  start: number,
  grouping: Exclude<ChartGrouping, "post">,
): number {
  const date = new Date(start);
  if (grouping === "day") return endOfDay(start).getTime();
  if (grouping === "week") {
    date.setDate(date.getDate() + 6);
    return endOfDay(date.getTime()).getTime();
  }
  date.setMonth(date.getMonth() + 1, 0);
  return endOfDay(date.getTime()).getTime();
}

function getChartLabel(timestamp: number, grouping: ChartGrouping): string {
  const date = new Date(timestamp);
  if (grouping === "month") {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      year: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function toChartDatum(
  key: string,
  start: number,
  end: number,
  grouping: ChartGrouping,
  groupPosts: PostMetric[],
  sorting: SortRule[],
  selectedMetrics: readonly RankingMetricKey[],
): ChartDatum {
  const sortedGroup = sortPosts(groupPosts, sorting, selectedMetrics);
  const totals = calculateTotals(sortedGroup);
  const single = grouping === "post" ? sortedGroup[0] : null;
  return {
    key,
    label: getChartLabel(start, grouping),
    start,
    end,
    title: single
      ? getPostHeadline(single.title)
      : `${sortedGroup.length} ${sortedGroup.length === 1 ? "post" : "posts"}`,
    pageName:
      new Set(sortedGroup.map((post) => post.pageName)).size === 1
        ? sortedGroup[0]?.pageName ?? ""
        : "Multiple pages",
    permalink: single?.permalink ?? "",
    postCount: sortedGroup.length,
    posts: sortedGroup,
    views: totals.views,
    reach: totals.reach,
    engagement: totals.engagement,
    reactions: totals.reactions,
    comments: totals.comments,
    shares: totals.shares,
    totalClicks: totals.totalClicks,
    otherClicks: totals.otherClicks,
    photoClicks: totals.photoClicks,
    engagementRate: totals.engagementRate,
    normalized: Object.fromEntries(
      tableMetricDefinitions.map(({ key: metricKey }) => [metricKey, 0]),
    ) as Record<TableMetricKey, number | null>,
  };
}

function sortChartData(
  data: ChartDatum[],
  sorting: SortRule[],
  selectedMetrics: readonly RankingMetricKey[],
): ChartDatum[] {
  if (!sorting.length) return data;
  const [{ id, desc }] = sorting;
  const performanceScores =
    id === "overallPerformance"
      ? calculateBalancedPerformanceDetails(data, selectedMetrics)
      : null;
  return data
    .map((datum, sourceIndex) => ({
      datum,
      sourceIndex,
      performanceScore: performanceScores?.[sourceIndex] ?? {
        primary: 0,
        tieBreaker: 0,
      },
    }))
    .sort((left, right) => {
      const comparison =
        id === "publishedAt"
          ? desc
            ? right.datum.start - left.datum.start
            : left.datum.start - right.datum.start
          : id === "overallPerformance"
            ? desc
              ? right.performanceScore.primary - left.performanceScore.primary
              : left.performanceScore.primary - right.performanceScore.primary
            : compareNullableNumbers(
                left.datum[id],
                right.datum[id],
                desc,
              );
      if (comparison) return comparison;
      if (id === "overallPerformance") {
        const tieComparison = desc
          ? right.performanceScore.tieBreaker -
            left.performanceScore.tieBreaker
          : left.performanceScore.tieBreaker -
            right.performanceScore.tieBreaker;
        if (tieComparison) return tieComparison;
        const newestFirst = right.datum.start - left.datum.start;
        if (newestFirst) return newestFirst;
      }
      return comparison || left.sourceIndex - right.sourceIndex;
    })
    .map(({ datum }) => datum);
}

function normalizeChartData(data: ChartDatum[]): ChartDatum[] {
  const maxima = Object.fromEntries(
    tableMetricDefinitions.map(({ key }) => {
      const values = data
        .map((datum) => datum[key])
        .filter((value): value is number => value !== null);
      return [key, values.length ? Math.max(...values) : 0];
    }),
  ) as Record<TableMetricKey, number>;

  return data.map((datum) => ({
    ...datum,
    normalized: Object.fromEntries(
      tableMetricDefinitions.map(({ key }) => {
        const value = datum[key];
        const maximum = maxima[key];
        return [
          key,
          value === null ? null : maximum > 0 ? (value / maximum) * 100 : 0,
        ];
      }),
    ) as Record<TableMetricKey, number | null>,
  }));
}

export function buildChartData(
  posts: PostMetric[],
  grouping: ChartGrouping,
  sorting: SortRule[],
  selectedMetrics: readonly RankingMetricKey[] = ["views"],
): ChartDatum[] {
  if (!posts.length) return [];

  if (grouping === "post") {
    const data = sortPosts(posts, sorting, selectedMetrics).map((post) =>
      toChartDatum(
        post.postId,
        post.publishedAt,
        post.publishedAt,
        grouping,
        [post],
        sorting,
        selectedMetrics,
      ),
    );
    return normalizeChartData(data);
  }

  const groups = new Map<number, PostMetric[]>();
  for (const post of posts) {
    const start = getBucketStart(post.publishedAt, grouping).getTime();
    groups.set(start, [...(groups.get(start) ?? []), post]);
  }

  const data = [...groups.entries()].map(([start, groupPosts]) =>
    toChartDatum(
      `${grouping}-${start}`,
      start,
      getBucketEnd(start, grouping),
      grouping,
      groupPosts,
      sorting,
      selectedMetrics,
    ),
  );
  return normalizeChartData(sortChartData(data, sorting, selectedMetrics));
}

export function getChartDataSignature(data: ChartDatum[]): string {
  return JSON.stringify(
    data.map((datum) => [
      datum.key,
      datum.start,
      datum.end,
      ...tableMetricDefinitions.flatMap(({ key }) => [
        datum[key],
        datum.normalized[key],
      ]),
    ]),
  );
}

export function selectAxisLabelIndexes(
  itemCount: number,
  availableWidth: number,
  minimumLabelSpacing = 78,
): number[] {
  if (itemCount <= 0) return [];
  if (itemCount === 1) return [0];

  const safeSpacing = Math.max(1, minimumLabelSpacing);
  const maximumLabels = Math.max(
    2,
    Math.floor(Math.max(0, availableWidth) / safeSpacing),
  );
  if (itemCount <= maximumLabels) {
    return Array.from({ length: itemCount }, (_, index) => index);
  }

  const indexes = new Set<number>([0, itemCount - 1]);
  const step = (itemCount - 1) / (maximumLabels - 1);
  for (let index = 1; index < maximumLabels - 1; index += 1) {
    indexes.add(Math.round(index * step));
  }
  return [...indexes].sort((left, right) => left - right);
}

export function getDisplayedRowNumber(
  pageIndex: number,
  pageSize: number,
  rowIndex: number,
): number {
  return pageIndex * pageSize + rowIndex + 1;
}

export function resolveChartDatum(
  state: ChartInteractionState | null | undefined,
  data: ChartDatum[],
): ChartDatum | null {
  const rawIndex = state?.activeTooltipIndex ?? state?.activeIndex;
  if (rawIndex === null || rawIndex === undefined || rawIndex === "") {
    return null;
  }

  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0 || index >= data.length) {
    return null;
  }

  return data[index] ?? null;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

export function shouldShowBarValueLabels(
  visibleMetricCount: number,
): boolean {
  return visibleMetricCount > 0 && visibleMetricCount <= 2;
}

function orderChartMetricKeys(
  keys: readonly TableMetricKey[],
): TableMetricKey[] {
  const requested = new Set(keys);
  return tableMetricDefinitions
    .map(({ key }) => key)
    .filter((key) => requested.has(key));
}

function chartMetricKeysMatch(
  left: readonly TableMetricKey[],
  right: readonly TableMetricKey[],
): boolean {
  const orderedLeft = orderChartMetricKeys(left);
  const orderedRight = orderChartMetricKeys(right);
  return (
    orderedLeft.length === orderedRight.length &&
    orderedLeft.every((key, index) => key === orderedRight[index])
  );
}

export function reconcileChartMetricTransition(
  current: ChartMetricTransitionState,
  requestedMetrics: readonly TableMetricKey[],
  phase: Exclude<ChartMotionPhase, "idle">,
  revision: number,
): ChartMetricTransitionState {
  const requested = orderChartMetricKeys(requestedMetrics);
  const rendered = orderChartMetricKeys([
    ...current.renderedMetrics,
    ...requested,
  ]);

  return {
    requestedMetrics: requested,
    renderedMetrics: rendered,
    enteringMetrics: requested.filter(
      (key) => !current.renderedMetrics.includes(key),
    ),
    exitingMetrics: rendered.filter((key) => !requested.includes(key)),
    phase,
    revision,
  };
}

export function completeChartMetricExit(
  current: ChartMetricTransitionState,
  revision: number,
): ChartMetricTransitionState {
  if (current.revision !== revision) return current;
  return {
    ...current,
    renderedMetrics: current.requestedMetrics,
    exitingMetrics: [],
  };
}

export function settleChartMetricTransition(
  current: ChartMetricTransitionState,
  revision: number,
): ChartMetricTransitionState {
  if (current.revision !== revision) return current;
  return {
    ...current,
    renderedMetrics: current.requestedMetrics,
    enteringMetrics: [],
    exitingMetrics: [],
    phase: "idle",
  };
}

export function shouldRenderSettledBarValueLabels(
  transition: ChartMetricTransitionState,
): boolean {
  if (!shouldShowBarValueLabels(transition.requestedMetrics.length)) {
    return false;
  }
  return (
    transition.phase === "idle" &&
    transition.enteringMetrics.length === 0 &&
    transition.exitingMetrics.length === 0 &&
    chartMetricKeysMatch(
      transition.renderedMetrics,
      transition.requestedMetrics,
    )
  );
}

export function formatBarValueLabel(
  metric: TableMetricKey,
  value: number | null | undefined,
): string {
  if (metric === "engagementRate") {
    return formatPercent(value ?? null);
  }
  return formatCount(Number(value ?? 0));
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function formatDateRange(posts: PostMetric[]): string {
  if (!posts.length) return "No dates";
  const min = Math.min(...posts.map((post) => post.publishedAt));
  const max = Math.max(...posts.map((post) => post.publishedAt));
  return min === max
    ? formatDate(min)
    : `${formatDate(min)} – ${formatDate(max)}`;
}

export function stripHashtagWords(title: string): string {
  const cleanedLines = title
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        .filter((word) => word && !word.startsWith("#"))
        .join(" "),
    )
    .filter(Boolean);

  return cleanedLines.join("\n");
}

export function getPostHeadline(title: string): string {
  const cleanedTitle = stripHashtagWords(title);
  return (
    cleanedTitle.split(/\r?\n/).find((line) => line.trim())?.trim() ||
    "Untitled post"
  );
}
