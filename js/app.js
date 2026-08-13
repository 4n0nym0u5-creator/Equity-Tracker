/* ==========================================================================
   NDQ.AX Pulse — dashboard logic (Apache ECharts)
   ========================================================================== */
var charts = [];

window.addEventListener("resize", function () {
  charts.forEach(function (c) { try { c.resize(); } catch (e) {} });
});

window.NDQInit = function () {
  "use strict";

  // --- hot-refresh: tear down previous chart instances & reset dynamic DOM ---
  charts.forEach(function (c) { try { c.dispose(); } catch (e) {} });
  charts.length = 0;
  ["kVsMa", "hndqVsMa", "tVsMa", "xSinceIpo"].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.classList.remove("pos", "neg");
  });
  var _banner = document.getElementById("signalBanner");
  if (_banner) _banner.className = "signal-banner";
  var _hbanner = document.getElementById("hndqBanner");
  if (_hbanner) _hbanner.className = "signal-banner";

  var D = window.DASHBOARD_DATA;
  if (!D) { document.body.innerHTML = "<p style='padding:40px;font-family:monospace'>data/dashboard.js missing — run fetch_data.py</p>"; return; }

  var COLORS = {
    ndq: "#4dc3ff",
    hndq: "#9d7bff",
    tsla: "#ff4d6d",
    spcx: "#e8ecf4",
    spcxPublic: "#00d09c",
    ma: "#ffb020",
    asIntl: "#ff8a3c",
    asAus: "#ffd63c",
    green: "#00d09c",
    red: "#ff5c6c",
    axis: "#5c6679",
    split: "rgba(255,255,255,0.06)",
  };

  var FONT = "'Inter', -apple-system, sans-serif";
  var MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

  var nf0 = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ------------------------------------------------------------------ *
   *  Shared chart scaffolding
   * ------------------------------------------------------------------ */

  function baseTooltip(valueFormatter) {
    return {
      trigger: "axis",
      backgroundColor: "rgba(10,14,24,0.94)",
      borderColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { color: "#e8ecf4", fontFamily: FONT, fontSize: 12.5 },
      axisPointer: {
        type: "cross",
        label: { backgroundColor: "#1c2438", fontFamily: MONO, fontSize: 11 },
        lineStyle: { color: "rgba(255,255,255,0.25)" },
        crossStyle: { color: "rgba(255,255,255,0.25)" },
      },
      valueFormatter: valueFormatter,
      confine: true,
    };
  }

  function baseXAxis(dates) {
    return {
      type: "category",
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: COLORS.split } },
      axisTick: { show: false },
      axisLabel: { color: COLORS.axis, fontFamily: MONO, fontSize: 11, hideOverlap: true },
    };
  }

  function baseYAxis(opts) {
    opts = opts || {};
    return Object.assign({
      type: opts.log ? "log" : "value",
      scale: true,
      min: opts.min,
      axisLabel: {
        color: COLORS.axis, fontFamily: MONO, fontSize: 11,
        formatter: opts.formatter || function (v) { return v; },
      },
      splitLine: { lineStyle: { color: COLORS.split } },
    }, opts.extra || {});
  }

  function baseDataZoom(extra) {
    var z = [
      { type: "inside", throttle: 40 },
      {
        type: "slider", height: 34, bottom: 8,
        borderColor: "rgba(255,255,255,0.1)",
        backgroundColor: "rgba(255,255,255,0.02)",
        fillerColor: "rgba(77,195,255,0.10)",
        handleStyle: { color: "#4dc3ff", borderColor: "#4dc3ff" },
        moveHandleStyle: { color: "#4dc3ff" },
        dataBackground: {
          lineStyle: { color: "rgba(255,255,255,0.2)" },
          areaStyle: { color: "rgba(255,255,255,0.05)" },
        },
        selectedDataBackground: {
          lineStyle: { color: "#4dc3ff" },
          areaStyle: { color: "rgba(77,195,255,0.12)" },
        },
        textStyle: { color: COLORS.axis, fontFamily: MONO, fontSize: 10 },
      },
    ];
    return extra ? z.map(function (o) { return Object.assign(o, extra); }) : z;
  }

  function makeChart(id, option) {
    var el = document.getElementById(id);
    if (!el) return null;
    var c = echarts.init(el, null, { renderer: "canvas" });
    c.setOption(option);
    charts.push(c);
    return c;
  }

  /* ------------------------------------------------------------------ *
   *  KPI count-up animation
   * ------------------------------------------------------------------ */

  function countUp(el, target, decimals, prefix, suffix) {
    prefix = prefix || ""; suffix = suffix || "";
    var start = null, dur = 1100;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var v = target * eased;
      el.textContent = prefix + (decimals ? nf2.format(v) : nf0.format(v)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------ *
   *  Reusable 200-week MA chart builder (NDQ, TSLA)
   * ------------------------------------------------------------------ */

  function buildMaChart(elId, weekly, zones, name, color) {
    var markAreas = zones.map(function (z) {
      return [
        { xAxis: z.start,
          itemStyle: { color: "rgba(255,92,108,0.10)", borderColor: "rgba(255,92,108,0.35)", borderWidth: 1, borderType: "dashed" },
          label: { show: z.weeks >= 4, position: "insideTop", color: COLORS.red, fontSize: 10.5, fontFamily: MONO, formatter: "BUY ZONE" } },
        { xAxis: z.end },
      ];
    });

    var buyPoints = [];
    weekly.dates.forEach(function (d, i) {
      if (weekly.below[i]) buyPoints.push({ coord: [d, weekly.close[i]], value: weekly.close[i] });
    });

    return makeChart(elId, {
      animationDuration: 900,
      grid: { left: 64, right: 24, top: 46, bottom: 78 },
      legend: {
        top: 6, left: 8,
        textStyle: { color: "#8b94a7", fontFamily: FONT, fontSize: 12 },
        itemGap: 22,
        icon: "roundRect", itemWidth: 14, itemHeight: 4,
        data: [name + " weekly close", "200-week moving average", "Below 200WMA (buy signal)"],
      },
      tooltip: baseTooltip(function (v) { return v == null ? "—" : "$" + nf2.format(v); }),
      xAxis: baseXAxis(weekly.dates),
      yAxis: baseYAxis({ formatter: function (v) { return "$" + nf0.format(v); } }),
      dataZoom: baseDataZoom(),
      series: [
        {
          name: name + " weekly close",
          type: "line",
          data: weekly.close,
          showSymbol: false,
          smooth: 0.15,
          lineStyle: { width: 2.4, color: color },
          itemStyle: { color: color },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: hexFade(color, 0.26) },
                { offset: 1, color: hexFade(color, 0) },
              ],
            },
          },
          markArea: { silent: true, data: markAreas },
          z: 3,
        },
        {
          name: "200-week moving average",
          type: "line",
          data: weekly.ma200,
          showSymbol: false,
          smooth: 0.4,
          lineStyle: { width: 2, color: COLORS.ma, type: [6, 4] },
          itemStyle: { color: COLORS.ma },
          z: 2,
        },
        {
          name: "Below 200WMA (buy signal)",
          type: "scatter",
          data: buyPoints,
          symbolSize: 9,
          itemStyle: { color: COLORS.red, borderColor: "#fff", borderWidth: 1.2, shadowBlur: 8, shadowColor: "rgba(255,92,108,0.7)" },
          z: 5,
        },
      ],
    });
  }

  function hexFade(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  /* ------------------------------------------------------------------ *
   *  Header KPIs + signal banner (NDQ)
   * ------------------------------------------------------------------ */

  var k = D.kpis;

  document.getElementById("asOf").textContent =
    "Prices to " + k.ndqDate + " · AusSuper rates to " + D.trailing["AusSuper Australian Shares"].asOf;

  countUp(document.getElementById("kPrice"), k.ndqPrice, 2, "$");
  document.getElementById("kPriceDate").textContent = "ASX close · " + k.ndqDate;

  countUp(document.getElementById("kMa"), k.ma200, 2, "$");
  document.getElementById("kMaNote").textContent = "200-week simple moving average";

  var vsEl = document.getElementById("kVsMa");
  var vs = k.vsMaPct;
  countUp(vsEl, vs, 2, vs >= 0 ? "+" : "", "%");
  vsEl.classList.add(vs >= 0 ? "pos" : "neg");
  document.getElementById("kVsMaNote").textContent = vs >= 0 ? "above the 200WMA" : "below the 200WMA";

  document.getElementById("kZones").textContent = k.buyZoneCount;
  document.getElementById("kZonesNote").textContent =
    k.weeksInBuyZone + " weeks in buy zone since 2019 (MA history)";

  var t10 = D.trailing["NDQ.AX"]["10Y"];
  countUp(document.getElementById("k10y"), t10, 2, "+", "%");
  document.getElementById("k10yNote").textContent = "p.a. total return incl. distributions";

  // HNDQ snapshot KPIs
  var hk = D.hndqKpi;
  countUp(document.getElementById("hndqPrice"), hk.price, 2, "$");
  document.getElementById("hndqPriceDate").textContent = "ASX close · " + hk.date;
  countUp(document.getElementById("hndqMa"), hk.ma200, 2, "$");
  document.getElementById("hndqMaNote").textContent = "200-week simple moving average";
  var hVsEl = document.getElementById("hndqVsMa");
  var hVs = hk.vsMaPct;
  if (hVs !== null && hVs !== undefined) {
    countUp(hVsEl, hVs, 2, hVs >= 0 ? "+" : "", "%");
    hVsEl.classList.add(hVs >= 0 ? "pos" : "neg");
    document.getElementById("hndqVsMaNote").textContent = hVs >= 0 ? "above the 200WMA" : "below the 200WMA";
  } else {
    hVsEl.textContent = "n/a";
    document.getElementById("hndqVsMaNote").textContent = "MA requires 4 years of data";
  }
  document.getElementById("hndqZonesCount").textContent = hk.buyZoneCount;
  document.getElementById("hndqZonesNote").textContent =
    hk.weeksInBuyZone + " weeks in buy zone since Jul 2020";
  var h5y = D.trailing["HNDQ.AX"]["5Y"];
  countUp(document.getElementById("hndq5y"), h5y, 2, "+", "%");
  document.getElementById("hndq5yNote").textContent = "p.a. total return incl. distributions";

  var banner = document.getElementById("signalBanner");
  var badge = document.getElementById("signalBadge");
  var signalText = document.getElementById("signalText");
  if (k.inBuyZone) {
    banner.classList.add("below");
    badge.textContent = "● BUY ZONE ACTIVE";
    badge.className = "signal-badge";
    signalText.innerHTML = "<b>NDQ is trading below its 200-week moving average.</b> " +
      "<span>Historically this has been a rare accumulation signal — it has only happened for " +
      k.weeksInBuyZone + " of the last " + k.weeksWithMa + " weeks.</span>";
  } else {
    banner.classList.add("above");
    badge.textContent = "● ABOVE 200WMA";
    signalText.innerHTML = "<b>NDQ is " + nf2.format(vs) + "% above its 200-week moving average ($" +
      nf2.format(k.ma200) + ").</b> <span>No buy signal is active. The indicator has only triggered for " +
      k.weeksInBuyZone + " of the last " + k.weeksWithMa + " weeks (" +
      nf2.format(k.weeksInBuyZone / k.weeksWithMa * 100) + "% of the time).</span>";
  }

  /* ------------------------------------------------------------------ *
   *  Chart 1 — NDQ weekly vs 200WMA + buy zones (hero)
   * ------------------------------------------------------------------ */

  buildMaChart("chartMain", D.ndqWeekly, D.buyZones, "NDQ", COLORS.ndq);

  var zonesEl = document.getElementById("zones");
  if (!D.buyZones.length) {
    zonesEl.innerHTML = '<div class="zone"><div class="z-main"><div class="z-title">No buy zones in the available history.</div></div></div>';
  } else {
    zonesEl.innerHTML = D.buyZones.map(function (z) {
      return '<div class="zone">' +
        '<div class="flag"><svg viewBox="0 0 24 24" fill="none" stroke="#ff5c6c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg></div>' +
        '<div class="z-main"><div class="z-title">' + z.start + ' → ' + z.end + '</div>' +
        '<div class="z-sub">NASDAQ-100 bear market — weekly closes under the 200WMA</div></div>' +
        '<div class="z-stat"><div class="v">' + z.weeks + '</div><div class="l">weeks</div></div>' +
        '<div class="z-stat"><div class="v neg">' + nf2.format(z.maxBelowPct) + '%</div><div class="l">max below MA</div></div>' +
        "</div>";
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   *  HNDQ — 200-week MA chart and KPIs
   * ------------------------------------------------------------------ */

  var hk = D.hndqKpi;
  var hVs = hk.vsMaPct;
  var hBanner = document.getElementById("hndqBanner");
  var hBadge = document.getElementById("hndqBadge");
  var hText = document.getElementById("hndqText");
  if (hVs !== null && hVs !== undefined) {
    hBanner.className = "signal-banner " + (hk.inBuyZone ? "below" : "above");
    hBadge.textContent = hk.inBuyZone ? "● BUY ZONE ACTIVE" : "● ABOVE 200WMA";
    hText.innerHTML = "<b>HNDQ is " + (hk.inBuyZone ? "" : "+") + nf2.format(hVs) + "% " +
      (hk.inBuyZone ? "below" : "above") + " its 200-week MA ($" + nf2.format(hk.ma200) + ").</b> " +
      "<span>The hedged version has " + (hk.buyZoneCount) + " buy zone(s) since its 2020 launch " +
      "(" + hk.weeksInBuyZone + " weeks under the 200WMA).</span>";
  } else {
    hText.innerHTML = "<span>200-week MA not yet available (requires 4 years of data).</span>";
  }

  buildMaChart("chartHndqMa", D.hndqWeekly, D.hndqZones, "HNDQ", COLORS.hndq);

  var hndqZonesEl = document.getElementById("hndqZones");
  if (!D.hndqZones.length) {
    hndqZonesEl.innerHTML = '<div class="zone"><div class="z-main"><div class="z-title">No buy zones in the available history.</div></div></div>';
  } else {
    hndqZonesEl.innerHTML = D.hndqZones.map(function (z) {
      return '<div class="zone">' +
        '<div class="flag"><svg viewBox="0 0 24 24" fill="none" stroke="#ff5c6c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg></div>' +
        '<div class="z-main"><div class="z-title">' + z.start + ' → ' + z.end + '</div>' +
        '<div class="z-sub">NASDAQ-100 bear market — weekly closes under the 200WMA</div></div>' +
        '<div class="z-stat"><div class="v">' + z.weeks + '</div><div class="l">weeks</div></div>' +
        '<div class="z-stat"><div class="v neg">' + nf2.format(z.maxBelowPct) + '%</div><div class="l">max below MA</div></div>' +
        "</div>";
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   *  US Tech Giants — Magnificent 8 summary cards & 200WMA chart
   * ------------------------------------------------------------------ */

  var TECH_STOCKS = [
    { key: "GOOGL", name: "Alphabet Class A", color: "#4285F4" },
    { key: "GOOG", name: "Alphabet Class C", color: "#34A853" },
    { key: "AAPL", name: "Apple", color: "#A2AAAD" },
    { key: "AMZN", name: "Amazon", color: "#FF9900" },
    { key: "META", name: "Meta", color: "#0081FB" },
    { key: "MSFT", name: "Microsoft", color: "#00BCF2" },
    { key: "NFLX", name: "Netflix", color: "#E50914" },
    { key: "NVDA", name: "NVIDIA", color: "#76B900" }
  ];

  // Build summary grid
  var techGrid = document.getElementById("techGrid");
  if (techGrid) {
    techGrid.innerHTML = TECH_STOCKS.map(function(s) {
      var data = D[s.key.toLowerCase() + "Kpi"];
      if (!data) return "";
      var isAbove = data.vsMaPct >= 0;
      var statusClass = isAbove ? "above" : "below";
      var statusText = isAbove ? "ABOVE 200WMA" : "● BUY ZONE";
      return '<div class="tech-card ' + statusClass + '">' +
        '<div class="ticker" style="color:' + s.color + '">' + s.key + '</div>' +
        '<div class="price">$' + nf2.format(data.price) + '</div>' +
        '<div class="vsma ' + (isAbove ? "pos" : "neg") + '">' +
          (isAbove ? "+" : "") + nf2.format(data.vsMaPct) + '% vs 200WMA' +
        '</div>' +
        '<div class="status">' + statusText + '</div>' +
      '</div>';
    }).join("");
  }

  // Build horizontal bar chart showing distance from 200WMA
  var techMaData = TECH_STOCKS.map(function(s) {
    var data = D[s.key.toLowerCase() + "Kpi"];
    return {
      name: s.key,
      value: data ? data.vsMaPct : 0,
      itemStyle: { color: s.color }
    };
  }).sort(function(a, b) { return b.value - a.value; });

  makeChart("chartTechMa", {
    animationDuration: 900,
    grid: { left: 80, right: 40, top: 20, bottom: 20 },
    xAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%", color: COLORS.axis, fontFamily: MONO, fontSize: 11 },
      splitLine: { lineStyle: { color: COLORS.split } },
      axisLine: { lineStyle: { color: COLORS.split } }
    },
    yAxis: {
      type: "category",
      data: techMaData.map(function(d) { return d.name; }),
      axisLabel: { color: "#aab2c5", fontFamily: MONO, fontSize: 12, fontWeight: 700 },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [{
      type: "bar",
      data: techMaData,
      barWidth: 18,
      label: {
        show: true,
        position: "right",
        formatter: function(p) { return (p.value >= 0 ? "+" : "") + nf2.format(p.value) + "%"; },
        color: "#aab2c5", fontFamily: MONO, fontSize: 10
      },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: "#5c6679", type: "dashed", width: 1 },
        data: [{ xAxis: 0 }]
      }
    }]
  });

  // Build detail cards with 200WMA charts for each stock
  var techCards = document.getElementById("techCards");
  if (techCards) {
    techCards.innerHTML = TECH_STOCKS.map(function(s, i) {
      var weekly = D[s.key.toLowerCase() + "Weekly"];
      var zones = D[s.key.toLowerCase() + "Zones"];
      var kpi = D[s.key.toLowerCase() + "Kpi"];
      if (!weekly || !kpi) return "";
      
      var isAbove = kpi.vsMaPct >= 0;
      var chartId = "chartTech" + s.key;
      
      setTimeout(function() {
        buildMaChart(chartId, weekly, zones, s.key, s.color);
      }, i * 100);
      
      return '<div class="tech-detail">' +
        '<div class="tech-detail-header">' +
          '<h4 style="color:' + s.color + '">' + s.key + ' — ' + s.name + '</h4>' +
          '<span class="badge ' + (isAbove ? "above" : "below") + '">' +
            (isAbove ? "ABOVE 200WMA" : "BUY ZONE ACTIVE") +
          '</span>' +
        '</div>' +
        '<div id="' + chartId + '" class="chart" style="height: 280px;"></div>' +
      '</div>';
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   *  Chart 2 — trailing 1/3/5/10 yr annualised returns (bars)
   * ------------------------------------------------------------------ */

  var periods = ["1Y", "3Y", "5Y", "10Y"];
  var retSeries = [
    { name: "NDQ.AX", color: COLORS.ndq, data: D.trailing["NDQ.AX"] },
    { name: "HNDQ.AX (hedged)", color: COLORS.hndq, data: D.trailing["HNDQ.AX"] },
    { name: "TSLA", color: COLORS.tsla, data: D.trailing["TSLA"] },
    { name: "AusSuper International Shares", color: COLORS.asIntl, data: D.trailing["AusSuper International Shares"] },
    { name: "AusSuper Australian Shares", color: COLORS.asAus, data: D.trailing["AusSuper Australian Shares"] },
  ];

  makeChart("chartReturns", {
    animationDuration: 900,
    grid: { left: 54, right: 24, top: 52, bottom: 40 },
    legend: {
      top: 4, left: 6,
      textStyle: { color: "#8b94a7", fontFamily: FONT, fontSize: 12 },
      itemGap: 20, icon: "circle", itemWidth: 9, itemHeight: 9,
    },
    tooltip: baseTooltip(function (v) { return v == null ? "n/a" : nf2.format(v) + "% p.a."; }),
    xAxis: {
      type: "category", data: periods.map(function (p) { return p + " p.a."; }),
      axisLine: { lineStyle: { color: COLORS.split } },
      axisTick: { show: false },
      axisLabel: { color: "#aab2c5", fontFamily: MONO, fontSize: 12, fontWeight: 700 },
    },
    yAxis: baseYAxis({ formatter: function (v) { return v + "%"; } }),
    series: retSeries.map(function (s) {
      return {
        name: s.name,
        type: "bar",
        barMaxWidth: 22,
        itemStyle: { color: s.color, borderRadius: [6, 6, 0, 0] },
        emphasis: { focus: "series" },
        data: periods.map(function (p) {
          var v = s.data[p];
          return v == null
            ? { value: null, itemStyle: { color: "rgba(255,255,255,0.07)" }, label: { show: true, position: "top", formatter: "n/a", color: "#5c6679", fontFamily: MONO, fontSize: 10 } }
            : v;
        }),
        label: {
          show: true, position: "top",
          formatter: function (pr) { return pr.value == null ? "" : nf2.format(pr.value); },
          color: "#aab2c5", fontFamily: MONO, fontSize: 10,
        },
      };
    }),
  });

  /* ------------------------------------------------------------------ *
   *  Chart 3 — growth of $100 since May 2015
   * ------------------------------------------------------------------ */

  var g = D.growth;
  var growthSeriesDef = [
    { name: "NDQ (total return)", color: COLORS.ndq, width: 2.4 },
    { name: "TSLA (total return)", color: COLORS.tsla, width: 2 },
    { name: "AusSuper International Shares", color: COLORS.asIntl, width: 1.8 },
    { name: "AusSuper Australian Shares", color: COLORS.asAus, width: 1.8 },
  ];

  var growthChart = makeChart("chartGrowth", growthOption(false));
  document.getElementById("logToggle").addEventListener("change", function (e) {
    growthChart.setOption(growthOption(e.target.checked), { replaceMerge: ["yAxis", "series"] });
  });

  function growthOption(log) {
    return {
      animationDuration: 900,
      grid: { left: 70, right: 24, top: 46, bottom: 78 },
      legend: {
        top: 6, left: 8,
        textStyle: { color: "#8b94a7", fontFamily: FONT, fontSize: 12 },
        itemGap: 20, icon: "roundRect", itemWidth: 14, itemHeight: 4,
      },
      tooltip: baseTooltip(function (v) { return v == null ? "—" : "$" + nf0.format(v); }),
      xAxis: baseXAxis(g.dates),
      yAxis: baseYAxis({
        log: log, min: log ? 50 : null,
        formatter: function (v) { return "$" + nf0.format(v); },
      }),
      dataZoom: baseDataZoom(),
      series: growthSeriesDef.map(function (def) {
        return {
          name: def.name,
          type: "line",
          data: g[def.name],
          showSymbol: false,
          smooth: 0.12,
          connectNulls: true,
          lineStyle: { width: def.width, color: def.color },
          itemStyle: { color: def.color },
          areaStyle: def.name.indexOf("NDQ") === 0 ? {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(77,195,255,0.20)" },
                { offset: 1, color: "rgba(77,195,255,0.00)" },
              ],
            },
          } : undefined,
        };
      }),
    };
  }

  /* ------------------------------------------------------------------ *
   *  Chart 4 — hedged vs unhedged since HNDQ inception (Jul 2020)
   * ------------------------------------------------------------------ */

  var h = D.hedge;
  var hedgeDef = [
    { name: "NDQ (unhedged)", color: COLORS.ndq, width: 2.4 },
    { name: "HNDQ (AUD hedged)", color: COLORS.hndq, width: 2.4 },
    { name: "AusSuper International Shares", color: COLORS.asIntl, width: 1.8 },
  ];

  makeChart("chartHedge", {
    animationDuration: 900,
    grid: { left: 64, right: 24, top: 46, bottom: 78 },
    legend: {
      top: 6, left: 8,
      textStyle: { color: "#8b94a7", fontFamily: FONT, fontSize: 12 },
      itemGap: 20, icon: "roundRect", itemWidth: 14, itemHeight: 4,
    },
    tooltip: baseTooltip(function (v) { return v == null ? "—" : "$" + nf0.format(v); }),
    xAxis: baseXAxis(h.dates),
    yAxis: baseYAxis({ formatter: function (v) { return "$" + nf0.format(v); } }),
    dataZoom: baseDataZoom(),
    series: hedgeDef.map(function (def) {
      return {
        name: def.name,
        type: "line",
        data: h[def.name],
        showSymbol: false,
        smooth: 0.12,
        connectNulls: true,
        lineStyle: { width: def.width, color: def.color },
        itemStyle: { color: def.color },
      };
    }),
  });

  /* ------------------------------------------------------------------ *
   *  Tesla — KPIs + 200WMA chart + compact zone chips
   * ------------------------------------------------------------------ */

  var tk = D.tslaKpi;
  countUp(document.getElementById("tPrice"), tk.price, 2, "$");
  document.getElementById("tPriceNote").textContent = "NASDAQ close · " + tk.date;
  countUp(document.getElementById("tMa"), tk.ma200, 2, "$");
  var tVs = document.getElementById("tVsMa");
  countUp(tVs, tk.vsMaPct, 2, tk.vsMaPct >= 0 ? "+" : "", "%");
  tVs.classList.add(tk.vsMaPct >= 0 ? "pos" : "neg");
  document.getElementById("tVsMaNote").textContent = tk.vsMaPct >= 0 ? "above the 200WMA" : "below the 200WMA";
  document.getElementById("tZones").textContent = tk.buyZoneCount;
  document.getElementById("tZonesNote").textContent = tk.weeksInBuyZone + " weeks total in buy zones";
  countUp(document.getElementById("t10y"), D.trailing["TSLA"]["10Y"], 2, "+", "%");
  document.getElementById("t10yNote").textContent = "p.a. total return (10 yrs)";

  buildMaChart("chartTsla", D.tslaWeekly, D.tslaZones, "TSLA", COLORS.tsla);

  /* compact zone chips (Tesla has 9 zones — chips keep it tidy) */
  document.getElementById("tslaZones").innerHTML = D.tslaZones.map(function (z) {
    return '<span class="zone-chip" title="' + z.weeks + ' week(s) below the 200WMA · max ' +
      nf2.format(z.maxBelowPct) + '% below">' +
      "<b>" + z.start.slice(0, 7) + "</b> → " + z.end.slice(0, 7) +
      " · " + z.weeks + "wk · <i>" + nf2.format(z.maxBelowPct) + "%</i></span>";
  }).join("");

  /* ------------------------------------------------------------------ *
   *  SpaceX — KPIs + valuation journey chart (private rounds → SPCX)
   * ------------------------------------------------------------------ */

  var sx = D.spcx;
  countUp(document.getElementById("xPrice"), sx.price, 2, "$");
  document.getElementById("xPriceNote").textContent = "NASDAQ close · " + sx.date;
  var xIpo = document.getElementById("xSinceIpo");
  countUp(xIpo, sx.sinceIpoPct, 2, sx.sinceIpoPct >= 0 ? "+" : "", "%");
  xIpo.classList.add(sx.sinceIpoPct >= 0 ? "pos" : "neg");
  document.getElementById("xSinceIpoNote").textContent = "vs $" + nf0.format(sx.ipoPrice) + " IPO price · 12 Jun 2026";
  countUp(document.getElementById("xCap"), sx.impliedMarketCapB / 1000, 2, "$", "T");
  document.getElementById("xCapNote").textContent = "implied · ≈" + nf2.format(sx.impliedSharesB) + "B shares";
  countUp(document.getElementById("xPeak"), sx.peakClose, 2, "$");
  document.getElementById("xPeakNote").textContent = "peak close · 16 Jun 2026 debut week";

  var priv = D.spacexVal.private;
  var KEY_EVENTS = {
    "2012-05-25": "ISS docking",
    "2015-01-20": "Google/Fidelity",
    "2021-10-08": "$100B",
    "2024-12-03": "$350B",
    "2026-03-02": "xAI merger ~$1T",
    "2026-06-11": "IPO @ $135",
  };

  function fmtCap(v) {
    return v >= 1000 ? "$" + nf2.format(v / 1000) + "T" : "$" + nf0.format(v) + "B";
  }

  makeChart("chartSpcx", {
    animationDuration: 1200,
    grid: { left: 78, right: 30, top: 52, bottom: 78 },
    legend: {
      top: 6, left: 8,
      textStyle: { color: "#8b94a7", fontFamily: FONT, fontSize: 12 },
      itemGap: 22, icon: "roundRect", itemWidth: 14, itemHeight: 4,
      data: ["Private valuations (funding rounds & tenders)", "SPCX implied market cap (daily)"],
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(10,14,24,0.94)",
      borderColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { color: "#e8ecf4", fontFamily: FONT, fontSize: 12.5 },
      confine: true,
      formatter: function (p) {
        if (p.seriesName.indexOf("Private") === 0) {
          var d = p.data;
          return "<b>" + fmtCap(d.value[1]) + "</b><br/>" + d.event +
            "<br/><span style='color:#8b94a7;font-size:11px'>" + d.value[0] + " · source: " + d.src + "</span>";
        }
        return "<b>" + fmtCap(p.value[1]) + "</b> implied<br/><span style='color:#8b94a7;font-size:11px'>" +
          p.value[0] + " · SPCX close × ~13.33B shares</span>";
      },
    },
    xAxis: {
      type: "time",
      min: "2011-06-01",
      axisLine: { lineStyle: { color: COLORS.split } },
      axisLabel: { color: COLORS.axis, fontFamily: MONO, fontSize: 11, hideOverlap: true },
    },
    yAxis: {
      type: "log",
      min: 1,
      axisLabel: { color: COLORS.axis, fontFamily: MONO, fontSize: 11, formatter: fmtCap },
      splitLine: { lineStyle: { color: COLORS.split } },
    },
    dataZoom: [
      { type: "inside", throttle: 40 },
      {
        type: "slider", height: 34, bottom: 8,
        borderColor: "rgba(255,255,255,0.1)",
        backgroundColor: "rgba(255,255,255,0.02)",
        fillerColor: "rgba(232,236,244,0.08)",
        handleStyle: { color: "#e8ecf4", borderColor: "#e8ecf4" },
        moveHandleStyle: { color: "#e8ecf4" },
        textStyle: { color: COLORS.axis, fontFamily: MONO, fontSize: 10 },
      },
    ],
    series: [
      {
        name: "Private valuations (funding rounds & tenders)",
        type: "line",
        step: "end",
        symbol: "circle",
        symbolSize: 9,
        data: priv.map(function (p) { return { value: [p.date, p.valB], event: p.event, src: p.src }; }),
        lineStyle: { color: "rgba(232,236,244,0.75)", width: 1.8, type: [5, 5] },
        itemStyle: { color: COLORS.spcx, borderColor: "#0b1120", borderWidth: 2 },
        label: {
          show: true,
          position: "top",
          distance: 8,
          color: "#c9d4e8",
          fontFamily: MONO,
          fontSize: 10,
          formatter: function (p) { return KEY_EVENTS[p.data.value[0]] || ""; },
        },
        markArea: {
          silent: true,
          itemStyle: { color: "rgba(255,255,255,0.022)" },
          label: { color: "#5c6679", fontFamily: MONO, fontSize: 10.5, position: "insideTop", offset: [0, 6] },
          data: [[{ xAxis: "2011-06-01", label: { formatter: "PRIVATE ERA — press-reported valuations" } },
                  { xAxis: "2026-06-12" }]],
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: COLORS.green, type: "solid", width: 1.4, opacity: 0.7 },
          label: { color: COLORS.green, fontFamily: MONO, fontSize: 10.5, formatter: "IPO · 12 JUN 2026", position: "insideEndTop" },
          data: [{ xAxis: "2026-06-12" }],
        },
        z: 3,
      },
      {
        name: "SPCX implied market cap (daily)",
        type: "line",
        data: D.spacexVal.publicImpliedCap,
        showSymbol: false,
        smooth: 0.2,
        lineStyle: { width: 2.6, color: COLORS.spcxPublic },
        itemStyle: { color: COLORS.spcxPublic },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(0,208,156,0.22)" },
              { offset: 1, color: "rgba(0,208,156,0.00)" },
            ],
          },
        },
        z: 4,
      },
    ],
  });

  /* ------------------------------------------------------------------ *
   *  Comparison table
   * ------------------------------------------------------------------ */

  var rows = [
    { name: "NDQ.AX", sub: "BetaShares NASDAQ 100 ETF · ASX", color: COLORS.ndq, key: "NDQ.AX" },
    { name: "HNDQ.AX", sub: "BetaShares NASDAQ 100 · AUD hedged", color: COLORS.hndq, key: "HNDQ.AX" },
    { name: "TSLA", sub: "Tesla Inc · NASDAQ · data from Jan 2015", color: COLORS.tsla, key: "TSLA" },
    { name: "SPCX", sub: "SpaceX · NASDAQ · IPO 12 Jun 2026", color: COLORS.spcx, key: "SPCX", sinceIpo: true },
    { name: "AusSuper International Shares", sub: "DIY Mix option · crediting rates", color: COLORS.asIntl, key: "AusSuper International Shares" },
    { name: "AusSuper Australian Shares", sub: "DIY Mix option · crediting rates", color: COLORS.asAus, key: "AusSuper Australian Shares" },
  ];

  function bestPerPeriod() {
    var best = {};
    periods.forEach(function (p) {
      var mx = -Infinity;
      rows.forEach(function (r) {
        var v = D.trailing[r.key][p];
        if (v != null && v > mx) mx = v;
      });
      best[p] = mx;
    });
    return best;
  }
  var best = bestPerPeriod();

  var html = "";
  rows.forEach(function (r) {
    var t = D.trailing[r.key];
    html += "<tr><td><span class='series-dot' style='background:" + r.color + "'></span>" + r.name +
      "<span class='cell-sub'>" + r.sub + " · to " + t.asOf + "</span></td>";
    periods.forEach(function (p) {
      var v = t[p];
      if (v == null) {
        var why = r.key === "SPCX" ? "listed Jun 2026" : "fund too young";
        html += "<td class='na'>n/a<span class='cell-sub'>" + why + "</span></td>";
      } else {
        var cls = (Math.abs(v - best[p]) < 0.005) ? "best" : (v >= 0 ? "pos" : "neg");
        html += "<td class='" + cls + "'>" + (v >= 0 ? "+" : "") + nf2.format(v) + "%</td>";
      }
    });
    if (r.sinceIpo) {
      html += "<td class='" + (t.sinceIpoPct >= 0 ? "pos" : "neg") + "'>" +
        (t.sinceIpoPct >= 0 ? "+" : "") + nf2.format(t.sinceIpoPct) + "%" +
        "<span class='cell-sub'>raw since IPO · not annualised</span></td></tr>";
    } else {
      html += "<td class='" + (t.sinceInception >= 0 ? "pos" : "neg") + "'>" +
        (t.sinceInception != null ? "+" + nf2.format(t.sinceInception) + "%" : "—") + "</td></tr>";
    }
  });

  /* official published AusSuper figures (independent of our calculation) */
  var off = D.officialAS;
  ["International Shares", "Australian Shares"].forEach(function (name) {
    var o = off.options[name];
    if (!o) return;
    html += "<tr style='opacity:.85'><td><span class='series-dot' style='background:" +
      (name === "International Shares" ? COLORS.asIntl : COLORS.asAus) +
      ";opacity:.55'></span>AusSuper " + name + " <i style='font-style:normal;color:#8b94a7'>(official published)</i>" +
      "<span class='cell-sub'>AustralianSuper adviser report · to " + off.asOf + "</span></td>";
    periods.forEach(function (p) {
      html += "<td>" + (o[p] != null ? "+" + nf2.format(o[p]) + "%" : "—") + "</td>";
    });
    html += "<td class='na'>—</td></tr>";
  });

  document.getElementById("tbodyCompare").innerHTML = html;

  /* sources footer */
  document.getElementById("sources").innerHTML = D.sources.map(function (s) {
    return "<div><span>" + s.name + "</span><span>data to " + s.asOf + "</span></div>";
  }).join("");
  document.getElementById("generated").textContent = "Dashboard generated " + D.generatedAt;
};

/* ==========================================================================
   Refresh button — re-runs the scraper via serve.py and hot-reloads the data
   ========================================================================== */
(function () {
  var btn = document.getElementById("refreshBtn");
  if (!btn) return;
  var pill = document.getElementById("asOf");
  var label = document.getElementById("refreshLabel");
  var spinKey = "refresh-spin";

  function setSpin(on) {
    btn.disabled = on;
    btn.classList.toggle("is-busy", on);
    if (label) label.textContent = on ? "Refreshing…" : "Refresh data";
  }

  function toast(msg, kind) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show " + (kind || "");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.className = "toast"; }, 4800);
  }

  btn.addEventListener("click", function () {
    if (btn.disabled) return;
    setSpin(true);
    if (pill) pill.textContent = "Refreshing live data…";
    var t0 = performance.now();

    fetch("/api/refresh", { method: "POST" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (info) {
        return fetch("data/dashboard.js?v=" + Date.now())
          .then(function (r) { return r.text(); })
          .then(function (txt) {
            var json = txt.replace(/^window\.DASHBOARD_DATA\s*=\s*/, "").replace(/;\s*$/, "");
            window.DASHBOARD_DATA = JSON.parse(json);
            window.NDQInit();
            var secs = ((performance.now() - t0) / 1000).toFixed(1);
            var gen = window.DASHBOARD_DATA.generatedAt || "now";
            if (pill) pill.textContent = "Last refresh · " + gen;
            if (info.ok) {
              toast("Data refreshed from live sources in " + secs + "s", "ok");
            } else {
              toast("Refresh completed with warnings — see console", "warn");
              console.warn("fetch_data.py output:\n" + info.log);
            }
          });
      })
      .catch(function (err) {
        if (pill) pill.textContent = "Refresh unavailable";
        toast("Live refresh needs serve.py running (got: " + err.message + ")", "err");
      })
      .then(function () { setSpin(false); });
  });
})();

window.NDQInit();
