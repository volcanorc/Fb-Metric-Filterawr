import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  DEFAULT_DATE_PRESET,
  applyDuplicateTitleMode,
  buildChartData,
  calculateBalancedPerformanceScores,
  calculateTotals,
  completeChartMetricExit,
  filterPosts,
  formatBarValueLabel,
  getChartDataSignature,
  getDisplayedRowNumber,
  getDateBounds,
  getDuplicateTitleKey,
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
  getPostHeadline,
} from "../app/metrics.ts";
import { SAMPLE_CSV } from "../app/sample-data.ts";

test("parses the supplied sample and reconciles the expected totals", () => {
  const result = parseFacebookCsv(SAMPLE_CSV);
  const totals = calculateTotals(result.posts);

  assert.equal(result.posts.length, 3);
  assert.equal(totals.views, 798);
  assert.equal(totals.reach, 493);
  assert.equal(totals.engagement, 23);
  assert.equal(totals.reactions, 13);
  assert.equal(totals.comments, 1);
  assert.equal(totals.shares, 9);
  assert.equal(totals.totalClicks, 6);
  assert.equal(result.mismatchRows, 0);
  assert.equal(
    [...result.posts].sort((a, b) => b.views - a.views)[0].views,
    611,
  );
});

test("keeps large IDs as strings and applies search, dates, and ranges", () => {
  const result = parseFacebookCsv(SAMPLE_CSV);
  assert.equal(result.posts[0].postId, "1053818474000607");

  const filtered = filterPosts(result.posts, {
    search: "retreat",
    datePreset: "7d",
    customStart: "",
    customEnd: "",
    pageName: "",
    postType: "Photos",
    ranges: { views: { min: 600 }, engagement: { max: 11 } },
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].views, 611);
});

test("skips invalid and duplicate rows, recalculates engagement, and handles zero reach", () => {
  const csv = `"Post ID","Page name","Publish time",Views,Reach,"Reactions, Comments and Shares",Reactions,Comments,Shares
9007199254740993123,Example,"07/20/2026 02:00",10,0,99,2,1,1
9007199254740993123,Example,"07/21/2026 02:00",12,5,4,2,1,1
invalid,Example,not-a-date,5,5,1,1,0,0`;
  const result = parseFacebookCsv(csv);

  assert.equal(result.posts.length, 1);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.skippedRows, 1);
  assert.equal(result.mismatchRows, 1);
  assert.equal(result.posts[0].engagement, 4);
  assert.equal(result.posts[0].engagementRate, null);
});

test("sorts table and chart source posts with the same rule", () => {
  const posts = parseFacebookCsv(SAMPLE_CSV).posts;

  assert.deepEqual(
    sortPosts(posts, [{ id: "views", desc: true }]).map((post) => post.views),
    [611, 106, 81],
  );
  assert.deepEqual(
    sortPosts(posts, [{ id: "publishedAt", desc: false }]).map(
      (post) => post.views,
    ),
    [81, 611, 106],
  );
});

test("balances selected metrics instead of rewarding one-metric outliers", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const posts = [
    {
      ...base,
      postId: "balanced",
      publishedAt: base.publishedAt,
      views: 100,
      engagement: 100,
    },
    {
      ...base,
      postId: "views-outlier",
      publishedAt: base.publishedAt - 1,
      views: 120,
      engagement: 20,
    },
    {
      ...base,
      postId: "engagement-outlier",
      publishedAt: base.publishedAt - 2,
      views: 20,
      engagement: 120,
    },
  ];

  const sorted = sortPosts(
    posts,
    [{ id: "overallPerformance", desc: true }],
    ["views", "engagement"],
  );
  assert.equal(sorted[0].postId, "balanced");

  const zeroComments = posts.map((post) => ({ ...post, comments: 0 }));
  const scores = calculateBalancedPerformanceScores(zeroComments, [
    "views",
    "comments",
  ]);
  assert.ok(Math.abs(scores[0] - 100 / 1.2) < 0.000001);
  assert.equal(scores[1], 100);
  assert.ok(Math.abs(scores[2] - 100 / 6) < 0.000001);
});

test("normalizes cleaned duplicate titles within each Facebook page", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const first = {
    ...base,
    postId: "first",
    title: "The Piazza offers a retreat #city",
  };
  const sameCleanedTitle = {
    ...base,
    postId: "same-cleaned",
    title: "  the piazza offers\n a retreat   #night ",
  };
  const differentPage = {
    ...base,
    postId: "different-page",
    pageId: "another-page",
    pageName: "Another page",
    title: "The Piazza offers a retreat",
  };
  const differentPunctuation = {
    ...base,
    postId: "different-punctuation",
    title: "The Piazza offers a retreat!",
  };
  const hashtagOnlyOne = {
    ...base,
    postId: "hashtags-one",
    title: "#one",
  };
  const hashtagOnlyTwo = {
    ...base,
    postId: "hashtags-two",
    title: "#two",
  };

  assert.equal(
    getDuplicateTitleKey(first),
    getDuplicateTitleKey(sameCleanedTitle),
  );
  assert.notEqual(
    getDuplicateTitleKey(first),
    getDuplicateTitleKey(differentPage),
  );
  assert.notEqual(
    getDuplicateTitleKey(first),
    getDuplicateTitleKey(differentPunctuation),
  );
  assert.notEqual(
    getDuplicateTitleKey(hashtagOnlyOne),
    getDuplicateTitleKey(hashtagOnlyTwo),
  );
});

test("keeps one post from duplicate groups of two, three, and four", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const groupSizes = [2, 3, 4];
  const duplicateGroups = groupSizes.flatMap((size, groupIndex) =>
    Array.from({ length: size }, (_, postIndex) => ({
      ...base,
      postId: `group-${groupIndex}-${postIndex}`,
      title: `Repeated title ${groupIndex}`,
      views: 100 - postIndex,
      publishedAt: base.publishedAt - postIndex,
    })),
  );
  const posts = [
    ...duplicateGroups,
    { ...base, postId: "unique", title: "Unique title" },
  ];

  const included = applyDuplicateTitleMode(
    posts,
    "include",
    getResultSortRule("performance-desc"),
    ["views"],
  );
  assert.equal(included.posts.length, 10);
  assert.equal(included.hiddenCount, 0);

  const excluded = applyDuplicateTitleMode(
    posts,
    "exclude",
    getResultSortRule("performance-desc"),
    ["views"],
  );
  assert.equal(excluded.posts.length, 4);
  assert.equal(excluded.hiddenCount, 6);
  assert.deepEqual(
    excluded.posts
      .filter((post) => post.postId.startsWith("group-"))
      .map((post) => post.postId)
      .sort(),
    ["group-0-0", "group-1-0", "group-2-0"],
  );
});

test("retains the duplicate representative selected by current result order", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const day = 24 * 60 * 60 * 1000;
  const posts = [
    {
      ...base,
      postId: "strong-old",
      title: "Repeated campaign",
      views: 100,
      publishedAt: base.publishedAt - 2 * day,
    },
    {
      ...base,
      postId: "weak-new",
      title: "repeated campaign #latest",
      views: 10,
      publishedAt: base.publishedAt,
    },
    {
      ...base,
      postId: "middle",
      title: "Repeated  campaign",
      views: 50,
      publishedAt: base.publishedAt - day,
    },
  ];

  const retainedId = (order) =>
    applyDuplicateTitleMode(
      posts,
      "exclude",
      getResultSortRule(order),
      ["views"],
    ).posts[0].postId;

  assert.equal(retainedId("performance-desc"), "strong-old");
  assert.equal(retainedId("performance-asc"), "weak-new");
  assert.equal(retainedId("date-desc"), "weak-new");
  assert.equal(retainedId("date-asc"), "strong-old");
});

test("deduplicates filtered results before chart totals and grouping", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const posts = [
    {
      ...base,
      postId: "visible-best",
      title: "Same title",
      views: 100,
      postType: "Photos",
    },
    {
      ...base,
      postId: "visible-duplicate",
      title: "same title #tag",
      views: 60,
      postType: "Photos",
    },
    {
      ...base,
      postId: "filtered-out",
      title: "Same title",
      views: 500,
      postType: "Videos",
    },
    {
      ...base,
      postId: "unique",
      title: "Unique title",
      views: 25,
      postType: "Photos",
    },
  ];
  const filtered = filterPosts(posts, {
    search: "",
    datePreset: "30d",
    customStart: "",
    customEnd: "",
    pageName: "",
    postType: "Photos",
    ranges: {},
  });
  const result = applyDuplicateTitleMode(
    filtered,
    "exclude",
    getResultSortRule("performance-desc"),
    ["views"],
  );
  const points = buildChartData(
    result.posts,
    "day",
    getResultSortRule("performance-desc"),
    ["views"],
  );

  assert.equal(result.hiddenCount, 1);
  assert.deepEqual(
    result.posts.map((post) => post.postId).sort(),
    ["unique", "visible-best"],
  );
  assert.equal(points.length, 1);
  assert.equal(points[0].postCount, 2);
  assert.equal(points[0].views, 125);
});

test("uses a latest-data anchored 30-day default date range", () => {
  assert.equal(DEFAULT_DATE_PRESET, "30d");
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const day = 24 * 60 * 60 * 1000;
  const posts = [
    { ...base, postId: "latest", publishedAt: base.publishedAt },
    {
      ...base,
      postId: "within-thirty",
      publishedAt: base.publishedAt - 20 * day,
    },
    {
      ...base,
      postId: "outside-thirty",
      publishedAt: base.publishedAt - 31 * day,
    },
  ];

  const filtered = filterPosts(posts, {
    search: "",
    datePreset: DEFAULT_DATE_PRESET,
    customStart: "",
    customEnd: "",
    pageName: "",
    postType: "",
    ranges: {},
  });
  assert.deepEqual(
    filtered.map((post) => post.postId),
    ["latest", "within-thirty"],
  );
});

test("supports three-month bounds and rejects reversed custom dates", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const posts = [
    { ...base, postId: "latest", publishedAt: new Date(2026, 6, 31).getTime() },
  ];
  const bounds = getDateBounds(posts, "3m", "", "");
  assert.ok(bounds);
  assert.equal(new Date(bounds.start).getMonth(), 3);
  assert.equal(new Date(bounds.start).getDate(), 30);
  assert.equal(isCustomDateRangeValid("2026-07-01", "2026-07-31"), true);
  assert.equal(isCustomDateRangeValid("2026-08-01", "2026-07-31"), false);

  const filtered = filterPosts(posts, {
    search: "",
    datePreset: "custom",
    customStart: "2026-08-01",
    customEnd: "2026-07-31",
    pageName: "",
    postType: "",
    ranges: {},
  });
  assert.deepEqual(filtered, []);
});

test("builds one clickable normalized chart point per post by default", () => {
  const posts = parseFacebookCsv(SAMPLE_CSV).posts;
  const points = buildChartData(posts, "post", [
    { id: "engagement", desc: true },
  ]);

  assert.equal(points.length, 3);
  assert.deepEqual(
    points.map((point) => point.engagement),
    [11, 7, 5],
  );
  assert.ok(points.every((point) => point.posts.length === 1));
  assert.ok(points.every((point) => point.permalink.startsWith("https://")));
  assert.equal(points[0].normalized.views, 100);
  assert.equal(points[2].normalized.comments, 0);
});

test("applies balanced ranking to posts and aggregated chart periods", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const day = 24 * 60 * 60 * 1000;
  const posts = [
    {
      ...base,
      postId: "balanced-period",
      publishedAt: base.publishedAt,
      views: 100,
      engagement: 100,
    },
    {
      ...base,
      postId: "views-period",
      publishedAt: base.publishedAt - day,
      views: 180,
      engagement: 15,
    },
    {
      ...base,
      postId: "engagement-period",
      publishedAt: base.publishedAt - 2 * day,
      views: 15,
      engagement: 180,
    },
  ];
  const points = buildChartData(
    posts,
    "day",
    [{ id: "overallPerformance", desc: true }],
    ["views", "engagement"],
  );
  assert.equal(points[0].posts[0].postId, "balanced-period");
});

test("gives chart transitions stable signatures and adaptive axis labels", () => {
  const posts = parseFacebookCsv(SAMPLE_CSV).posts;
  const newest = buildChartData(posts, "post", [
    { id: "publishedAt", desc: true },
  ]);
  const oldest = buildChartData(posts, "post", [
    { id: "publishedAt", desc: false },
  ]);

  assert.notEqual(
    getChartDataSignature(newest),
    getChartDataSignature(oldest),
  );
  assert.deepEqual(
    [...newest].reverse().map((datum) => datum.key),
    oldest.map((datum) => datum.key),
  );
  assert.deepEqual(selectAxisLabelIndexes(0, 624), []);
  assert.deepEqual(selectAxisLabelIndexes(1, 0), [0]);
  assert.deepEqual(selectAxisLabelIndexes(3, 234), [0, 1, 2]);
  assert.deepEqual(
    selectAxisLabelIndexes(20, 390),
    [0, 5, 10, 14, 19],
  );
  assert.deepEqual(selectAxisLabelIndexes(20, 120), [0, 19]);
  assert.equal(selectAxisLabelIndexes(20, 1600).length, 20);
});

test("numbers filtered table rows continuously across pages", () => {
  assert.equal(getDisplayedRowNumber(0, 25, 0), 1);
  assert.equal(getDisplayedRowNumber(0, 25, 24), 25);
  assert.equal(getDisplayedRowNumber(1, 25, 0), 26);
  assert.equal(getDisplayedRowNumber(2, 50, 7), 108);
});

test("resolves current Recharts click indexes to the correct chart datum", () => {
  const points = buildChartData(
    parseFacebookCsv(SAMPLE_CSV).posts,
    "post",
    [{ id: "views", desc: true }],
  );

  assert.equal(resolveChartDatum({ activeTooltipIndex: 0 }, points), points[0]);
  assert.equal(resolveChartDatum({ activeTooltipIndex: "1" }, points), points[1]);
  assert.equal(resolveChartDatum({ activeIndex: 2 }, points), points[2]);
  assert.equal(resolveChartDatum({ activeTooltipIndex: 99 }, points), null);
  assert.equal(resolveChartDatum({ activeTooltipIndex: undefined }, points), null);
});

test("aggregates grouped points and derives rate from grouped totals", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const posts = [
    { ...base, postId: "a", views: 100, reach: 100, engagement: 10 },
    {
      ...base,
      postId: "b",
      title: "Second post",
      permalink: "https://facebook.com/b",
      views: 25,
      reach: 50,
      engagement: 5,
      reactions: 3,
      comments: 1,
      shares: 1,
    },
  ];
  const points = buildChartData(posts, "day", [
    { id: "views", desc: true },
  ]);

  assert.equal(points.length, 1);
  assert.equal(points[0].postCount, 2);
  assert.equal(points[0].views, 125);
  assert.equal(points[0].reach, 150);
  assert.equal(points[0].engagement, 15);
  assert.equal(points[0].engagementRate, 10);
  assert.equal(points[0].normalized.views, 100);
});

test("keeps every post in large ungrouped chart datasets", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const posts = Array.from({ length: 500 }, (_, index) => ({
    ...base,
    postId: String(index + 1),
    publishedAt: base.publishedAt + index * 60_000,
    views: index,
  }));

  assert.equal(buildChartData(posts, "post", []).length, 500);
});

test("validates V4 preferences with independent ranking and visibility", () => {
  const preferences = parseDashboardPreferences(
    JSON.stringify({
      version: 4,
      view: "lines",
      visibleMetrics: ["totalClicks"],
      rankingMetrics: ["reach", "comments"],
      resultOrder: "date-asc",
      chartGrouping: "month",
      pageSize: 50,
    }),
  );

  assert.equal(preferences.view, "lines");
  assert.deepEqual(preferences.visibleMetrics, ["totalClicks"]);
  assert.deepEqual(preferences.rankingMetrics, ["reach", "comments"]);
  assert.equal(preferences.resultOrder, "date-asc");
  assert.equal(preferences.chartGrouping, "month");
  assert.equal(preferences.pageSize, 50);
  assert.equal(preferences.showMetricQuickControls, true);
  assert.equal(preferences.tableInternalScroll, false);
});

test("uses Views and best performance as the fresh default", () => {
  assert.deepEqual(DEFAULT_DASHBOARD_PREFERENCES.visibleMetrics, ["views"]);
  assert.deepEqual(DEFAULT_DASHBOARD_PREFERENCES.rankingMetrics, ["views"]);
  assert.equal(
    DEFAULT_DASHBOARD_PREFERENCES.resultOrder,
    "performance-desc",
  );
  assert.equal(
    DEFAULT_DASHBOARD_PREFERENCES.showMetricQuickControls,
    true,
  );
  assert.equal(DEFAULT_DASHBOARD_PREFERENCES.tableInternalScroll, false);

  const saved = parseDashboardPreferences(
    JSON.stringify({
      version: 2,
      view: "bars",
      visibleMetrics: ["reach", "comments"],
      analyzeMetric: "reach",
      sorting: [{ id: "reach", desc: false }],
      chartGrouping: "week",
      pageSize: 100,
      showMetricQuickControls: false,
      tableInternalScroll: true,
    }),
  );
  assert.deepEqual(saved.visibleMetrics, ["reach", "comments"]);
  assert.equal(saved.version, 4);
  assert.deepEqual(saved.rankingMetrics, ["reach"]);
  assert.equal(saved.resultOrder, "performance-asc");
  assert.equal(saved.showMetricQuickControls, false);
  assert.equal(saved.tableInternalScroll, true);
});

test("migrates V3 sort choices without coupling them to visible columns", () => {
  const metricSort = parseDashboardPreferences(
    JSON.stringify({
      version: 3,
      visibleMetrics: ["views"],
      sortBy: "comments",
      sortOrder: "asc",
    }),
  );
  assert.deepEqual(metricSort.visibleMetrics, ["views"]);
  assert.deepEqual(metricSort.rankingMetrics, ["comments"]);
  assert.equal(metricSort.resultOrder, "performance-asc");

  const balancedSort = parseDashboardPreferences(
    JSON.stringify({
      version: 3,
      visibleMetrics: ["views", "reach", "totalClicks"],
      sortBy: "overallPerformance",
      sortOrder: "desc",
    }),
  );
  assert.deepEqual(balancedSort.rankingMetrics, ["views", "reach"]);
  assert.equal(balancedSort.resultOrder, "performance-desc");

  const dateSort = parseDashboardPreferences(
    JSON.stringify({
      version: 3,
      visibleMetrics: ["totalClicks"],
      sortBy: "publishedAt",
      sortOrder: "asc",
    }),
  );
  assert.deepEqual(dateSort.visibleMetrics, ["totalClicks"]);
  assert.deepEqual(dateSort.rankingMetrics, ["views"]);
  assert.equal(dateSort.resultOrder, "date-asc");

  const unsupportedSort = parseDashboardPreferences(
    JSON.stringify({
      version: 3,
      visibleMetrics: ["shares"],
      sortBy: "engagementRate",
      sortOrder: "desc",
    }),
  );
  assert.deepEqual(unsupportedSort.rankingMetrics, ["views"]);
  assert.equal(unsupportedSort.resultOrder, "performance-desc");
});

test("maps the four result orders to balanced performance or post date", () => {
  assert.deepEqual(getResultSortRule("performance-desc"), [
    { id: "overallPerformance", desc: true },
  ]);
  assert.deepEqual(getResultSortRule("performance-asc"), [
    { id: "overallPerformance", desc: false },
  ]);
  assert.deepEqual(getResultSortRule("date-desc"), [
    { id: "publishedAt", desc: true },
  ]);
  assert.deepEqual(getResultSortRule("date-asc"), [
    { id: "publishedAt", desc: false },
  ]);
});

test("shows exact bar labels only for one or two visible metrics", () => {
  assert.equal(shouldShowBarValueLabels(0), false);
  assert.equal(shouldShowBarValueLabels(1), true);
  assert.equal(shouldShowBarValueLabels(2), true);
  assert.equal(shouldShowBarValueLabels(3), false);
  assert.equal(shouldShowBarValueLabels(10), false);

  assert.equal(formatBarValueLabel("views", 1234), "1,234");
  assert.equal(formatBarValueLabel("comments", 0), "0");
  assert.equal(formatBarValueLabel("engagementRate", 12.345), "12.3%");
  assert.equal(formatBarValueLabel("engagementRate", null), "N/A");
});

test("waits for settled bar geometry before rendering every label", () => {
  const state = (overrides = {}) => ({
    requestedMetrics: ["views"],
    renderedMetrics: ["views"],
    enteringMetrics: [],
    exitingMetrics: [],
    phase: "idle",
    revision: 1,
    ...overrides,
  });

  assert.equal(
    shouldRenderSettledBarValueLabels(
      state({ phase: "series-change", enteringMetrics: ["views"] }),
    ),
    false,
  );
  assert.equal(
    shouldRenderSettledBarValueLabels(state()),
    true,
  );
  assert.equal(
    shouldRenderSettledBarValueLabels(
      state({
        requestedMetrics: ["views", "reach"],
        renderedMetrics: ["views", "reach"],
        phase: "data-change",
      }),
    ),
    false,
  );
  assert.equal(
    shouldRenderSettledBarValueLabels(
      state({
        requestedMetrics: ["views", "reach"],
        renderedMetrics: ["views", "reach"],
      }),
    ),
    true,
  );
  assert.equal(
    shouldRenderSettledBarValueLabels(
      state({
        requestedMetrics: ["views", "reach"],
        renderedMetrics: ["views", "reach", "comments"],
        exitingMetrics: ["comments"],
      }),
    ),
    false,
  );
  assert.equal(
    shouldRenderSettledBarValueLabels(
      state({
        requestedMetrics: ["views", "reach"],
        renderedMetrics: ["views"],
      }),
    ),
    false,
  );
  assert.equal(
    shouldRenderSettledBarValueLabels(
      state({
        requestedMetrics: ["views", "reach", "engagement"],
        renderedMetrics: ["views", "reach", "engagement"],
      }),
    ),
    false,
  );
});

test("reconciles rapid metric replacements against the series still rendered", () => {
  let transition = {
    requestedMetrics: ["views"],
    renderedMetrics: ["views"],
    enteringMetrics: [],
    exitingMetrics: [],
    phase: "idle",
    revision: 0,
  };

  transition = reconcileChartMetricTransition(
    transition,
    ["views", "reach"],
    "series-change",
    1,
  );
  assert.deepEqual(transition.enteringMetrics, ["reach"]);
  assert.deepEqual(transition.exitingMetrics, []);

  transition = settleChartMetricTransition(transition, 1);
  assert.equal(shouldRenderSettledBarValueLabels(transition), true);

  transition = reconcileChartMetricTransition(
    transition,
    ["engagement", "reactions"],
    "series-change",
    2,
  );
  assert.deepEqual(transition.renderedMetrics, [
    "views",
    "reach",
    "engagement",
    "reactions",
  ]);
  assert.deepEqual(transition.enteringMetrics, [
    "engagement",
    "reactions",
  ]);
  assert.deepEqual(transition.exitingMetrics, ["views", "reach"]);
  assert.equal(shouldRenderSettledBarValueLabels(transition), false);

  transition = completeChartMetricExit(transition, 2);
  assert.deepEqual(transition.renderedMetrics, [
    "engagement",
    "reactions",
  ]);
  transition = settleChartMetricTransition(transition, 2);
  assert.equal(shouldRenderSettledBarValueLabels(transition), true);
});

test("ignores stale completions during rapid add, remove, and re-enable sequences", () => {
  let transition = {
    requestedMetrics: ["views", "reach"],
    renderedMetrics: ["views", "reach"],
    enteringMetrics: [],
    exitingMetrics: [],
    phase: "idle",
    revision: 3,
  };

  transition = reconcileChartMetricTransition(
    transition,
    ["views", "reach", "engagement"],
    "series-change",
    4,
  );
  transition = reconcileChartMetricTransition(
    transition,
    ["reach", "engagement"],
    "series-change",
    5,
  );
  assert.deepEqual(transition.renderedMetrics, [
    "views",
    "reach",
    "engagement",
  ]);
  assert.deepEqual(transition.exitingMetrics, ["views"]);

  const staleExit = completeChartMetricExit(transition, 4);
  const staleSettle = settleChartMetricTransition(staleExit, 4);
  assert.deepEqual(staleSettle, transition);

  transition = reconcileChartMetricTransition(
    transition,
    ["views", "reach"],
    "series-change",
    6,
  );
  assert.deepEqual(transition.renderedMetrics, [
    "views",
    "reach",
    "engagement",
  ]);
  assert.deepEqual(transition.exitingMetrics, ["engagement"]);
  assert.equal(transition.enteringMetrics.includes("views"), false);

  transition = completeChartMetricExit(transition, 6);
  transition = settleChartMetricTransition(transition, 6);
  assert.deepEqual(transition.renderedMetrics, ["views", "reach"]);
  assert.equal(shouldRenderSettledBarValueLabels(transition), true);
});

test("falls back from corrupt preferences and migrates legacy visibility/view", () => {
  assert.deepEqual(
    parseDashboardPreferences("{broken"),
    DEFAULT_DASHBOARD_PREFERENCES,
  );

  const migrated = parseDashboardPreferences(
    null,
    JSON.stringify({ engagementRate: false, otherClicks: true }),
    "trends",
  );
  assert.equal(migrated.view, "bars");
  assert.ok(migrated.visibleMetrics.includes("otherClicks"));
  assert.ok(!migrated.visibleMetrics.includes("engagementRate"));
});

test("rejects CSV files that omit essential columns", () => {
  assert.throws(
    () => parseFacebookCsv("Post ID,Views\n1,10"),
    /Missing required columns/,
  );
});

test("removes only whitespace-delimited hashtag words from displayed titles", () => {
  assert.equal(
    stripHashtagWords("A launch #campaign #summer"),
    "A launch",
  );
  assert.equal(
    stripHashtagWords("First line\n#hidden #also-hidden\nSecond line"),
    "First line\nSecond line",
  );
  assert.equal(
    stripHashtagWords("Keep word#tag and (#wrapped) but remove #tag,"),
    "Keep word#tag and (#wrapped) but remove",
  );
  assert.equal(stripHashtagWords("#one\n#two #three"), "");
  assert.equal(getPostHeadline("#one\n#two #three"), "Untitled post");
});

test("search still matches hashtags in the original CSV title", () => {
  const posts = parseFacebookCsv(SAMPLE_CSV).posts;
  const tagged = [{ ...posts[0], title: "Visible words #campaign" }];
  const filtered = filterPosts(tagged, {
    search: "#campaign",
    datePreset: "custom",
    customStart: "",
    customEnd: "",
    pageName: "",
    postType: "",
    ranges: {},
  });
  assert.equal(filtered.length, 1);
});
