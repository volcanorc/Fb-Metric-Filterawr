"use client";

import {
  type ChangeEvent,
  type ComponentType,
  type CSSProperties,
  type SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ColumnDef,
  type PaginationState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  type ActiveDotProps,
  type DotItemDotProps,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  matchByDataKey,
} from "recharts";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Info,
  MousePointerClick,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Table2,
  ThumbsUp,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  type ChartDatum,
  type ChartGrouping,
  type ChartInteractionState,
  type ChartMetricTransitionState,
  type CorePerformanceMetricKey,
  type CsvParseResult,
  type DashboardPreferencesV4,
  type DashboardView,
  type DatePreset,
  type FilterState,
  type NumericRange,
  type PostMetric,
  type ResultOrder,
  type TableMetricKey,
  CORE_PERFORMANCE_METRICS,
  DEFAULT_DASHBOARD_PREFERENCES,
  DEFAULT_DATE_PRESET,
  DEFAULT_VISIBLE_METRICS,
  LEGACY_PREFERENCES_STORAGE_KEY,
  LEGACY_V2_PREFERENCES_STORAGE_KEY,
  LEGACY_VIEW_KEY,
  LEGACY_VISIBILITY_KEY,
  PREFERENCES_STORAGE_KEY,
  buildChartData,
  calculateTotals,
  completeChartMetricExit,
  filterPosts,
  formatCount,
  formatBarValueLabel,
  formatDate,
  formatDateRange,
  formatPercent,
  getMetricValue,
  getChartDataSignature,
  getDisplayedRowNumber,
  getPostHeadline,
  getResultSortRule,
  isCustomDateRangeValid,
  parseDashboardPreferences,
  parseFacebookCsv,
  reconcileChartMetricTransition,
  resolveChartDatum,
  selectAxisLabelIndexes,
  settleChartMetricTransition,
  shouldRenderSettledBarValueLabels,
  shouldShowBarValueLabels,
  sortPosts,
  stripHashtagWords,
  tableMetricDefinitions,
} from "./metrics";

const EMPTY_DATASET: CsvParseResult = {
  posts: [],
  skippedRows: 0,
  duplicateRows: 0,
  mismatchRows: 0,
  invalidNumericCells: 0,
  parserWarnings: 0,
};
const defaultFilters: FilterState = {
  search: "",
  datePreset: DEFAULT_DATE_PRESET,
  customStart: "",
  customEnd: "",
  pageName: "",
  postType: "",
  ranges: {},
};

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
const CORE_METRIC_SET = new Set<TableMetricKey>(CORE_PERFORMANCE_METRICS);
const coreMetricDefinitions = tableMetricDefinitions.filter(
  (
    metric,
  ): metric is (typeof tableMetricDefinitions)[number] & {
    key: CorePerformanceMetricKey;
  } => CORE_METRIC_SET.has(metric.key),
);

function visibilityFromMetrics(metrics: TableMetricKey[]): VisibilityState {
  return Object.fromEntries(
    tableMetricDefinitions.map(({ key }) => [key, metrics.includes(key)]),
  );
}

function openPost(url: string) {
  if (!url) return;
  const nextWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (nextWindow) nextWindow.opener = null;
}

function MetricBar({
  value,
  min,
  max,
  label,
  percent = false,
}: {
  value: number | null;
  min: number;
  max: number;
  label: string;
  percent?: boolean;
}) {
  if (value === null) {
    return (
      <div className="metric-cell metric-cell-empty" aria-label={`${label}: N/A`}>
        <span className="metric-value">N/A</span>
        <div className="metric-track metric-track-empty" aria-hidden="true" />
      </div>
    );
  }

  const equal = max === min;
  const tone = equal
    ? "neutral"
    : value === max
      ? "high"
      : value === min
        ? "low"
        : "neutral";
  const width =
    max > 0 ? Math.max(value === 0 ? 2.5 : 5, (value / max) * 100) : 0;
  const formatted = percent ? formatPercent(value) : formatCount(value);

  return (
    <div
      className="metric-cell"
      aria-label={`${label}: ${formatted}, ${tone === "high" ? "highest" : tone === "low" ? "lowest" : "middle"} visible value`}
    >
      <span className="metric-value">{formatted}</span>
      <div className="metric-track" aria-hidden="true">
        <span
          className={`metric-fill metric-fill-${tone}`}
          style={{ width: `${Math.min(100, width)}%` }}
        />
      </div>
    </div>
  );
}

function KpiCard({
  icon: IconComponent,
  label,
  value,
  note,
  tone = "blue",
}: {
  icon: Icon;
  label: string;
  value: string;
  note: string;
  tone?: "blue" | "amber";
}) {
  return (
    <article className="kpi-card">
      <div className={`kpi-icon kpi-icon-${tone}`} aria-hidden="true">
        <IconComponent size={18} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}

function CopyTitleButton({
  copied,
  onCopy,
}: {
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      className={`copy-title-button ${copied ? "copied" : ""}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCopy();
      }}
      aria-label={copied ? "Title copied" : "Copy full post title"}
      title={copied ? "Copied" : "Copy title"}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function PostCell({
  post,
  rank,
  copied,
  onCopy,
}: {
  post: PostMetric;
  rank: number;
  copied: boolean;
  onCopy: () => void;
}) {
  const headline = getPostHeadline(post.title);
  const cleanTitle = stripHashtagWords(post.title) || "Untitled post";
  return (
    <div className={`post-cell ${post.permalink ? "post-cell-linked" : ""}`}>
      {post.permalink ? (
        <a
          className="post-cell-hit"
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open Facebook post: ${headline}`}
        />
      ) : null}
      <span className="post-rank" aria-label={`Result ${rank}`}>
        {rank}
      </span>
      <span className="post-type">{post.postType}</span>
      <strong title={cleanTitle}>
        {headline}
        {post.permalink ? (
          <ExternalLink
            className="post-link-icon"
            size={11}
            aria-hidden="true"
          />
        ) : null}
      </strong>
      <CopyTitleButton copied={copied} onCopy={onCopy} />
      <span className="post-page">{post.pageName}</span>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartDatum }>;
}) {
  const datum = payload?.find((item) => item.payload)?.payload;
  if (!active || !datum) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-heading">
        <strong>{datum.title}</strong>
        <span>
          {datum.label} · {datum.pageName}
          {datum.postCount > 1 ? ` · ${datum.postCount} posts` : ""}
        </span>
      </div>
      <div className="chart-tooltip-grid">
        {tableMetricDefinitions.map((metric) => (
          <span key={metric.key}>
            <i style={{ backgroundColor: metric.chartColor }} />
            <b>{metric.label}</b>
            <em>
              {metric.key === "engagementRate"
                ? formatPercent(datum.engagementRate)
                : formatCount(Number(datum[metric.key] ?? 0))}
            </em>
          </span>
        ))}
      </div>
      <small>Click to open {datum.postCount === 1 ? "the post" : "post options"}.</small>
    </div>
  );
}

function MetricQuickControls({
  visibleMetrics,
  onToggle,
  onHighlight,
}: {
  visibleMetrics: TableMetricKey[];
  onToggle: (key: TableMetricKey, checked: boolean) => void;
  onHighlight?: (key: TableMetricKey | null) => void;
}) {
  const displayedMetrics = tableMetricDefinitions.filter(
    ({ key }) => CORE_METRIC_SET.has(key) || visibleMetrics.includes(key),
  );

  return (
    <div
      className="chart-legend metric-quick-controls"
      aria-label="Quick metric controls"
    >
      {displayedMetrics.map((metric) => {
        const active = visibleMetrics.includes(metric.key);
        const lastVisible = active && visibleMetrics.length === 1;
        return (
          <button
            type="button"
            key={metric.key}
            className={active ? "active" : ""}
            aria-pressed={active}
            disabled={lastVisible}
            onClick={() => {
              onHighlight?.(null);
              onToggle(metric.key, !active);
            }}
            onMouseEnter={() => active && onHighlight?.(metric.key)}
            onMouseLeave={() => onHighlight?.(null)}
            onFocus={() => active && onHighlight?.(metric.key)}
            onBlur={() => onHighlight?.(null)}
            title={
              lastVisible
                ? "At least one metric must remain visible"
                : `${active ? "Hide" : "Show"} ${metric.label}`
            }
          >
            <i style={{ backgroundColor: metric.chartColor }} />
            {metric.label}
          </button>
        );
      })}
    </div>
  );
}

const CHART_SERIES_DURATION = 320;
const CHART_DATA_DURATION = 360;
const CHART_SERIES_EXIT_DURATION = 140;
const CHART_ANIMATION_LIMIT = 200;
const BAR_LABEL_BUILD_MARKER = "postpulse-bar-label-remount-v1";
const chartDatumMatcher = matchByDataKey("key");

function AnimatedAxisLabels({
  data,
  width,
  pulseRevision,
  reducedMotion,
}: {
  data: ChartDatum[];
  width: number;
  pulseRevision: number;
  reducedMotion: boolean;
}) {
  const availableWidth = width ? Math.max(0, width - 54) : 156;
  const visibleIndexes = selectAxisLabelIndexes(
    data.length,
    availableWidth,
  );
  const visibleIndexSet = new Set(visibleIndexes);
  const style = {
    gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))`,
  } satisfies CSSProperties;

  return (
    <div className="chart-axis-labels" style={style} aria-hidden="true">
      <AnimatePresence initial={false}>
        {data.map((datum, index) => {
          const labelVisible = visibleIndexSet.has(index);
          return (
            <motion.span
              layout={reducedMotion ? false : "position"}
              key={datum.key}
              className="chart-axis-slot"
              style={{ gridColumn: index + 1 }}
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: 3 }}
              transition={{
                layout: {
                  duration: reducedMotion ? 0 : CHART_DATA_DURATION / 1000,
                  ease: [0.22, 1, 0.36, 1],
                },
                opacity: { duration: reducedMotion ? 0 : 0.14 },
                y: { duration: reducedMotion ? 0 : 0.18 },
              }}
            >
              <span className="chart-axis-tick" />
              <motion.span
                className="chart-axis-label"
                data-visible={labelVisible ? "true" : "false"}
                initial={false}
                animate={{ opacity: labelVisible ? 1 : 0 }}
                transition={{
                  duration: reducedMotion ? 0 : 0.14,
                }}
                title={datum.label}
              >
                <motion.span
                  key={`${datum.key}-pulse-${pulseRevision}`}
                  initial={{ color: "#687083" }}
                  animate={
                    pulseRevision && labelVisible && !reducedMotion
                      ? { color: ["#687083", "#2563eb", "#687083"] }
                      : { color: "#687083" }
                  }
                  transition={{
                    duration: reducedMotion ? 0 : 1,
                    times: [0, 0.28, 1],
                    ease: "easeOut",
                  }}
                >
                  {datum.label}
                </motion.span>
              </motion.span>
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function ChartPanel({
  view,
  grouping,
  data,
  visibleMetrics,
  showMetricQuickControls,
  onToggleMetric,
  onDatumClick,
}: {
  view: "bars" | "lines";
  grouping: ChartGrouping;
  data: ChartDatum[];
  visibleMetrics: TableMetricKey[];
  showMetricQuickControls: boolean;
  onToggleMetric: (key: TableMetricKey, checked: boolean) => void;
  onDatumClick: (datum: ChartDatum) => void;
}) {
  const groupingLabel = {
    post: "Every post",
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
  }[grouping];
  const reducedMotion = Boolean(useReducedMotion());
  const [renderedData, setRenderedData] = useState(data);
  const [metricTransition, setMetricTransition] =
    useState<ChartMetricTransitionState>(() => ({
      requestedMetrics: visibleMetrics,
      renderedMetrics: visibleMetrics,
      enteringMetrics: visibleMetrics,
      exitingMetrics: [],
      phase: "series-change",
      revision: 0,
    }));
  const [pulseRevision, setPulseRevision] = useState(0);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const requestedSignature = useMemo(
    () => getChartDataSignature(data),
    [data],
  );
  const requestedMetricsSignature = visibleMetrics.join("|");
  const previousSignatureRef = useRef(requestedSignature);
  const previousMetricsSignatureRef = useRef(requestedMetricsSignature);
  const transitionRevisionRef = useRef(0);
  const {
    renderedMetrics,
    enteringMetrics,
    exitingMetrics,
    phase: motionPhase,
    revision: motionRevision,
  } = metricTransition;
  const showDots = renderedData.length <= 120;
  const showBarLabels = shouldShowBarValueLabels(visibleMetrics.length);
  const renderBarLabels =
    shouldRenderSettledBarValueLabels(metricTransition);
  const animationDuration =
    motionPhase === "data-change"
      ? CHART_DATA_DURATION
      : CHART_SERIES_DURATION;

  const shouldAnimateMetric = (key: TableMetricKey) =>
    !reducedMotion &&
    renderedData.length < CHART_ANIMATION_LIMIT &&
    !exitingMetrics.includes(key) &&
    (motionPhase === "data-change" ||
      enteringMetrics.includes(key));

  const handleHighlight = useCallback((key: TableMetricKey | null) => {
    const chart = chartWrapRef.current;
    if (!chart) return;
    if (key) chart.dataset.highlightedMetric = key;
    else delete chart.dataset.highlightedMetric;
  }, []);

  useEffect(() => {
    const element = chartWrapRef.current;
    if (!element) return;
    const updateWidth = () => setChartWidth(element.clientWidth);
    const frame = window.requestAnimationFrame(updateWidth);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const dataChanged = previousSignatureRef.current !== requestedSignature;
    const metricsChanged =
      previousMetricsSignatureRef.current !== requestedMetricsSignature;

    previousSignatureRef.current = requestedSignature;
    previousMetricsSignatureRef.current = requestedMetricsSignature;
    if (!dataChanged && !metricsChanged) return;

    const revision = transitionRevisionRef.current + 1;
    transitionRevisionRef.current = revision;
    if (dataChanged) {
      setRenderedData(data);
      setPulseRevision((current) => current + 1);
    }
    setMetricTransition((current) =>
      reconcileChartMetricTransition(
        current,
        visibleMetrics,
        dataChanged ? "data-change" : "series-change",
        revision,
      ),
    );
  }, [
    data,
    requestedMetricsSignature,
    requestedSignature,
    visibleMetrics,
  ]);

  useEffect(() => {
    if (motionPhase === "idle") return;
    const revision = motionRevision;

    if (reducedMotion) {
      setMetricTransition((current) =>
        settleChartMetricTransition(current, revision),
      );
      return;
    }

    const duration =
      motionPhase === "data-change"
        ? CHART_DATA_DURATION
        : CHART_SERIES_DURATION;
    const exitTimer = window.setTimeout(() => {
      setMetricTransition((current) =>
        completeChartMetricExit(current, revision),
      );
    }, CHART_SERIES_EXIT_DURATION);
    const settleTimer = window.setTimeout(() => {
      setMetricTransition((current) =>
        settleChartMetricTransition(current, revision),
      );
    }, duration + 40);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(settleTimer);
    };
  }, [
    motionPhase,
    motionRevision,
    reducedMotion,
  ]);

  const handleChartClick = (state: ChartInteractionState) => {
    const datum = resolveChartDatum(state, renderedData);
    if (datum) onDatumClick(datum);
  };

  const activateDirectDatum = (
    datum: ChartDatum | undefined,
    event: { preventDefault: () => void; stopPropagation: () => void },
  ) => {
    if (!datum) return;
    event.preventDefault();
    event.stopPropagation();
    onDatumClick(datum);
  };

  const renderActiveDot = (
    metric: (typeof tableMetricDefinitions)[number],
  ) =>
    function InteractiveActiveDot(props: ActiveDotProps) {
      const datum = props.payload as ChartDatum | undefined;
      if (
        props.cx === undefined ||
        props.cy === undefined ||
        !Number.isFinite(props.cx) ||
        !Number.isFinite(props.cy)
      ) {
        return null;
      }

      return (
        <circle
          cx={props.cx}
          cy={props.cy}
          r={7}
          fill="#fff"
          stroke={metric.chartColor}
          strokeWidth={2.5}
          className={`chart-active-point chart-metric-${metric.key}`}
          role="button"
          tabIndex={0}
          aria-label={`Open ${datum?.title ?? metric.label}`}
          onMouseEnter={() => handleHighlight(metric.key)}
          onFocus={() => handleHighlight(metric.key)}
          onBlur={() => handleHighlight(null)}
          onClick={(event) => activateDirectDatum(datum, event)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              activateDirectDatum(datum, event);
            }
          }}
        />
      );
    };

  const renderDot = (metric: (typeof tableMetricDefinitions)[number]) =>
    function InteractiveDot(props: DotItemDotProps) {
      const datum = props.payload as ChartDatum | undefined;
      if (
        props.cx === undefined ||
        props.cy === undefined ||
        !Number.isFinite(props.cx) ||
        !Number.isFinite(props.cy)
      ) {
        return null;
      }

      return (
        <circle
          cx={props.cx}
          cy={props.cy}
          r={2.8}
          fill="#fff"
          stroke={metric.chartColor}
          strokeWidth={1.8}
          className={`recharts-dot recharts-line-dot chart-series-point chart-metric-${metric.key}`}
          aria-label={`Open ${datum?.title ?? metric.label}`}
          onMouseEnter={() => handleHighlight(metric.key)}
          onClick={(event) => activateDirectDatum(datum, event)}
        />
      );
    };

  const commonChartElements = (
    <>
      <CartesianGrid vertical={false} stroke="#e7e9ee" />
      <XAxis
        dataKey="key"
        tick={false}
        tickLine={false}
        axisLine={false}
        height={32}
      />
      <YAxis
        domain={[0, 100]}
        ticks={[0, 25, 50, 75, 100]}
        tickLine={false}
        axisLine={false}
        width={44}
        tick={{ fill: "#687083", fontSize: 11 }}
        tickFormatter={(value) => `${value}%`}
      />
      <Tooltip
        cursor={{ fill: "#eef2ff", stroke: "#c8d7f5" }}
        content={<ChartTooltip />}
        isAnimationActive={false}
        wrapperStyle={{ pointerEvents: "none", zIndex: 20 }}
      />
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <section className="chart-panel" data-testid={`${view}-chart`}>
      <div className="chart-heading">
        <div>
          <span className="chart-kicker">{groupingLabel.toUpperCase()}</span>
          <h3>{view === "bars" ? "Post comparison" : "Performance patterns"}</h3>
          <p>
            Each metric uses a relative 0–100 scale so smaller signals stay
            readable. Hover for exact values.
          </p>
        </div>
        <div className="chart-click-hint">
          <MousePointerClick size={14} />
          Click a bar, point, or hover band to open its post.
        </div>
      </div>

      {showMetricQuickControls ? (
        <MetricQuickControls
          visibleMetrics={visibleMetrics}
          onToggle={onToggleMetric}
          onHighlight={handleHighlight}
        />
      ) : null}

      <div
        ref={chartWrapRef}
        className={`chart-wrap chart-wrap-clickable ${
          view === "bars" ? "bar-chart-wrap" : "line-chart-wrap"
        }`}
        data-motion-phase={motionPhase}
        data-bar-labels-visible={renderBarLabels ? "true" : "false"}
        role="img"
        aria-label={`${view === "bars" ? "Grouped bar" : "Multi-line"} chart showing ${visibleMetrics.length} visible metrics`}
        onMouseLeave={() => handleHighlight(null)}
      >
        <ResponsiveContainer width="100%" height="100%">
          {view === "bars" ? (
            <BarChart
              data={renderedData}
              margin={{
                top: showBarLabels ? 34 : 18,
                right: 8,
                left: 0,
                bottom: 0,
              }}
              barCategoryGap="18%"
              barGap={1}
              accessibilityLayer
              onClick={handleChartClick}
            >
              {commonChartElements}
              {tableMetricDefinitions
                .filter(({ key }) => renderedMetrics.includes(key))
                .map((metric) => (
                  <Bar
                    key={`${BAR_LABEL_BUILD_MARKER}-${metric.key}-${motionRevision}-${motionPhase}`}
                    dataKey={`normalized.${metric.key}`}
                    name={metric.label}
                    fill={metric.chartColor}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                    animationMatchBy={chartDatumMatcher}
                    animationDuration={animationDuration}
                    animationEasing="ease-out"
                    className={`chart-series chart-bar-series chart-metric-${metric.key} ${
                      exitingMetrics.includes(metric.key)
                        ? "chart-series-exiting"
                        : ""
                    }`}
                    onMouseEnter={() => handleHighlight(metric.key)}
                    onClick={(bar, _index, event) =>
                      activateDirectDatum(bar.payload as ChartDatum, event)
                    }
                    isAnimationActive={
                      shouldAnimateMetric(metric.key) ? "auto" : false
                    }
                  >
                    <LabelList
                      key={`${metric.key}-labels`}
                      id={`bar-value-${metric.key}`}
                      dataKey={metric.key}
                      position="top"
                      offset={7}
                      fill="#495469"
                      zIndex={2100}
                      formatter={(value) =>
                        formatBarValueLabel(
                          metric.key,
                          value === null || value === undefined
                            ? null
                            : Number(value),
                        )
                      }
                      className={`chart-bar-value-label chart-metric-${metric.key}`}
                    />
                  </Bar>
                ))}
            </BarChart>
          ) : (
            <LineChart
              data={renderedData}
              margin={{ top: 18, right: 10, left: 0, bottom: 0 }}
              accessibilityLayer
              onClick={handleChartClick}
            >
              {commonChartElements}
              {tableMetricDefinitions
                .filter(({ key }) => renderedMetrics.includes(key))
                .map((metric) => (
                  <Line
                    key={metric.key}
                    type="linear"
                    dataKey={`normalized.${metric.key}`}
                    name={metric.label}
                    stroke={metric.chartColor}
                    strokeWidth={2.2}
                    strokeDasharray={metric.lineDash}
                    zIndex={400}
                    animationMatchBy={chartDatumMatcher}
                    animationDuration={animationDuration}
                    animationEasing="ease-out"
                    className={`chart-series chart-line-series chart-metric-${metric.key} ${
                      exitingMetrics.includes(metric.key)
                        ? "chart-series-exiting"
                        : ""
                    }`}
                    onMouseEnter={() => handleHighlight(metric.key)}
                    dot={showDots ? renderDot(metric) : false}
                    activeDot={renderActiveDot(metric)}
                    connectNulls={false}
                    isAnimationActive={
                      shouldAnimateMetric(metric.key) ? "auto" : false
                    }
                  />
                ))}
            </LineChart>
          )}
        </ResponsiveContainer>
        <AnimatedAxisLabels
          data={renderedData}
          width={chartWidth}
          pulseRevision={pulseRevision}
          reducedMotion={reducedMotion}
        />
        {pulseRevision > 0 && !reducedMotion ? (
          <motion.span
            key={pulseRevision}
            className="chart-change-pulse"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.72, 0] }}
            transition={{
              duration: 1,
              times: [0, 0.22, 1],
              ease: "easeOut",
            }}
          />
        ) : null}
      </div>
      </section>
    </MotionConfig>
  );
}

function getStatusText(result: CsvParseResult) {
  const notices = [
    result.skippedRows ? `${result.skippedRows} skipped` : "",
    result.duplicateRows ? `${result.duplicateRows} duplicate` : "",
    result.mismatchRows ? `${result.mismatchRows} recalculated engagement` : "",
    result.invalidNumericCells
      ? `${result.invalidNumericCells} invalid numbers set to 0`
      : "",
    result.parserWarnings ? `${result.parserWarnings} parser warning` : "",
  ].filter(Boolean);
  return notices.length ? notices.join(" · ") : "All rows validated";
}

export default function Home() {
  const [dataset, setDataset] = useState<CsvParseResult>(EMPTY_DATASET);
  const [fileName, setFileName] = useState("");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [rankingMetrics, setRankingMetrics] = useState<
    CorePerformanceMetricKey[]
  >(["views"]);
  const [resultOrder, setResultOrder] =
    useState<ResultOrder>("performance-desc");
  const [view, setView] = useState<DashboardView>("table");
  const [chartGrouping, setChartGrouping] =
    useState<ChartGrouping>("post");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rangesOpen, setRangesOpen] = useState(false);
  const [rankingMenuOpen, setRankingMenuOpen] = useState(false);
  const [showMetricQuickControls, setShowMetricQuickControls] =
    useState(true);
  const [tableInternalScroll, setTableInternalScroll] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    visibilityFromMetrics(DEFAULT_VISIBLE_METRICS),
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [copiedPostId, setCopiedPostId] = useState("");
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [chooserDatum, setChooserDatum] = useState<ChartDatum | null>(null);
  const rankingMenuRef = useRef<HTMLDivElement | null>(null);
  const rankingMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    try {
      const preferences = parseDashboardPreferences(
        window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ??
          window.localStorage.getItem(LEGACY_PREFERENCES_STORAGE_KEY) ??
          window.localStorage.getItem(LEGACY_V2_PREFERENCES_STORAGE_KEY),
        window.localStorage.getItem(LEGACY_VISIBILITY_KEY),
        window.localStorage.getItem(LEGACY_VIEW_KEY),
      );
      setView(preferences.view);
      setColumnVisibility(
        visibilityFromMetrics(preferences.visibleMetrics),
      );
      setRankingMetrics(preferences.rankingMetrics);
      setResultOrder(preferences.resultOrder);
      setChartGrouping(preferences.chartGrouping);
      setShowMetricQuickControls(preferences.showMetricQuickControls);
      setTableInternalScroll(preferences.tableInternalScroll);
      setPagination({ pageIndex: 0, pageSize: preferences.pageSize });
    } catch {
      // The dashboard remains usable when browser storage is unavailable.
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  const visibleMetricKeys = useMemo(
    () =>
      tableMetricDefinitions
        .filter(({ key }) => columnVisibility[key] !== false)
        .map(({ key }) => key),
    [columnVisibility],
  );
  useEffect(() => {
    if (!preferencesReady) return;
    const preferences: DashboardPreferencesV4 = {
      version: 4,
      view,
      visibleMetrics: visibleMetricKeys,
      rankingMetrics,
      resultOrder,
      chartGrouping,
      pageSize: pagination.pageSize as 25 | 50 | 100,
      showMetricQuickControls,
      tableInternalScroll,
    };
    try {
      window.localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
      window.localStorage.removeItem(LEGACY_PREFERENCES_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_V2_PREFERENCES_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_VISIBILITY_KEY);
      window.localStorage.removeItem(LEGACY_VIEW_KEY);
    } catch {
      // Device preferences are optional in private or restricted browsing.
    }
  }, [
    chartGrouping,
    pagination.pageSize,
    preferencesReady,
    rankingMetrics,
    resultOrder,
    showMetricQuickControls,
    tableInternalScroll,
    view,
    visibleMetricKeys,
  ]);

  useEffect(() => {
    if (!chooserDatum) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChooserDatum(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [chooserDatum]);

  useEffect(() => {
    if (!rankingMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        rankingMenuRef.current &&
        !rankingMenuRef.current.contains(event.target as Node)
      ) {
        setRankingMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setRankingMenuOpen(false);
      rankingMenuButtonRef.current?.focus();
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [rankingMenuOpen]);

  const posts = dataset.posts;
  const hasDataset = posts.length > 0;
  const filteredPosts = useMemo(
    () => filterPosts(posts, filters),
    [posts, filters],
  );
  const activeSorting = useMemo(
    () => getResultSortRule(resultOrder),
    [resultOrder],
  );
  const sortedPosts = useMemo(
    () => sortPosts(filteredPosts, activeSorting, rankingMetrics),
    [activeSorting, filteredPosts, rankingMetrics],
  );
  const totals = useMemo(() => calculateTotals(filteredPosts), [filteredPosts]);
  const chartData = useMemo(
    () =>
      buildChartData(
        filteredPosts,
        chartGrouping,
        activeSorting,
        rankingMetrics,
      ),
    [activeSorting, chartGrouping, filteredPosts, rankingMetrics],
  );
  const pages = useMemo(
    () => [...new Set(posts.map((post) => post.pageName))].sort(),
    [posts],
  );
  const postTypes = useMemo(
    () => [...new Set(posts.map((post) => post.postType))].sort(),
    [posts],
  );
  const extremes = useMemo(() => {
    return Object.fromEntries(
      tableMetricDefinitions.map(({ key }) => {
        const values = filteredPosts
          .map((post) => getMetricValue(post, key))
          .filter((value): value is number => value !== null);
        return [
          key,
          {
            min: values.length ? Math.min(...values) : 0,
            max: values.length ? Math.max(...values) : 0,
          },
        ];
      }),
    ) as Record<TableMetricKey, { min: number; max: number }>;
  }, [filteredPosts]);

  const copyPostTitle = useCallback(async (post: PostMetric) => {
    const cleanTitle = stripHashtagWords(post.title) || "Untitled post";
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(cleanTitle);
          copied = true;
        } catch {
          // Fall back for browsers that expose Clipboard but deny write access.
        }
      }
      if (!copied) {
        const textarea = document.createElement("textarea");
        textarea.value = cleanTitle;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Copy failed");
      }
      setCopiedPostId(post.postId);
      window.setTimeout(
        () =>
          setCopiedPostId((current) =>
            current === post.postId ? "" : current,
          ),
        1800,
      );
    } catch {
      setCopiedPostId("");
    }
  }, []);

  const columns = useMemo<ColumnDef<PostMetric>[]>(() => {
    const base: ColumnDef<PostMetric>[] = [
      {
        id: "post",
        accessorFn: (post) => post.title,
        enableSorting: false,
        header: "Post",
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination;
          const pageRowIndex = table
            .getRowModel()
            .rows.findIndex((candidate) => candidate.id === row.id);
          return (
            <PostCell
              post={row.original}
              rank={getDisplayedRowNumber(
                pageIndex,
                pageSize,
                Math.max(0, pageRowIndex),
              )}
              copied={copiedPostId === row.original.postId}
              onCopy={() => copyPostTitle(row.original)}
            />
          );
        },
      },
      {
        id: "publishedAt",
        accessorKey: "publishedAt",
        enableSorting: false,
        header: "Publish date",
        cell: ({ getValue }) => (
          <time dateTime={new Date(getValue<number>()).toISOString()}>
            {formatDate(getValue<number>())}
          </time>
        ),
      },
    ];

    const metricColumns: ColumnDef<PostMetric>[] = tableMetricDefinitions.map(
      ({ key, label }) => ({
        id: key,
        accessorFn: (post) => getMetricValue(post, key),
        enableSorting: false,
        header: () => {
          const isRankingMetric = rankingMetrics.includes(
            key as CorePerformanceMetricKey,
          );
          return (
            <div
              className={`metric-column-heading ${
                isRankingMetric ? "is-ranking" : ""
              }`}
              title={
                isRankingMetric
                  ? `${label} contributes to balanced ranking`
                  : undefined
              }
            >
              <span>{label}</span>
              {isRankingMetric ? (
                <span className="ranking-indicator">
                  <Sparkles size={10} /> Ranking
                </span>
              ) : null}
            </div>
          );
        },
        cell: ({ getValue }) => (
          <MetricBar
            value={getValue<number | null>()}
            min={extremes[key].min}
            max={extremes[key].max}
            label={label}
            percent={key === "engagementRate"}
          />
        ),
      }),
    );
    return [...base, ...metricColumns];
  }, [copiedPostId, copyPostTitle, extremes, rankingMetrics]);

  const table = useReactTable({
    data: sortedPosts,
    columns,
    state: { columnVisibility, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSorting: false,
  });

  useEffect(() => {
    table.setPageIndex(0);
  }, [fileName, filters, table]);

  const activeRangeCount = Object.values(filters.ranges).filter(
    (range) => range?.min !== undefined || range?.max !== undefined,
  ).length;
  const activeFilterCount =
    activeRangeCount +
    Number(Boolean(filters.search)) +
    Number(filters.datePreset !== DEFAULT_DATE_PRESET) +
    Number(Boolean(filters.pageName)) +
    Number(Boolean(filters.postType));

  const kpis: Array<{
    icon: Icon;
    label: string;
    value: string;
    note: string;
    tone?: "blue" | "amber";
  }> = [
    {
      icon: FileSpreadsheet,
      label: "Posts",
      value: formatCount(totals.posts),
      note: `${filteredPosts.length} matching`,
    },
    {
      icon: Sparkles,
      label: "Views",
      value: formatCount(totals.views),
      note: "Total post views",
    },
    {
      icon: Users,
      label: "Reach",
      value: formatCount(totals.reach),
      note: "Cumulative post reach",
    },
    {
      icon: ThumbsUp,
      label: "Engagement",
      value: formatCount(totals.engagement),
      note: "Reactions + comments + shares",
    },
    {
      icon: BarChart3,
      label: "Engagement rate",
      value: formatPercent(totals.engagementRate),
      note: "Engagement ÷ reach",
      tone: "amber",
    },
  ];

  function toggleMetricVisibility(key: TableMetricKey, checked: boolean) {
    const currentlyVisible = visibleMetricKeys.includes(key);
    if (!checked && currentlyVisible && visibleMetricKeys.length === 1) return;

    setColumnVisibility((current) => ({ ...current, [key]: checked }));
  }

  function toggleRankingMetric(
    key: CorePerformanceMetricKey,
    checked: boolean,
  ) {
    setRankingMetrics((current) => {
      if (!checked && current.includes(key) && current.length === 1) {
        return current;
      }
      return CORE_PERFORMANCE_METRICS.filter((metric) =>
        metric === key ? checked : current.includes(metric),
      );
    });
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError("");
    try {
      const nextDataset = parseFacebookCsv(await file.text());
      setDataset(nextDataset);
      setFileName(file.name);
      setFilters(defaultFilters);
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "This CSV could not be read.",
      );
    } finally {
      event.target.value = "";
    }
  }

  function updateRange(
    key: TableMetricKey,
    bound: keyof NumericRange,
    value: string,
  ) {
    setFilters((current) => {
      const nextRange = {
        ...current.ranges[key],
        [bound]: value === "" ? undefined : Number(value),
      };
      if (nextRange.min === undefined && nextRange.max === undefined) {
        const nextRanges = { ...current.ranges };
        delete nextRanges[key];
        return { ...current, ranges: nextRanges };
      }
      return {
        ...current,
        ranges: { ...current.ranges, [key]: nextRange },
      };
    });
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setRankingMetrics(["views"]);
    setResultOrder("performance-desc");
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function toggleAdvancedFilters() {
    if (advancedOpen) setRangesOpen(false);
    setAdvancedOpen((open) => !open);
  }

  function restoreDefaultLayout() {
    const defaults = DEFAULT_DASHBOARD_PREFERENCES;
    setView(defaults.view);
    setColumnVisibility(visibilityFromMetrics(defaults.visibleMetrics));
    setChartGrouping(defaults.chartGrouping);
    setShowMetricQuickControls(defaults.showMetricQuickControls);
    setTableInternalScroll(defaults.tableInternalScroll);
    setPagination({ pageIndex: 0, pageSize: defaults.pageSize });
  }

  function handleChartDatumClick(datum: ChartDatum) {
    if (chartGrouping === "post" && datum.permalink) {
      openPost(datum.permalink);
      return;
    }
    setChooserDatum(datum);
  }

  function toggleExpandedPost(postId: string) {
    setExpandedPosts((current) => {
      const next = new Set(current);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  const customDateValid = isCustomDateRangeValid(
    filters.customStart,
    filters.customEnd,
  );
  const rankingMetricsSummary =
    rankingMetrics.length <= 2
      ? coreMetricDefinitions
          .filter(({ key }) => rankingMetrics.includes(key))
          .map(({ label }) => label)
          .join(" + ")
      : `${rankingMetrics.length} metrics selected`;
  const performanceOrdering = resultOrder.startsWith("performance");

  return (
    <>
      <main className="dashboard-shell">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <BarChart3 size={22} strokeWidth={2.2} />
            </div>
            <div>
              <span>POSTPULSE</span>
              <strong>Facebook analytics</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="privacy-badge">
              <CheckCircle2 size={14} />
              Files stay on this device
            </div>
            <label className="button button-primary upload-button">
              <Upload size={16} />
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleUpload}
                data-testid="csv-upload"
              />
            </label>
          </div>
        </header>

        <section className="hero-section">
          <div>
            <p className="eyebrow">PERFORMANCE OVERVIEW</p>
            <h1>Facebook post performance, made clear.</h1>
            <p className="hero-copy">
              Compare every post, spot what earns attention, and understand the
              engagement behind the numbers.
            </p>
          </div>
          {hasDataset ? (
            <aside className="dataset-card" aria-label="Loaded dataset">
              <FileSpreadsheet size={18} />
              <div>
                <span>Loaded dataset</span>
                <strong title={fileName}>{fileName}</strong>
                <small>
                  {formatDateRange(posts)} · {formatCount(posts.length)} posts
                </small>
              </div>
            </aside>
          ) : null}
        </section>

        {hasDataset ? (
          <>
            <div
              className={`data-status ${uploadError ? "data-status-error" : ""}`}
              role="status"
            >
              {uploadError ? (
                <AlertTriangle size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
              <span>
                {uploadError ||
                  `${getStatusText(dataset)}. Engagement is recalculated from reactions, comments, and shares.`}
              </span>
            </div>

            <section className="kpi-grid" aria-label="Performance summary">
              {kpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} />
              ))}
            </section>

            <section className="workspace-card">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">POST EXPLORER</p>
              <h2>Find what drives performance</h2>
            </div>
            <div className="view-toggle" aria-label="Choose dashboard view">
              <button
                className={view === "table" ? "active" : ""}
                onClick={() => setView("table")}
                aria-pressed={view === "table"}
              >
                <Table2 size={15} /> Table
              </button>
              <button
                className={view === "bars" ? "active" : ""}
                onClick={() => setView("bars")}
                aria-pressed={view === "bars"}
              >
                <BarChart3 size={15} /> Bar chart
              </button>
              <button
                className={view === "lines" ? "active" : ""}
                onClick={() => setView("lines")}
                aria-pressed={view === "lines"}
              >
                <Activity size={15} /> Line chart
              </button>
            </div>
          </div>

          <div
            className="ranking-controls"
            aria-label="Ranking controls"
            data-ranking-model="postpulse-independent-ranking-v1"
          >
            <section className="ranking-control-card">
              <div className="ranking-control-heading">
                <span>1</span>
                <div>
                  <strong>Date range</strong>
                  <small>Anchored to the latest post</small>
                </div>
              </div>
              <select
                value={filters.datePreset}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    datePreset: event.target.value as DatePreset,
                  }))
                }
                aria-label="Date range"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
                <option value="custom">Custom range</option>
              </select>
            </section>

            <section className="ranking-control-card ranking-metrics-card">
              <div className="ranking-control-heading">
                <span>2</span>
                <div>
                  <strong>Ranking metrics</strong>
                  <small>Choose the signals that determine post rank</small>
                </div>
              </div>
              <div className="ranking-metric-dropdown" ref={rankingMenuRef}>
                <button
                  ref={rankingMenuButtonRef}
                  type="button"
                  className="ranking-metric-trigger"
                  aria-expanded={rankingMenuOpen}
                  aria-controls="ranking-metric-options"
                  onClick={() => setRankingMenuOpen((open) => !open)}
                >
                  <span>{rankingMetricsSummary}</span>
                  <ChevronDown
                    size={15}
                    className={rankingMenuOpen ? "expanded" : ""}
                  />
                </button>
                {rankingMenuOpen ? (
                  <div
                    className="ranking-metric-menu"
                    id="ranking-metric-options"
                    role="group"
                    aria-label="Metrics used to rank posts"
                  >
                    {coreMetricDefinitions.map(
                      ({ key, label, chartColor }) => {
                        const checked = rankingMetrics.includes(key);
                        const lastRankingMetric =
                          checked && rankingMetrics.length === 1;
                        return (
                          <label key={key}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={lastRankingMetric}
                              onChange={(event) =>
                                toggleRankingMetric(
                                  key,
                                  event.target.checked,
                                )
                              }
                            />
                            <i style={{ backgroundColor: chartColor }} />
                            <span>{label}</span>
                            {checked ? <Check size={13} /> : null}
                          </label>
                        );
                      },
                    )}
                    <p>
                      Posts that perform consistently across all selected
                      metrics rank higher.
                    </p>
                  </div>
                ) : null}
              </div>
              <p className="balanced-ranking-note">
                <Sparkles size={12} />
                Balancing {rankingMetrics.length}{" "}
                {rankingMetrics.length === 1 ? "metric" : "metrics"} equally.
              </p>
            </section>

            <section className="ranking-control-card">
              <div className="ranking-control-heading">
                <span>3</span>
                <div>
                  <strong>Order results</strong>
                  <small>Rank by performance or publish date</small>
                </div>
              </div>
              <select
                value={resultOrder}
                onChange={(event) =>
                  setResultOrder(event.target.value as ResultOrder)
                }
                aria-label="Order results"
              >
                <option value="performance-desc">Best performance</option>
                <option value="performance-asc">Lowest performance</option>
                <option value="date-desc">Newest posts</option>
                <option value="date-asc">Oldest posts</option>
              </select>
              <p className="order-result-note">
                {performanceOrdering
                  ? `Uses ${rankingMetricsSummary} for balanced ranking.`
                  : "Ranking metrics stay selected for when you return to performance."}
              </p>
            </section>
          </div>

          <div className="control-bar utility-control-bar">
            <label className="search-control">
              <span className="sr-only">Search posts</span>
              <Search size={16} />
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Search posts or page…"
                data-testid="search-posts"
              />
            </label>

            {view !== "table" ? (
              <label className="select-control group-control">
                <span>Group</span>
                <select
                  value={chartGrouping}
                  onChange={(event) =>
                    setChartGrouping(event.target.value as ChartGrouping)
                  }
                  aria-label="Chart grouping"
                >
                  <option value="post">Every post</option>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </label>
            ) : null}

            <button
              className={`button button-secondary filter-button ${advancedOpen ? "active" : ""}`}
              onClick={toggleAdvancedFilters}
              aria-expanded={advancedOpen}
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFilterCount ? (
                <span className="filter-count">{activeFilterCount}</span>
              ) : null}
            </button>

            <button
              className="button button-ghost reset-button"
              onClick={resetFilters}
            >
              <RotateCcw size={15} /> Reset filters
            </button>
          </div>

          {filters.datePreset === "custom" ? (
            <div className="custom-date-row">
              <label>
                From
                <input
                  type="date"
                  value={filters.customStart}
                  max={filters.customEnd || undefined}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      customStart: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={filters.customEnd}
                  min={filters.customStart || undefined}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      customEnd: event.target.value,
                    }))
                  }
                />
              </label>
              <span className={customDateValid ? "" : "date-range-error"}>
                {customDateValid
                  ? "Custom dates include the full selected days."
                  : "The end date must be on or after the start date."}
              </span>
            </div>
          ) : null}

          {advancedOpen ? (
            <section className="advanced-panel" aria-label="Advanced filters">
              <div className="advanced-section filter-dimensions">
                <div className="advanced-title">
                  <SlidersHorizontal size={15} />
                  <span>Filter dimensions</span>
                </div>
                <div className="dimension-grid">
                  <label>
                    Page
                    <select
                      value={filters.pageName}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          pageName: event.target.value,
                        }))
                      }
                    >
                      <option value="">All pages</option>
                      {pages.map((page) => (
                        <option key={page} value={page}>
                          {page}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Post type
                    <select
                      value={filters.postType}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          postType: event.target.value,
                        }))
                      }
                    >
                      <option value="">All post types</option>
                      {postTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="advanced-section visible-metrics-section">
                <div className="advanced-title advanced-title-layout">
                  <Columns3 size={15} />
                  <span>Visible metrics</span>
                  <button
                    type="button"
                    className="restore-layout"
                    onClick={restoreDefaultLayout}
                  >
                    Restore layout
                  </button>
                </div>
                <p className="preference-note">
                  Controls columns and chart series only. Ranking metrics stay
                  independent. Saved on this device.
                </p>
                <label className="quick-controls-setting">
                  <input
                    type="checkbox"
                    checked={showMetricQuickControls}
                    onChange={(event) =>
                      setShowMetricQuickControls(event.target.checked)
                    }
                  />
                  <span>
                    <strong>Show quick metric buttons</strong>
                    <small>
                      Keep metric shortcuts above the table and charts.
                    </small>
                  </span>
                </label>
                <label className="quick-controls-setting">
                  <input
                    type="checkbox"
                    checked={tableInternalScroll}
                    onChange={(event) =>
                      setTableInternalScroll(event.target.checked)
                    }
                  />
                  <span>
                    <strong>Scrollable table</strong>
                    <small>
                      Keep long desktop tables inside a fixed-height frame.
                    </small>
                  </span>
                </label>
                <div className="column-options">
                  {tableMetricDefinitions.map(({ key, label, chartColor }) => {
                    const checked = visibleMetricKeys.includes(key);
                    return (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={checked && visibleMetricKeys.length === 1}
                          onChange={(event) =>
                            toggleMetricVisibility(key, event.target.checked)
                          }
                        />
                        <i style={{ backgroundColor: chartColor }} />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="range-disclosure">
                <button
                  type="button"
                  className="range-disclosure-button"
                  onClick={() => setRangesOpen((open) => !open)}
                  aria-expanded={rangesOpen}
                  aria-controls="metric-range-settings"
                >
                  <span className="range-disclosure-icon">
                    <ArrowDownUp size={15} />
                  </span>
                  <span>
                    <strong>Metric ranges</strong>
                    <small>Optional minimum and maximum filters</small>
                  </span>
                  {activeRangeCount ? (
                    <b>
                      {activeRangeCount}{" "}
                      {activeRangeCount === 1 ? "range" : "ranges"} active
                    </b>
                  ) : (
                    <b>No ranges active</b>
                  )}
                  <ChevronDown
                    className={rangesOpen ? "expanded" : ""}
                    size={16}
                  />
                </button>

                {rangesOpen ? (
                  <div className="range-panel" id="metric-range-settings">
                    <div className="range-panel-heading">
                      <span>Leave a field blank for no limit.</span>
                    </div>
                    <div className="range-grid">
                      {tableMetricDefinitions.map(({ key, label }) => (
                        <div className="range-row" key={key}>
                          <span>{label}</span>
                          <label>
                            <span className="sr-only">Minimum {label}</span>
                            <input
                              type="number"
                              min="0"
                              step={key === "engagementRate" ? "0.1" : "1"}
                              placeholder="Min"
                              value={filters.ranges[key]?.min ?? ""}
                              onChange={(event) =>
                                updateRange(key, "min", event.target.value)
                              }
                            />
                          </label>
                          <span className="range-dash">—</span>
                          <label>
                            <span className="sr-only">Maximum {label}</span>
                            <input
                              type="number"
                              min="0"
                              step={key === "engagementRate" ? "0.1" : "1"}
                              placeholder="Max"
                              value={filters.ranges[key]?.max ?? ""}
                              onChange={(event) =>
                                updateRange(key, "max", event.target.value)
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="results-meta">
            <span>
              <strong>{formatCount(filteredPosts.length)}</strong>{" "}
              {filteredPosts.length === 1 ? "post" : "posts"} matched
            </span>
            {view === "table" ? (
              <div className="bar-legend" aria-label="Metric bar color legend">
                <span>
                  <i className="legend-dot legend-dot-blue" /> Highest
                </span>
                <span>
                  <i className="legend-dot legend-dot-neutral" /> Middle
                </span>
                <span>
                  <i className="legend-dot legend-dot-amber" /> Lowest
                </span>
              </div>
            ) : (
              <span className="relative-scale-note">
                <Info size={13} /> Relative height; exact values appear on hover
              </span>
            )}
          </div>

          {view === "table" ? (
            filteredPosts.length ? (
              <>
                {showMetricQuickControls ? (
                  <MetricQuickControls
                    visibleMetrics={visibleMetricKeys}
                    onToggle={toggleMetricVisibility}
                  />
                ) : null}
                <div
                  className={`table-frame ${
                    tableInternalScroll ? "table-frame-scrollable" : ""
                  }`}
                  data-testid="metrics-table"
                >
                  <table>
                    <thead>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className={[
                                header.id === "post" ? "sticky-column" : "",
                                rankingMetrics.includes(
                                  header.id as CorePerformanceMetricKey,
                                )
                                  ? "ranking-column"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className={
                                cell.column.id === "post"
                                  ? "sticky-column"
                                  : ""
                              }
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-post-list">
                  {table.getRowModel().rows.map((row, pageRowIndex) => {
                    const post = row.original;
                    const expanded = expandedPosts.has(post.postId);
                    const headline = getPostHeadline(post.title);
                    const rank = getDisplayedRowNumber(
                      table.getState().pagination.pageIndex,
                      table.getState().pagination.pageSize,
                      pageRowIndex,
                    );
                    return (
                      <article className="mobile-post-card" key={post.postId}>
                        <div className="mobile-post-card-header">
                          <span
                            className="post-rank mobile-post-rank"
                            aria-label={`Result ${rank}`}
                          >
                            {rank}
                          </span>
                          {post.permalink ? (
                            <a
                              className="mobile-post-open"
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open Facebook post: ${headline}`}
                            >
                              <span>{post.postType}</span>
                              <strong>{headline}</strong>
                              <small>{formatDate(post.publishedAt)}</small>
                            </a>
                          ) : (
                            <div className="mobile-post-open">
                              <span>{post.postType}</span>
                              <strong>{headline}</strong>
                              <small>{formatDate(post.publishedAt)}</small>
                            </div>
                          )}
                          <CopyTitleButton
                            copied={copiedPostId === post.postId}
                            onCopy={() => copyPostTitle(post)}
                          />
                          <button
                            type="button"
                            className={`mobile-expand-button ${expanded ? "expanded" : ""}`}
                            onClick={() => toggleExpandedPost(post.postId)}
                            aria-expanded={expanded}
                            aria-label={`${expanded ? "Hide" : "Show"} metrics for ${headline}`}
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                        {expanded ? (
                          <div className="mobile-metrics">
                            {tableMetricDefinitions
                              .filter(({ key }) =>
                                visibleMetricKeys.includes(key),
                              )
                              .map(({ key, label }) => (
                                <div key={key}>
                                  <span
                                    className={
                                      rankingMetrics.includes(
                                        key as CorePerformanceMetricKey,
                                      )
                                        ? "mobile-ranking-label"
                                        : ""
                                    }
                                  >
                                    {label}
                                    {rankingMetrics.includes(
                                      key as CorePerformanceMetricKey,
                                    ) ? (
                                      <em>
                                        <Sparkles size={9} /> Ranking
                                      </em>
                                    ) : null}
                                  </span>
                                  <MetricBar
                                    value={getMetricValue(post, key)}
                                    min={extremes[key].min}
                                    max={extremes[key].max}
                                    label={label}
                                    percent={key === "engagementRate"}
                                  />
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Search size={24} />
                <h3>No posts match these filters</h3>
                <p>Try widening a metric range or resetting the filters.</p>
                <button
                  className="button button-secondary"
                  onClick={resetFilters}
                >
                  Reset filters
                </button>
              </div>
            )
          ) : filteredPosts.length ? (
            <ChartPanel
              key={view}
              view={view}
              grouping={chartGrouping}
              data={chartData}
              visibleMetrics={visibleMetricKeys}
              showMetricQuickControls={showMetricQuickControls}
              onToggleMetric={toggleMetricVisibility}
              onDatumClick={handleChartDatumClick}
            />
          ) : (
            <div className="empty-state">
              <BarChart3 size={24} />
              <h3>No chart data to display</h3>
              <p>Adjust the shared filters to include at least one post.</p>
              <button
                className="button button-secondary"
                onClick={resetFilters}
              >
                Reset filters
              </button>
            </div>
          )}

          {view === "table" && filteredPosts.length ? (
            <footer className="table-footer">
              <div>
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {Math.max(1, table.getPageCount())}
              </div>
              <label>
                Rows
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(event) =>
                    table.setPageSize(Number(event.target.value))
                  }
                  aria-label="Rows per page"
                >
                  {[25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <div className="pagination-buttons">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Next page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </footer>
          ) : null}
            </section>

            <section className="metric-guide">
          <div className="guide-heading">
            <div className="guide-icon">
              <Info size={17} />
            </div>
            <div>
              <h2>How to read these metrics</h2>
              <p>Quick definitions for confident reporting.</p>
            </div>
          </div>
          <div className="guide-grid">
            <article>
              <Users size={17} />
              <strong>Reach</strong>
              <p>
                People who saw a post. Summed post reach is not deduplicated.
              </p>
            </article>
            <article>
              <ThumbsUp size={17} />
              <strong>Engagement</strong>
              <p>The total of reactions, comments, and shares.</p>
            </article>
            <article>
              <BarChart3 size={17} />
              <strong>Engagement rate</strong>
              <p>
                Total engagement divided by total reach for the filtered posts.
              </p>
            </article>
            <article>
              <MousePointerClick size={17} />
              <strong>Clicks</strong>
              <p>Actions on the post that are kept separate from engagement.</p>
            </article>
            <article>
              <Share2 size={17} />
              <strong>Shares</strong>
              <p>
                A strong distribution signal when people pass a post along.
              </p>
            </article>
          </div>
            </section>
          </>
        ) : (
          <section
            className={`upload-start-card ${uploadError ? "upload-start-card-error" : ""}`}
            aria-labelledby="upload-start-title"
          >
            <div className="upload-start-icon" aria-hidden="true">
              <FileSpreadsheet size={27} />
            </div>
            <p className="eyebrow">START WITH YOUR DATA</p>
            <h2 id="upload-start-title">Upload a Facebook post metrics CSV</h2>
            <p className="upload-start-copy">
              Choose a Facebook export to compare views, engagement, reach,
              reactions, comments, shares, and clicks.
            </p>
            <label className="button button-primary upload-button upload-start-button">
              <Upload size={17} />
              Upload Facebook CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleUpload}
                data-testid="empty-csv-upload"
              />
            </label>
            <div className="upload-start-privacy">
              <CheckCircle2 size={15} />
              <span>
                Your CSV is processed only in this browser and is not uploaded
                or stored. Refreshing clears the dataset.
              </span>
            </div>
            {uploadError ? (
              <div className="upload-start-error" role="alert">
                <AlertTriangle size={16} />
                <span>{uploadError}</span>
              </div>
            ) : null}
          </section>
        )}

        <footer className="site-footer">
          <span>PostPulse · Local Facebook post analytics</span>
          <span>Data is processed in your browser</span>
        </footer>
      </main>

      {chooserDatum ? (
        <div
          className="chooser-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChooserDatum(null);
          }}
        >
          <section
            className="post-chooser"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-chooser-title"
          >
            <div className="post-chooser-heading">
              <div>
                <span>{chooserDatum.label}</span>
                <h2 id="post-chooser-title">
                  {chooserDatum.postCount === 1
                    ? "Open Facebook post"
                    : `Choose from ${chooserDatum.postCount} posts`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setChooserDatum(null)}
                aria-label="Close post chooser"
                autoFocus
              >
                <X size={17} />
              </button>
            </div>
            <div className="post-chooser-list">
              {chooserDatum.posts.map((post) =>
                post.permalink ? (
                  <a
                    key={post.postId}
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div>
                      <span>
                        {post.postType} · {formatDate(post.publishedAt)}
                      </span>
                      <strong>{getPostHeadline(post.title)}</strong>
                      <small>{post.pageName}</small>
                    </div>
                    <b>
                      {performanceOrdering ? (
                        <>
                          Balanced across
                          <em>
                            {coreMetricDefinitions
                              .filter(({ key }) =>
                                rankingMetrics.includes(key),
                              )
                              .map(({ compactLabel }) => compactLabel)
                              .join(" + ")}
                          </em>
                        </>
                      ) : (
                        <>
                          Published
                          <em>{formatDate(post.publishedAt)}</em>
                        </>
                      )}
                    </b>
                    <ExternalLink size={15} />
                  </a>
                ) : (
                  <div className="post-chooser-disabled" key={post.postId}>
                    <div>
                      <span>
                        {post.postType} · {formatDate(post.publishedAt)}
                      </span>
                      <strong>{getPostHeadline(post.title)}</strong>
                      <small>No Facebook URL in this export</small>
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
        </div>
      ) : null}

      <span className="sr-only" aria-live="polite">
        {copiedPostId ? "Post title copied to clipboard." : ""}
      </span>
    </>
  );
}
