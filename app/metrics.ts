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
export type DatePreset = "7d" | "30d" | "6m" | "1y" | "all" | "custom";
export const DEFAULT_DATE_PRESET: DatePreset = "30d";
export type NumericRange = { min?: number; max?: number };
export type SortField = TableMetricKey | "publishedAt";
export type SortRule = { id: SortField; desc: boolean };

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

export interface DashboardPreferencesV2 {
  version: 2;
  view: DashboardView;
  visibleMetrics: TableMetricKey[];
  analyzeMetric: TableMetricKey;
  sorting: SortRule[];
  chartGrouping: ChartGrouping;
  pageSize: 25 | 50 | 100;
  showMetricQuickControls: boolean;
  tableInternalScroll: boolean;
}

export interface MetricDefinition {
  key: TableMetricKey;
  label: string;
  compactLabel: string;
  chartColor: string;
  lineDash?: string;
}

export const PREFERENCES_STORAGE_KEY = "postpulse-preferences-v2";
export const LEGACY_VISIBILITY_KEY = "postpulse-column-visibility";
export const LEGACY_VIEW_KEY = "postpulse-view";

export const tableMetricDefinitions: MetricDefinition[] = [
  {
    key: "views",
    label: "Views",
    compactLabel: "Views",
    chartColor: "#2563eb",
  },
  {
    key: "reach",
    label: "Reach",
    compactLabel: "Reach",
    chartColor: "#0891b2",
    lineDash: "8 3",
  },
  {
    key: "engagement",
    label: "Engagement",
    compactLabel: "Eng.",
    chartColor: "#7c3aed",
  },
  {
    key: "reactions",
    label: "Reactions",
    compactLabel: "React.",
    chartColor: "#e11d48",
    lineDash: "3 3",
  },
  {
    key: "comments",
    label: "Comments",
    compactLabel: "Comments",
    chartColor: "#0d9488",
    lineDash: "10 3 2 3",
  },
  {
    key: "shares",
    label: "Shares",
    compactLabel: "Shares",
    chartColor: "#ea580c",
  },
  {
    key: "totalClicks",
    label: "Total clicks",
    compactLabel: "Clicks",
    chartColor: "#16a34a",
    lineDash: "6 3",
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

export const DEFAULT_VISIBLE_METRICS: TableMetricKey[] = ["views"];

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferencesV2 = {
  version: 2,
  view: "table",
  visibleMetrics: DEFAULT_VISIBLE_METRICS,
  analyzeMetric: "views",
  sorting: [{ id: "views", desc: true }],
  chartGrouping: "post",
  pageSize: 25,
  showMetricQuickControls: true,
  tableInternalScroll: false,
};

const metricKeys = new Set<TableMetricKey>(
  tableMetricDefinitions.map(({ key }) => key),
);
const viewKeys = new Set<DashboardView>(["table", "bars", "lines"]);
const groupingKeys = new Set<ChartGrouping>(["post", "day", "week", "month"]);
const pageSizes = new Set([25, 50, 100]);

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

function cloneDefaultPreferences(): DashboardPreferencesV2 {
  return {
    ...DEFAULT_DASHBOARD_PREFERENCES,
    visibleMetrics: [...DEFAULT_DASHBOARD_PREFERENCES.visibleMetrics],
    sorting: DEFAULT_DASHBOARD_PREFERENCES.sorting.map((rule) => ({ ...rule })),
  };
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
  const id = first.id as SortField;
  if (id !== "publishedAt" && !metricKeys.has(id as TableMetricKey)) return null;
  return [{ id, desc: first.desc }];
}

export function parseDashboardPreferences(
  storedValue: string | null,
  legacyVisibilityValue: string | null = null,
  legacyViewValue: string | null = null,
): DashboardPreferencesV2 {
  const defaults = cloneDefaultPreferences();
  const stored = parseJson(storedValue);

  if (isRecord(stored) && stored.version === 2) {
    const visibleMetrics =
      validateVisibleMetrics(stored.visibleMetrics) ?? defaults.visibleMetrics;
    const analyzeMetric =
      typeof stored.analyzeMetric === "string" &&
      metricKeys.has(stored.analyzeMetric as TableMetricKey)
        ? (stored.analyzeMetric as TableMetricKey)
        : defaults.analyzeMetric;
    const finalVisibleMetrics = visibleMetrics.includes(analyzeMetric)
      ? visibleMetrics
      : [...visibleMetrics, analyzeMetric];

    return {
      version: 2,
      view:
        typeof stored.view === "string" &&
        viewKeys.has(stored.view as DashboardView)
          ? (stored.view as DashboardView)
          : defaults.view,
      visibleMetrics: finalVisibleMetrics,
      analyzeMetric,
      sorting: validateSorting(stored.sorting) ?? defaults.sorting,
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
    visibleMetrics:
      legacyVisible?.length && legacyVisible.includes(defaults.analyzeMetric)
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
      title: row.Title?.trim() || "Untitled post",
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

export function getDateBounds(
  posts: PostMetric[],
  preset: DatePreset,
  customStart: string,
  customEnd: string,
): { start: number; end: number } | null {
  if (!posts.length || preset === "all") return null;
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
    return { start: parsedStart, end: parsedEnd };
  }

  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "6m") start.setMonth(start.getMonth() - 6);
  if (preset === "1y") start.setFullYear(start.getFullYear() - 1);
  return { start: start.getTime(), end: end.getTime() };
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

export function sortPosts(
  posts: PostMetric[],
  sorting: SortRule[],
): PostMetric[] {
  if (!sorting.length) return [...posts];
  const [{ id, desc }] = sorting;

  return posts
    .map((post, sourceIndex) => ({ post, sourceIndex }))
    .sort((left, right) => {
      const comparison =
        id === "publishedAt"
          ? desc
            ? right.post.publishedAt - left.post.publishedAt
            : left.post.publishedAt - right.post.publishedAt
          : compareNullableNumbers(
              getMetricValue(left.post, id),
              getMetricValue(right.post, id),
              desc,
            );
      return comparison || left.sourceIndex - right.sourceIndex;
    })
    .map(({ post }) => post);
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
): ChartDatum {
  const sortedGroup = sortPosts(groupPosts, sorting);
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
): ChartDatum[] {
  if (!sorting.length) return data;
  const [{ id, desc }] = sorting;
  return data
    .map((datum, sourceIndex) => ({ datum, sourceIndex }))
    .sort((left, right) => {
      const comparison =
        id === "publishedAt"
          ? desc
            ? right.datum.start - left.datum.start
            : left.datum.start - right.datum.start
          : compareNullableNumbers(
              left.datum[id],
              right.datum[id],
              desc,
            );
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
): ChartDatum[] {
  if (!posts.length) return [];

  if (grouping === "post") {
    const data = sortPosts(posts, sorting).map((post) =>
      toChartDatum(
        post.postId,
        post.publishedAt,
        post.publishedAt,
        grouping,
        [post],
        sorting,
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
    ),
  );
  return normalizeChartData(sortChartData(data, sorting));
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
