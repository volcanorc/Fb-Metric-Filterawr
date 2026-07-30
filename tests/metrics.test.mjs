import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATIC_PERFORMANCE_METRICS,
  DEFAULT_DASHBOARD_PREFERENCES,
  DEFAULT_DATE_PRESET,
  RANKING_METRICS,
  TABLE_COLUMN_DEFAULT_WIDTHS,
  TABLE_COLUMN_MIN_WIDTHS,
  TABLE_ROW_DEFAULT_HEIGHT,
  TABLE_ROW_MIN_HEIGHT,
  applyDuplicateTitleMode,
  buildChartData,
  calculateBalancedPerformanceDetails,
  calculateBalancedPerformanceScores,
  calculateTotals,
  clampTableRowHeight,
  completeChartMetricExit,
  filterPosts,
  fitTableColumnWidths,
  getCascadingTableDividerRange,
  formatBarValueLabel,
  getChartDataSignature,
  getDisplayedRowNumber,
  getDateBounds,
  getDuplicateTitleKey,
  getResultSortRule,
  isCustomDateRangeValid,
  parseDashboardPreferences,
  parseFacebookCsv,
  normalizeRankingMetrics,
  orderPosts,
  reconcileChartMetricTransition,
  resetAdjacentTableColumns,
  resizeCascadingTableColumns,
  resolveChartDatum,
  selectAxisLabelIndexes,
  settleChartMetricTransition,
  shouldRenderSettledBarValueLabels,
  shouldShowBarValueLabels,
  sortPosts,
  stripHashtagWords,
  tableMetricDefinitions,
  toggleRankingMetricSelection,
  updateRankingMetricAndVisibility,
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
  for (const post of result.posts) {
    assert.equal(
      post.engagement,
      post.reactions + post.comments + post.shares,
    );
  }
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

test("uses Total Clicks as an independent balanced ranking metric", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const posts = [
    {
      ...base,
      postId: "balanced-clicks",
      views: 80,
      totalClicks: 8,
      engagement: 1,
    },
    {
      ...base,
      postId: "view-only",
      views: 100,
      totalClicks: 1,
      engagement: 100,
    },
  ];

  assert.equal(
    sortPosts(
      posts,
      getResultSortRule("performance-desc"),
      ["views", "totalClicks"],
    )[0].postId,
    "balanced-clicks",
  );
  assert.equal(posts[0].engagement, 1);
  assert.equal(posts[0].totalClicks, 8);
  assert.ok(RANKING_METRICS.includes("totalClicks"));
  assert.equal(
    tableMetricDefinitions.find(({ key }) => key === "totalClicks")
      ?.quickControl,
    true,
  );
  assert.equal(
    tableMetricDefinitions.find(({ key }) => key === "otherClicks")
      ?.rankingEligible,
    undefined,
  );
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
  const blankOne = {
    ...base,
    postId: "blank-one",
    title: "",
  };
  const blankTwo = {
    ...base,
    postId: "blank-two",
    title: "",
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
  assert.notEqual(
    getDuplicateTitleKey(blankOne),
    getDuplicateTitleKey(blankTwo),
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
    ["views"],
  );
  assert.equal(included.posts.length, 10);
  assert.equal(included.hiddenCount, 0);

  const excluded = applyDuplicateTitleMode(
    posts,
    "exclude",
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

test("always retains the best-performing duplicate representative", () => {
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

  const deduplicated = applyDuplicateTitleMode(
    posts,
    "exclude",
    ["views"],
  ).posts;
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].postId, "strong-old");

  for (const order of [
    "performance-desc",
    "performance-asc",
    "date-desc",
    "date-asc",
  ]) {
    assert.equal(
      sortPosts(deduplicated, getResultSortRule(order), ["views"])[0].postId,
      "strong-old",
    );
  }
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

test("migrates V5 preferences with clicks ranking and independent visibility", () => {
  const preferences = parseDashboardPreferences(
    JSON.stringify({
      version: 5,
      view: "lines",
      visibleMetrics: ["totalClicks"],
      rankingMetrics: ["reach", "comments", "totalClicks"],
      resultOrder: "date-asc",
      chartGrouping: "month",
      pageSize: 50,
    }),
  );

  assert.equal(preferences.version, 8);
  assert.equal(preferences.view, "lines");
  assert.deepEqual(preferences.visibleMetrics, ["totalClicks"]);
  assert.deepEqual(preferences.rankingMetrics, [
    "reach",
    "comments",
    "totalClicks",
  ]);
  assert.equal(preferences.performanceOrder, "none");
  assert.equal(preferences.dateOrder, "oldest");
  assert.equal(preferences.chartGrouping, "month");
  assert.equal(preferences.pageSize, 50);
  assert.equal(preferences.showMetricQuickControls, true);
  assert.equal(preferences.tableInternalScroll, false);
  assert.equal(preferences.tableRowResizeEnabled, false);
  assert.equal(preferences.tableRowHeight, TABLE_ROW_DEFAULT_HEIGHT);
  assert.deepEqual(
    preferences.columnWidths,
    TABLE_COLUMN_DEFAULT_WIDTHS,
  );
});

test("migrates V4 ranking preferences and removes aggregate overlap", () => {
  const migrated = parseDashboardPreferences(
    JSON.stringify({
      version: 4,
      view: "bars",
      visibleMetrics: ["views", "engagement", "comments"],
      rankingMetrics: ["views", "engagement", "comments"],
      resultOrder: "performance-desc",
      chartGrouping: "post",
      pageSize: 25,
      showMetricQuickControls: true,
      tableInternalScroll: false,
    }),
  );

  assert.equal(migrated.version, 8);
  assert.deepEqual(migrated.visibleMetrics, [
    "views",
    "engagement",
    "comments",
  ]);
  assert.deepEqual(migrated.rankingMetrics, ["views", "comments"]);
});

test("migrates V6 column widths and defaults the new row sizing controls", () => {
  const preferences = parseDashboardPreferences(
    JSON.stringify({
      version: 6,
      view: "table",
      visibleMetrics: ["views", "reach"],
      rankingMetrics: ["views"],
      resultOrder: "performance-desc",
      chartGrouping: "post",
      pageSize: 25,
      showMetricQuickControls: true,
      tableInternalScroll: false,
      columnWidths: {
        post: 420,
        publishedAt: 20,
        views: 260,
        reach: Number.NaN,
        madeUpColumn: 999,
      },
    }),
  );

  assert.equal(preferences.version, 8);
  assert.equal(preferences.columnWidths.post, 420);
  assert.equal(
    preferences.columnWidths.publishedAt,
    TABLE_COLUMN_MIN_WIDTHS.publishedAt,
  );
  assert.equal(preferences.columnWidths.views, 260);
  assert.equal(
    preferences.columnWidths.reach,
    TABLE_COLUMN_DEFAULT_WIDTHS.reach,
  );
  assert.equal("madeUpColumn" in preferences.columnWidths, false);
  assert.equal(preferences.tableRowResizeEnabled, false);
  assert.equal(preferences.tableRowHeight, TABLE_ROW_DEFAULT_HEIGHT);
});

test("validates V7 row sizing preferences and clamps saved heights", () => {
  const compact = parseDashboardPreferences(
    JSON.stringify({
      version: 7,
      view: "table",
      visibleMetrics: ["views"],
      rankingMetrics: ["views"],
      resultOrder: "performance-desc",
      chartGrouping: "post",
      pageSize: 25,
      showMetricQuickControls: true,
      tableInternalScroll: false,
      columnWidths: TABLE_COLUMN_DEFAULT_WIDTHS,
      tableRowResizeEnabled: true,
      tableRowHeight: 10,
    }),
  );
  const oversized = parseDashboardPreferences(
    JSON.stringify({
      ...compact,
      version: 7,
      tableRowHeight: 500,
    }),
  );

  assert.equal(compact.tableRowResizeEnabled, true);
  assert.equal(compact.tableRowHeight, TABLE_ROW_MIN_HEIGHT);
  assert.equal(oversized.tableRowHeight, TABLE_ROW_DEFAULT_HEIGHT);
  assert.equal(clampTableRowHeight(Number.NaN), TABLE_ROW_DEFAULT_HEIGHT);
});

test("fits visible table columns to the panel while preserving hidden widths", () => {
  const fitted = fitTableColumnWidths(
    {
      ...TABLE_COLUMN_DEFAULT_WIDTHS,
      comments: 333,
    },
    ["post", "publishedAt", "views"],
    1100,
  );

  assert.ok(
    Math.abs(fitted.post + fitted.publishedAt + fitted.views - 1100) < 0.1,
  );
  assert.ok(fitted.post >= TABLE_COLUMN_MIN_WIDTHS.post);
  assert.ok(fitted.publishedAt >= TABLE_COLUMN_MIN_WIDTHS.publishedAt);
  assert.ok(fitted.views >= TABLE_COLUMN_MIN_WIDTHS.views);
  assert.equal(fitted.comments, 333);
});

test("cascades leftward donors from Date into Post when Views grows", () => {
  const widths = {
    ...TABLE_COLUMN_DEFAULT_WIDTHS,
    post: 400,
    publishedAt: 200,
    views: 300,
  };
  const visible = ["post", "publishedAt", "views"];
  const resized = resizeCascadingTableColumns(
    widths,
    visible,
    "publishedAt",
    "views",
    0,
  );

  assert.equal(resized.publishedAt, TABLE_COLUMN_MIN_WIDTHS.publishedAt);
  assert.equal(resized.post, 288);
  assert.equal(resized.views, 500);
  assert.equal(
    visible.reduce((sum, id) => sum + resized[id], 0),
    visible.reduce((sum, id) => sum + widths[id], 0),
  );
});

test("cascades through Reach, Views, Date, then Post for Engagement", () => {
  const widths = {
    ...TABLE_COLUMN_DEFAULT_WIDTHS,
    post: 400,
    publishedAt: 200,
    views: 300,
    reach: 200,
    engagement: 200,
  };
  const visible = [
    "post",
    "publishedAt",
    "views",
    "reach",
    "engagement",
  ];
  const resized = resizeCascadingTableColumns(
    widths,
    visible,
    "reach",
    "engagement",
    -300,
  );

  assert.equal(resized.reach, TABLE_COLUMN_MIN_WIDTHS.reach);
  assert.equal(resized.views, TABLE_COLUMN_MIN_WIDTHS.views);
  assert.equal(resized.publishedAt, TABLE_COLUMN_MIN_WIDTHS.publishedAt);
  assert.equal(resized.post, 264);
  assert.equal(resized.engagement, 700);
  assert.equal(
    visible.reduce((sum, id) => sum + resized[id], 0),
    visible.reduce((sum, id) => sum + widths[id], 0),
  );
});

test("cascades rightward donors nearest-first and stops at all minimums", () => {
  const widths = {
    ...TABLE_COLUMN_DEFAULT_WIDTHS,
    publishedAt: 200,
    views: 300,
    reach: 200,
    engagement: 200,
  };
  const visible = ["post", "publishedAt", "views", "reach", "engagement"];
  const resized = resizeCascadingTableColumns(
    widths,
    visible,
    "publishedAt",
    "views",
    2000,
  );

  assert.equal(resized.post, widths.post);
  assert.equal(resized.views, TABLE_COLUMN_MIN_WIDTHS.views);
  assert.equal(resized.reach, TABLE_COLUMN_MIN_WIDTHS.reach);
  assert.equal(resized.engagement, TABLE_COLUMN_MIN_WIDTHS.engagement);
  assert.equal(resized.publishedAt, 564);
  assert.equal(
    visible.reduce((sum, id) => sum + resized[id], 0),
    visible.reduce((sum, id) => sum + widths[id], 0),
  );
});

test("cascading resize skips hidden columns and preserves their saved widths", () => {
  const widths = {
    ...TABLE_COLUMN_DEFAULT_WIDTHS,
    publishedAt: 200,
    views: 300,
    reach: 220,
    comments: 333,
  };
  const resized = resizeCascadingTableColumns(
    widths,
    ["post", "publishedAt", "views", "reach"],
    "publishedAt",
    "views",
    160,
  );

  assert.equal(resized.comments, 333);
  assert.equal(resized.publishedAt, 160);
  assert.equal(resized.views, 340);
  assert.equal(resized.post, widths.post);
  assert.equal(resized.reach, widths.reach);
});

test("resets an adjacent divider to its default proportions", () => {
  const reset = resetAdjacentTableColumns(
    {
      ...TABLE_COLUMN_DEFAULT_WIDTHS,
      publishedAt: 160,
      views: 240,
    },
    "publishedAt",
    "views",
  );
  const expectedLeft =
    400 *
    (TABLE_COLUMN_DEFAULT_WIDTHS.publishedAt /
      (TABLE_COLUMN_DEFAULT_WIDTHS.publishedAt +
        TABLE_COLUMN_DEFAULT_WIDTHS.views));

  assert.ok(Math.abs(reset.publishedAt - expectedLeft) < 0.02);
  assert.ok(Math.abs(reset.publishedAt + reset.views - 400) < 0.02);
});

test("reports the full cascading divider range across visible columns", () => {
  const widths = {
    ...TABLE_COLUMN_DEFAULT_WIDTHS,
    post: 400,
    publishedAt: 160,
    views: 240,
    reach: 180,
  };
  const range = getCascadingTableDividerRange(
    widths,
    ["post", "publishedAt", "views", "reach"],
    "publishedAt",
    "views",
  );

  assert.deepEqual(range, {
    min: TABLE_COLUMN_MIN_WIDTHS.post + TABLE_COLUMN_MIN_WIDTHS.publishedAt,
    max: 400 + 160 + 240 + 180 -
      TABLE_COLUMN_MIN_WIDTHS.views -
      TABLE_COLUMN_MIN_WIDTHS.reach,
    now: 560,
  });
});

test("prevents engagement-component double counting in every toggle direction", () => {
  assert.deepEqual(
    normalizeRankingMetrics(["views", "engagement", "comments"]),
    ["views", "comments"],
  );

  const engagementSelected = toggleRankingMetricSelection(
    ["views", "comments", "shares"],
    "engagement",
    true,
  );
  assert.deepEqual(engagementSelected.metrics, ["views", "engagement"]);
  assert.deepEqual(engagementSelected.removedMetrics, [
    "comments",
    "shares",
  ]);

  const commentSelected = toggleRankingMetricSelection(
    ["views", "engagement"],
    "comments",
    true,
  );
  assert.deepEqual(commentSelected.metrics, ["views", "comments"]);
  assert.deepEqual(commentSelected.removedMetrics, ["engagement"]);

  const clicksSelected = toggleRankingMetricSelection(
    ["views", "comments"],
    "totalClicks",
    true,
  );
  assert.deepEqual(clicksSelected.metrics, [
    "views",
    "comments",
    "totalClicks",
  ]);
  assert.deepEqual(clicksSelected.removedMetrics, []);

  const emptySelection = toggleRankingMetricSelection(
    ["totalClicks"],
    "totalClicks",
    false,
  );
  assert.deepEqual(emptySelection.metrics, []);
  assert.equal(emptySelection.changed, true);
});

test("automatically shows newly selected ranking metrics without hiding them later", () => {
  const added = updateRankingMetricAndVisibility(
    ["views"],
    ["views"],
    "totalClicks",
    true,
  );
  assert.deepEqual(added.metrics, ["views", "totalClicks"]);
  assert.deepEqual(added.visibleMetrics, ["views", "totalClicks"]);

  const removed = updateRankingMetricAndVisibility(
    added.metrics,
    added.visibleMetrics,
    "totalClicks",
    false,
  );
  assert.deepEqual(removed.metrics, ["views"]);
  assert.deepEqual(removed.visibleMetrics, ["views", "totalClicks"]);

  const overlap = updateRankingMetricAndVisibility(
    ["views", "engagement"],
    ["views", "engagement"],
    "comments",
    true,
  );
  assert.deepEqual(overlap.metrics, ["views", "comments"]);
  assert.deepEqual(overlap.visibleMetrics, [
    "views",
    "engagement",
    "comments",
  ]);
});

test("uses normalized mean as a deterministic fallback for zero primary scores", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const posts = [
    {
      ...base,
      postId: "strong-zero-comment",
      publishedAt: base.publishedAt - 1000,
      views: 100,
      comments: 0,
    },
    {
      ...base,
      postId: "weak-zero-comment",
      publishedAt: base.publishedAt,
      views: 10,
      comments: 0,
    },
    {
      ...base,
      postId: "commented",
      publishedAt: base.publishedAt - 2000,
      views: 20,
      comments: 1,
    },
  ];

  const details = calculateBalancedPerformanceDetails(posts, [
    "views",
    "comments",
  ]);
  assert.equal(details[0].primary, 0);
  assert.equal(details[1].primary, 0);
  assert.ok(details[0].tieBreaker > details[1].tieBreaker);

  const sorted = sortPosts(
    posts,
    getResultSortRule("performance-desc"),
    ["views", "comments"],
  );
  assert.deepEqual(
    sorted.map((post) => post.postId),
    ["commented", "strong-zero-comment", "weak-zero-comment"],
  );
});

test("uses CSV order with no priority or ordering as the fresh default", () => {
  assert.deepEqual(DEFAULT_DASHBOARD_PREFERENCES.visibleMetrics, ["views"]);
  assert.deepEqual(DEFAULT_DASHBOARD_PREFERENCES.rankingMetrics, []);
  assert.equal(DEFAULT_DASHBOARD_PREFERENCES.performanceOrder, "none");
  assert.equal(DEFAULT_DASHBOARD_PREFERENCES.dateOrder, "none");
  assert.equal(
    DEFAULT_DASHBOARD_PREFERENCES.showMetricQuickControls,
    true,
  );
  assert.equal(DEFAULT_DASHBOARD_PREFERENCES.tableInternalScroll, false);
  assert.equal(DEFAULT_DASHBOARD_PREFERENCES.tableRowResizeEnabled, false);
  assert.equal(
    DEFAULT_DASHBOARD_PREFERENCES.tableRowHeight,
    TABLE_ROW_DEFAULT_HEIGHT,
  );

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
  assert.equal(saved.version, 8);
  assert.deepEqual(saved.rankingMetrics, ["reach"]);
  assert.equal(saved.performanceOrder, "lowest");
  assert.equal(saved.dateOrder, "none");
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
  assert.equal(metricSort.performanceOrder, "lowest");
  assert.equal(metricSort.dateOrder, "none");

  const balancedSort = parseDashboardPreferences(
    JSON.stringify({
      version: 3,
      visibleMetrics: ["views", "reach", "totalClicks"],
      sortBy: "overallPerformance",
      sortOrder: "desc",
    }),
  );
  assert.deepEqual(balancedSort.rankingMetrics, ["views", "reach"]);
  assert.equal(balancedSort.performanceOrder, "best");
  assert.equal(balancedSort.dateOrder, "none");

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
  assert.equal(dateSort.performanceOrder, "none");
  assert.equal(dateSort.dateOrder, "oldest");

  const unsupportedSort = parseDashboardPreferences(
    JSON.stringify({
      version: 3,
      visibleMetrics: ["shares"],
      sortBy: "engagementRate",
      sortOrder: "desc",
    }),
  );
  assert.deepEqual(unsupportedSort.rankingMetrics, ["views"]);
  assert.equal(unsupportedSort.performanceOrder, "best");
  assert.equal(unsupportedSort.dateOrder, "none");
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

test("applies independent performance and date ordering with month blocks", () => {
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const makePost = (postId, date, value) => ({
    ...base,
    postId,
    publishedAt: new Date(`${date}T12:00:00`).getTime(),
    views: value,
    reach: value,
    reactions: value,
    comments: 0,
    shares: 0,
    engagement: value,
  });
  const posts = [
    makePost("june-mid", "2026-06-30", 50),
    makePost("july-weak", "2026-07-20", 10),
    makePost("june-best", "2026-06-01", 200),
    makePost("july-strong", "2026-07-10", 100),
  ];

  assert.deepEqual(
    orderPosts(
      posts,
      { performanceOrder: "none", dateOrder: "none" },
      [],
    ).map((post) => post.postId),
    ["june-mid", "july-weak", "june-best", "july-strong"],
  );
  assert.deepEqual(
    orderPosts(
      posts,
      { performanceOrder: "best", dateOrder: "none" },
      ["views"],
    ).map((post) => post.postId),
    ["june-best", "july-strong", "june-mid", "july-weak"],
  );
  assert.deepEqual(
    orderPosts(
      posts,
      { performanceOrder: "none", dateOrder: "newest" },
      [],
    ).map((post) => post.postId),
    ["july-weak", "july-strong", "june-mid", "june-best"],
  );
  assert.deepEqual(
    orderPosts(
      posts,
      { performanceOrder: "best", dateOrder: "newest" },
      ["views"],
    ).map((post) => post.postId),
    ["july-strong", "july-weak", "june-best", "june-mid"],
  );
  assert.deepEqual(
    orderPosts(
      posts,
      { performanceOrder: "lowest", dateOrder: "oldest" },
      ["views"],
    ).map((post) => post.postId),
    ["june-mid", "june-best", "july-weak", "july-strong"],
  );
});

test("uses Views, Reach, and Engagement automatically when performance has no priorities", () => {
  assert.deepEqual(AUTOMATIC_PERFORMANCE_METRICS, [
    "views",
    "reach",
    "engagement",
  ]);
  const base = parseFacebookCsv(SAMPLE_CSV).posts[0];
  const posts = [
    {
      ...base,
      postId: "outlier",
      views: 100,
      reach: 10,
      engagement: 10,
    },
    {
      ...base,
      postId: "balanced",
      views: 80,
      reach: 80,
      engagement: 80,
    },
  ];
  assert.deepEqual(
    orderPosts(
      posts,
      { performanceOrder: "best", dateOrder: "none" },
      [],
    ).map((post) => post.postId),
    ["balanced", "outlier"],
  );
});

test("persists empty V8 priorities and migrates V7 ordering fields", () => {
  const v8 = parseDashboardPreferences(
    JSON.stringify({
      ...DEFAULT_DASHBOARD_PREFERENCES,
      rankingMetrics: [],
      performanceOrder: "lowest",
      dateOrder: "newest",
    }),
  );
  assert.equal(v8.version, 8);
  assert.deepEqual(v8.rankingMetrics, []);
  assert.equal(v8.performanceOrder, "lowest");
  assert.equal(v8.dateOrder, "newest");

  const v7 = parseDashboardPreferences(
    JSON.stringify({
      version: 7,
      view: "lines",
      visibleMetrics: ["views"],
      rankingMetrics: ["views"],
      resultOrder: "date-desc",
      chartGrouping: "week",
      pageSize: 50,
      showMetricQuickControls: false,
      tableInternalScroll: true,
      columnWidths: TABLE_COLUMN_DEFAULT_WIDTHS,
      tableRowResizeEnabled: true,
      tableRowHeight: 60,
    }),
  );
  assert.equal(v7.version, 8);
  assert.equal(v7.performanceOrder, "none");
  assert.equal(v7.dateOrder, "newest");
  assert.equal(v7.view, "lines");
  assert.equal(v7.tableRowHeight, 60);
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
