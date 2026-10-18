var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/mcp.js
var SERVER = { name: "2028-admissions", title: "2028 \uB300\uC785\uC804\uD615 \uC2DC\uD589\uACC4\uD68D \uC694\uC57D", version: "1.0.0" };
var PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
var INSTRUCTIONS = `2028\uD559\uB144\uB3C4 \uB300\uC785\uC804\uD615 \uC2DC\uD589\uACC4\uD68D \uC694\uC57D \uB370\uC774\uD130(\uB300\uD559 \uC57D 95\uACF3, \uC815\uC6D0 \uB0B4 \uD559\uC0DD\uBD80\uAD50\uACFC\xB7\uD559\uC0DD\uBD80\uC885\uD569\xB7\uB17C\uC220\xB7\uC815\uC2DC \uC218\uB2A5\uC704\uC8FC \uC804\uD615\uACFC \uB18D\uC5B4\uCD0C \uC804\uD615)\uB97C \uAC80\uC0C9\uD558\uB294 \uC11C\uBC84\uC785\uB2C8\uB2E4.
- \uCD9C\uCC98\uB294 \uAC01 \uB300\uD559\uC774 \uACF5\uAC1C\uD55C 2028\uD559\uB144\uB3C4 \uB300\uC785\uC804\uD615 \uC2DC\uD589\uACC4\uD68D PDF\uBFD0\uC785\uB2C8\uB2E4. \uB2F5\uD560 \uB54C \uB3C4\uAD6C \uACB0\uACFC\uC758 '\uC6D0\uBB38'(PDF \uB9C1\uD06C\uC640 \uCABD\uC218)\uC744 \uD568\uAED8 \uC81C\uC2DC\uD558\uC138\uC694.
- \uC2DC\uD589\uACC4\uD68D\uC740 \uBAA8\uC9D1\uC694\uAC15\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uCD5C\uC885 \uD655\uC778\uC740 \uB300\uD559 \uBAA8\uC9D1\uC694\uAC15\uC73C\uB85C \uD558\uB77C\uACE0 \uC548\uB0B4\uD558\uC138\uC694.
- \uC785\uC2DC \uACB0\uACFC(\uD569\uACA9\uC120\xB7\uACBD\uC7C1\uB960)\uB294 \uC5C6\uC2B5\uB2C8\uB2E4. \uD569\uACA9 \uAC00\uB2A5\uC131\uC744 \uCD94\uCE21\uD558\uC9C0 \uB9C8\uC138\uC694.
- \uAC12\uC774 '\uBBF8\uAE30\uC7AC'\uC774\uBA74 \uC6D0\uBB38\uC5D0 \uC5C6\uAC70\uB098 \uD310\uB3C5\uD560 \uC218 \uC5C6\uB294 \uAC83\uC785\uB2C8\uB2E4. \uCD94\uCE21\uC73C\uB85C \uCC44\uC6B0\uC9C0 \uB9C8\uC138\uC694.
- \uACE0\uB978\uAE30\uD68C\xB7\uD2B9\uAE30\uC790\xB7\uC7AC\uC678\uAD6D\uBBFC\xB7\uC815\uC6D0 \uC678 \uC804\uD615\uC740 \uB300\uD559 \uC0C1\uC138\uC758 \uBE44\uACE0(notes)\uC5D0\uB9CC \uC788\uC2B5\uB2C8\uB2E4.
- \uB77C\uC774\uC120\uC2A4: CC BY-NC 4.0 (\uBD09\uC77C\uCC9C\uACE0\uB4F1\uD559\uAD50 \uC9C4\uB85C\uC9C4\uD559\uBD80). \uB300\uC2DC\uBCF4\uB4DC: https://2023swhs3rd-a11y.github.io/2028plan/`;
var TRACKS = ["\uAD50\uACFC", "\uC885\uD569", "\uB17C\uC220", "\uC815\uC2DC"];
var GROUPS = ["\uC77C\uBC18", "\uC9C0\uBC29\uAD6D\uB9BD", "\uAD50\uB300", "\uACFC\uAE30\uC6D0"];
var REGIONS = ["\uC11C\uC6B8", "\uACBD\uAE30", "\uC778\uCC9C", "\uAC15\uC6D0", "\uB300\uC804", "\uC138\uC885", "\uCDA9\uBD81", "\uCDA9\uB0A8", "\uB300\uAD6C", "\uACBD\uBD81", "\uBD80\uC0B0", "\uC6B8\uC0B0", "\uACBD\uB0A8", "\uAD11\uC8FC", "\uC804\uBD81", "\uC804\uB0A8", "\uC81C\uC8FC"];
var CATS = ["\uC218\uB2A5\uCD5C\uC800", "\uBC18\uC601\uBE44\uC728\xB7\uBC29\uBC95", "\uC804\uD615 \uC2E0\uC124\xB7\uAC1C\uD3B8", "\uBAA8\uC9D1\uC778\uC6D0", "\uC9C0\uC6D0\uC790\uACA9", "\uBA74\uC811", "\uC218\uB2A5 \uBC18\uC601", "\uB17C\uC220 \uCD9C\uC81C", "\uD559\uD3ED \uBC18\uC601", "\uC2E4\uAE30", "\uAE30\uD0C0"];
var GNAME = { \uC77C\uBC18: "\uC77C\uBC18\uB300\uD559", \uC9C0\uBC29\uAD6D\uB9BD: "\uC9C0\uBC29\uAD6D\uB9BD\uB300\uD559", \uAD50\uB300: "\uAD50\uC721\uB300\uD559", \uACFC\uAE30\uC6D0: "\uACFC\uD559\uAE30\uC220\uC6D0" };
var MED = /^(의예|의학|치의예|치의학|한의예|한의학|약학|제약학|수의예|수의학|간호학?)(과|부)?$/;
var isMed = /* @__PURE__ */ __name((r) => !!r.dept && r.dept.split("\xB7").every((d) => MED.test(d.trim())), "isMed");
var REG = /(대구|경북|부산|울산|경남|부울경|광주|전남|전북|호남|충청|충남|충북|대전|세종|강원|제주|진료권|광역권)[^,;]{0,40}(고교|고등학교|중학교)[^,;]{0,30}(입학|이수|졸업|재학)/;
var isReg = /* @__PURE__ */ __name((r) => /지역인재|지역의사|지역의료/.test(r.name) || REG.test(r.elig_text || ""), "isReg");
var norm = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/\s+/g, "").toLowerCase(), "norm");
var has = /* @__PURE__ */ __name((hay, needle) => norm(hay).includes(norm(needle)), "has");
var pdf = /* @__PURE__ */ __name((u, r) => `https://drive.google.com/file/d/${r && r.fid || u.fid}/view`, "pdf");
var src = /* @__PURE__ */ __name((u, r) => ({ "PDF": pdf(u, r), "\uD30C\uC77C": r && r.ft || u.ft, "\uCABD": r ? r.pg ?? null : null }), "src");
var minOf = /* @__PURE__ */ __name((r) => r.min_flag === "\uC5C6\uC74C" ? "\uC5C6\uC74C" : r.min_s || r.min_text || r.min_flag || "\uBBF8\uAE30\uC7AC", "minOf");
var clean = /* @__PURE__ */ __name((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== void 0 && v !== null && v !== "")), "clean");
function findUniv(data, name) {
  const n = norm(name);
  const U = data.universities;
  return U.find((u) => norm(u.u) === n) || U.find((u) => norm(u.u).includes(n) || n.includes(norm(u.u)));
}
__name(findUniv, "findUniv");
function brief(u, r) {
  return clean({
    \uB300\uD559: u.u,
    \uC9C0\uC5ED: u.rg,
    \uAD6C\uBD84: GNAME[u.g] || u.g,
    \uCEA0\uD37C\uC2A4: r.campus,
    \uC804\uD615: r.track,
    \uC804\uD615\uBA85: r.name,
    \uBAA8\uC9D1\uB2E8\uC704: r.dept,
    \uBAA8\uC9D1\uC778\uC6D0: r.quota ?? "\uBBF8\uAE30\uC7AC",
    \uC804\uD615\uBC29\uBC95: r.method,
    \uC120\uBC1C\uAD6C\uC870: r.structure,
    "1\uB2E8\uACC4": r.stage1,
    \uC218\uB2A5\uCD5C\uC800: minOf(r),
    \uBA74\uC811: r.interview === "\uC788\uC74C" ? `\uC788\uC74C${r.interview_ratio ? ` ${r.interview_ratio}` : ""}` : r.interview,
    \uCD94\uCC9C: r.recommend,
    \uC9C0\uC6D0\uC790\uACA9: r.elig,
    \uAD70: r.gun,
    \uC6D0\uBB38: src(u, r)
  });
}
__name(brief, "brief");
function detail(u, r) {
  const extra = {
    \uAD50\uACFC: { \uD3C9\uAC00\uBC29\uC2DD: r.stage_desc, \uBC18\uC601\uACFC\uBAA9: r.subjects, \uBC18\uC601\uACFC\uBAA9\uC694\uC57D: r.sb && r.sb.d, \uB4F1\uAE09\uD658\uC0B0: r.grade_scale, \uCD9C\uACB0: r.attendance, \uC11C\uB958: r.doc_ratio },
    \uC885\uD569: { \uC720\uD615: r.type, \uBA74\uC811\uC720\uD615: r.interview_type },
    \uB17C\uC220: { \uB17C\uC220\uBE44\uC728: r.essay_ratio, \uB17C\uC220\uC678: r.other, \uCD9C\uC81C\uD615\uD0DC: r.essay_type },
    \uC815\uC2DC: { \uAD70: r.gun, \uBC18\uC601\uC601\uC5ED: r.areas, \uD65C\uC6A9\uC9C0\uD45C: r.index, \uBC18\uC601\uC601\uC5ED\uC218: r.n_areas, \uD559\uC0DD\uBD80: r.gyogwa === "\uBBF8\uBC18\uC601" ? "\uBBF8\uBC18\uC601" : [r.gyogwa, r.gyogwa_ratio].filter(Boolean).join(" "), \uCD9C\uACB0: r.attendance }
  }[r.track] || {};
  return clean({ ...brief(u, r), \uC218\uB2A5\uCD5C\uC800\uC6D0\uBB38: r.min_text, \uC9C0\uC6D0\uC790\uACA9\uC0C1\uC138: r.elig_text, ...extra, "2028\uBCC0\uACBD": r.change, \uBE44\uACE0: r.note });
}
__name(detail, "detail");
function rurRow(u, r) {
  return clean({
    \uB300\uD559: u.u,
    \uC9C0\uC5ED: u.rg,
    \uCEA0\uD37C\uC2A4: r.campus,
    \uC804\uD615: r.track,
    \uC804\uD615\uBA85: r.name,
    \uB300\uC0C1: r.aud === "\uD3EC\uD568" ? `\uD3EC\uD568(${r.aud_with || "\uC5EC\uB7EC \uB300\uC0C1"})` : r.aud,
    \uC815\uC6D0: r.cap === "\uC678" ? "\uC815\uC6D0 \uC678" : r.cap === "\uB0B4" ? "\uC815\uC6D0 \uB0B4" : r.cap,
    \uC790\uACA9: r.rq,
    \uC790\uACA9\uC0C1\uC138: r.rq_text,
    \uBAA8\uC9D1\uC778\uC6D0: r.quota ?? (r.track === "\uC815\uC2DC" ? "\uC218\uC2DC \uC774\uC6D4\uBD84" : "\uBBF8\uAE30\uC7AC"),
    \uC804\uD615\uBC29\uBC95: r.method,
    \uC218\uB2A5\uCD5C\uC800: minOf(r),
    \uC774\uC6D4: r.carry,
    \uAD70: r.gun,
    \uC6D0\uBB38: src(u, r)
  });
}
__name(rurRow, "rurRow");
var page = /* @__PURE__ */ __name((list, limit) => {
  const n = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  return { \uACB0\uACFC\uC218: list.length, ...list.length > n ? { \uC548\uB0B4: `\uC55E\uC758 ${n}\uAC1C\uB9CC \uBCF4\uB0C5\uB2C8\uB2E4. \uC870\uAC74\uC744 \uC881\uD788\uAC70\uB098 limit\uC744 \uB298\uB9AC\uC138\uC694(\uCD5C\uB300 100).` } : {}, \uBAA9\uB85D: list.slice(0, n) };
}, "page");
var arr = /* @__PURE__ */ __name((v) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter((x) => x !== "" && x != null), "arr");
var TOOLS = [
  {
    name: "search_admissions",
    title: "\uC804\uD615 \uAC80\uC0C9",
    description: "\uC870\uAC74\uC5D0 \uB9DE\uB294 2028 \uC815\uC6D0 \uB0B4 \uC804\uD615(\uAD50\uACFC\xB7\uC885\uD569\xB7\uB17C\uC220\xB7\uC815\uC2DC)\uC744 \uCC3E\uC2B5\uB2C8\uB2E4. \uC9C0\uC5ED\xB7\uB300\uD559 \uAD6C\uBD84\xB7\uC804\uD615 \uC885\uB958\xB7\uC218\uB2A5\uCD5C\uC800\xB7\uBA74\uC811\xB7\uD559\uAD50\uC7A5\uCD94\uCC9C\xB7\uC878\uC5C5\uC0DD \uC9C0\uC6D0 \uAC00\uB2A5\xB7\uC815\uC2DC \uAD70\xB7\uD0A4\uC6CC\uB4DC\uB85C \uAC70\uB97C \uC218 \uC788\uACE0, \uC5EC\uB7EC \uB300\uD559\uC744 \uC9C0\uC815\uD558\uBA74 \uBE44\uAD50\uD45C\uB85C \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACB0\uACFC\uB9C8\uB2E4 \uC6D0\uBB38 PDF \uB9C1\uD06C\uC640 \uCABD\uC218\uAC00 \uBD99\uC2B5\uB2C8\uB2E4.",
    inputSchema: {
      type: "object",
      properties: {
        universities: { type: "array", items: { type: "string" }, description: "\uB300\uD559\uBA85(\uC77C\uBD80\uB9CC \uC368\uB3C4 \uB428). \uC5EC\uB7EC \uAC1C\uBA74 \uADF8 \uB300\uD559\uB4E4\uB9CC" },
        region: { type: "array", items: { type: "string", enum: REGIONS }, description: "\uB300\uD559 \uC18C\uC7AC \uC9C0\uC5ED" },
        group: { type: "array", items: { type: "string", enum: GROUPS }, description: "\uB300\uD559 \uAD6C\uBD84" },
        track: { type: "array", items: { type: "string", enum: TRACKS }, description: "\uC804\uD615 \uC885\uB958(\uC815\uC2DC = \uC815\uC2DC \uC218\uB2A5\uC704\uC8FC)" },
        csat_min: { type: "string", enum: ["\uC788\uC74C", "\uC5C6\uC74C"], description: "\uC218\uB2A5\uCD5C\uC800: '\uC788\uC74C'\uC740 \uC77C\uBD80 \uBAA8\uC9D1\uB2E8\uC704 \uC801\uC6A9 \uD3EC\uD568" },
        interview: { type: "string", enum: ["\uC788\uC74C", "\uC5C6\uC74C"] },
        school_recommendation: { type: "boolean", description: "true: \uD559\uAD50\uC7A5\uCD94\uCC9C \uD544\uC694 \uC804\uD615\uB9CC, false: \uCD94\uCC9C \uC5C6\uB294 \uC804\uD615\uB9CC" },
        graduates_allowed: { type: "boolean", description: "true: \uC878\uC5C5\uC0DD\uB3C4 \uC9C0\uC6D0 \uAC00\uB2A5\uD55C \uC804\uD615\uB9CC(\uC7AC\uD559\uC0DD \uC804\uC6A9 \uC81C\uC678)" },
        gun: { type: "array", items: { type: "string", enum: ["\uAC00", "\uB098", "\uB2E4"] }, description: "\uC815\uC2DC \uAD70" },
        keyword: { type: "string", description: "\uC804\uD615\uBA85\xB7\uBAA8\uC9D1\uB2E8\uC704\xB7\uC804\uD615\uBC29\uBC95\xB7\uC9C0\uC6D0\uC790\uACA9\xB7\uBE44\uACE0\uC5D0\uC11C \uCC3E\uC744 \uB9D0(\uC608: \uBA74\uC811, \uAD50\uACFC\uC6B0\uC218, \uC9C0\uC5ED\uADE0\uD615)" },
        exclude_medical_only: { type: "boolean", description: "\uC758\xB7\uCE58\xB7\uD55C\xB7\uC57D\xB7\uC218\uC758\xB7\uAC04\uD638 \uD559\uACFC\uB9CC \uBAA8\uC9D1\uD558\uB294 \uC804\uD615 \uC81C\uC678" },
        exclude_regional_talent: { type: "boolean", description: "\uC9C0\uC5ED\uC778\uC7AC\xB7\uC9C0\uC5ED\uC758\uC0AC \uC804\uD615 \uC81C\uC678(\uC9C0\uC5ED\uADE0\uD615\uC740 \uB0A8\uAE40)" },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "\uCD5C\uB300 \uACB0\uACFC \uC218(\uAE30\uBCF8 30)" }
      }
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const us = arr(a.universities).map((n) => findUniv(data, n)).filter(Boolean);
      const out = [];
      for (const u of us.length ? us : data.universities) {
        if (arr(a.region).length && !arr(a.region).includes(u.rg)) continue;
        if (arr(a.group).length && !arr(a.group).includes(u.g)) continue;
        for (const r of u.rows) {
          if (arr(a.track).length && !arr(a.track).includes(r.track)) continue;
          if (a.csat_min === "\uC788\uC74C" && r.min_flag === "\uC5C6\uC74C") continue;
          if (a.csat_min === "\uC5C6\uC74C" && r.min_flag !== "\uC5C6\uC74C") continue;
          if (a.interview && r.interview !== a.interview) continue;
          if (a.school_recommendation === true && !/추천/.test(r.recommend || "")) continue;
          if (a.school_recommendation === false && /추천/.test(r.recommend || "")) continue;
          if (a.graduates_allowed === true && r.elig === "\uC7AC\uD559\uC0DD") continue;
          if (arr(a.gun).length && !arr(a.gun).includes(r.gun)) continue;
          if (a.exclude_medical_only && isMed(r)) continue;
          if (a.exclude_regional_talent && isReg(r)) continue;
          if (a.keyword && ![r.name, r.dept, r.method, r.elig_text, r.note, r.min_text].some((x) => has(x, a.keyword))) continue;
          out.push(brief(u, r));
        }
      }
      const missing = arr(a.universities).filter((n) => !findUniv(data, n));
      return { ...missing.length ? { \uCC3E\uC9C0\uBABB\uD55C\uB300\uD559: missing } : {}, ...page(out, a.limit) };
    }
  },
  {
    name: "get_university",
    title: "\uB300\uD559 \uC0C1\uC138",
    description: "\uD55C \uB300\uD559\uC758 2028 \uC815\uC6D0 \uB0B4 \uC804\uD615 \uC804\uCCB4(\uC804\uD615\uBC29\uBC95\xB7\uC218\uB2A5\uCD5C\uC800\xB7\uC9C0\uC6D0\uC790\uACA9\xB7\uBC18\uC601 \uACFC\uBAA9\xB7\uC815\uC2DC \uBC18\uC601 \uC601\uC5ED \uB4F1), \uBAA8\uC9D1\uC778\uC6D0 \uD569\uACC4, 2028 \uC8FC\uC694 \uBCC0\uACBD, \uBE44\uACE0(\uC81C\uC678 \uC804\uD615\xB7\uC815\uC6D0 \uC678), \uC6D0\uBB38 PDF\uB97C \uB3CC\uB824\uC90D\uB2C8\uB2E4.",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "\uB300\uD559\uBA85(\uC608: \uC544\uC8FC\uB300, \uD55C\uC591\uB300ERICA)" } }, required: ["name"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const u = findUniv(data, a.name);
      if (!u) return { \uC624\uB958: `'${a.name}' \uB300\uD559\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.`, \uC218\uB85D\uB300\uD559: data.universities.map((x) => x.u) };
      return clean({
        \uB300\uD559: u.u,
        \uC9C0\uC5ED: u.rg,
        \uAD6C\uBD84: GNAME[u.g] || u.g,
        \uBAA8\uC9D1\uC778\uC6D0: u.tot && { \uC218\uC2DC\uC815\uC6D0\uB0B4: u.tot.susi_in, \uC815\uC2DC\uC815\uC6D0\uB0B4: u.tot.jeongsi_in, \uD569\uACC4: u.tot.total_in },
        \uC6D0\uBB38: u.ft,
        \uC6D0\uBB38PDF: pdf(u),
        "2028\uC8FC\uC694\uBCC0\uACBD": (u.ch || []).map((c) => `${c.t} [${(c.c || []).join(", ")}]`),
        \uC804\uD615: u.rows.map((r) => detail(u, r)),
        \uB18D\uC5B4\uCD0C: u.rur ? `${u.rur.length}\uAC1C \uC804\uD615(find_rural \uB3C4\uAD6C\uB85C \uC870\uD68C)${u.rur_note ? " \xB7 " + u.rur_note : ""}` : "\uC218\uC9D1 \uC804",
        \uBE44\uACE0: u.notes
      });
    }
  },
  {
    name: "list_changes",
    title: "2028 \uBCC0\uACBD\uC0AC\uD56D",
    description: "\uB300\uD559\uBCC4 2028\uD559\uB144\uB3C4 \uC8FC\uC694 \uBCC0\uACBD(\uC804\uB144 \uB300\uBE44)\uC744 \uBD84\uB958\uBCC4\uB85C \uCC3E\uC2B5\uB2C8\uB2E4. \uBD84\uB958: " + CATS.join(", "),
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "array", items: { type: "string", enum: CATS }, description: "\uBCC0\uACBD \uBD84\uB958" },
        universities: { type: "array", items: { type: "string" } },
        region: { type: "array", items: { type: "string", enum: REGIONS } },
        keyword: { type: "string", description: "\uBCC0\uACBD \uB0B4\uC6A9\uC5D0\uC11C \uCC3E\uC744 \uB9D0(\uC608: \uD3D0\uC9C0, \uC2E0\uC124, \uC644\uD654)" },
        limit: { type: "integer", minimum: 1, maximum: 100 }
      }
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const us = arr(a.universities).map((n) => findUniv(data, n)).filter(Boolean);
      const out = [];
      for (const u of us.length ? us : data.universities) {
        if (arr(a.region).length && !arr(a.region).includes(u.rg)) continue;
        for (const c of u.ch || []) {
          if (arr(a.category).length && !(c.c || []).some((x) => arr(a.category).includes(x))) continue;
          if (a.keyword && !has(c.t, a.keyword)) continue;
          out.push({ \uB300\uD559: u.u, \uC9C0\uC5ED: u.rg, \uBCC0\uACBD: c.t, \uBD84\uB958: c.c, \uC6D0\uBB38PDF: pdf(u) });
        }
      }
      return page(out, a.limit || 50);
    }
  },
  {
    name: "find_rural",
    title: "\uB18D\uC5B4\uCD0C \uC804\uD615",
    description: "\uB18D\uC5B4\uCD0C \uC790\uACA9\uC774 \uC9C0\uC6D0\uC790\uACA9\uC5D0 \uBA85\uC2DC\uB41C \uC804\uD615(\uC804\uC6A9, \uB610\uB294 \uAE30\uD68C\uADE0\uD615\xB7\uACE0\uB978\uAE30\uD68C\uCC98\uB7FC \uC5EC\uB7EC \uB300\uC0C1 \uC911 \uD558\uB098\uB85C \uD3EC\uD568)\uC744 \uCC3E\uC2B5\uB2C8\uB2E4. \uC815\uC6D0 \uB0B4\xB7\uC678, 6\uB144/12\uB144 \uC790\uACA9, \uC218\uC2DC \uBBF8\uCDA9\uC6D0 \uC774\uC6D4 \uC5EC\uBD80\uAC00 \uD568\uAED8 \uB098\uC635\uB2C8\uB2E4.",
    inputSchema: {
      type: "object",
      properties: {
        universities: { type: "array", items: { type: "string" } },
        region: { type: "array", items: { type: "string", enum: REGIONS } },
        track: { type: "array", items: { type: "string", enum: TRACKS } },
        audience: { type: "string", enum: ["\uC804\uC6A9", "\uD3EC\uD568"], description: "\uC804\uC6A9: \uB18D\uC5B4\uCD0C\uB9CC \uB300\uC0C1, \uD3EC\uD568: \uC5EC\uB7EC \uB300\uC0C1 \uC911 \uD558\uB098" },
        quota_type: { type: "string", enum: ["\uC678", "\uB0B4"], description: "\uC815\uC6D0 \uC678/\uB0B4" },
        qualification: { type: "string", enum: ["6\uB144", "12\uB144"], description: "\uC774 \uC790\uACA9\uC73C\uB85C \uC9C0\uC6D0 \uAC00\uB2A5\uD55C \uC804\uD615\uB9CC" },
        limit: { type: "integer", minimum: 1, maximum: 100 }
      }
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const us = arr(a.universities).map((n) => findUniv(data, n)).filter(Boolean);
      const out = [], none = [];
      for (const u of us.length ? us : data.universities) {
        if (arr(a.region).length && !arr(a.region).includes(u.rg)) continue;
        if (!u.rur) {
          none.push(u.u);
          continue;
        }
        for (const r of u.rur) {
          if (arr(a.track).length && !arr(a.track).includes(r.track)) continue;
          if (a.audience && r.aud !== a.audience) continue;
          if (a.quota_type && r.cap !== a.quota_type) continue;
          if (a.qualification && !(r.rq || "").includes(a.qualification)) continue;
          out.push(rurRow(u, r));
        }
      }
      return { ...none.length ? { \uB18D\uC5B4\uCD0C\uC218\uC9D1\uC804: none } : {}, ...page(out, a.limit) };
    }
  },
  {
    name: "get_source",
    title: "\uC6D0\uBB38 \uCC3E\uAE30",
    description: "\uC804\uD615\uC758 \uADFC\uAC70\uAC00 \uB418\uB294 \uC6D0\uBB38 PDF \uB9C1\uD06C\uC640 \uCABD\uC218\uB97C \uB3CC\uB824\uC90D\uB2C8\uB2E4. \uCABD\uC218\uB294 PDF \uBDF0\uC5B4\uC758 \uCABD \uBC88\uD638 \uAE30\uC900\uC785\uB2C8\uB2E4(\uC778\uC1C4\uB41C \uCABD \uBC88\uD638\uC640 \uB2E4\uB97C \uC218 \uC788\uC74C).",
    inputSchema: {
      type: "object",
      properties: { university: { type: "string" }, admission: { type: "string", description: "\uC804\uD615\uBA85 \uC77C\uBD80(\uBE44\uC6B0\uBA74 \uB300\uD559\uC758 \uC6D0\uBB38 PDF \uBAA9\uB85D)" } },
      required: ["university"]
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data, a) {
      const u = findUniv(data, a.university);
      if (!u) return { \uC624\uB958: `'${a.university}' \uB300\uD559\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.` };
      const rows = [...u.rows, ...u.rur || []].filter((r) => !a.admission || has(r.name, a.admission));
      const files = [[u.fid, u.ft], ...u.rows.filter((r) => r.fid && r.fid !== u.fid).map((r) => [r.fid, r.ft])].filter((x, i, L) => L.findIndex((y) => y[0] === x[0]) === i).map(([f, t]) => ({ \uD30C\uC77C: t, PDF: `https://drive.google.com/file/d/${f}/view` }));
      return { \uB300\uD559: u.u, \uC6D0\uBB38\uD30C\uC77C: files, \uC804\uD615: rows.map((r) => clean({ \uC804\uD615\uBA85: r.name, \uCEA0\uD37C\uC2A4: r.campus, ...src(u, r) })) };
    }
  },
  {
    name: "data_info",
    title: "\uB370\uC774\uD130 \uC548\uB0B4",
    description: "\uB370\uC774\uD130 \uBC84\uC804\xB7\uAC31\uC2E0 \uC2DC\uAC01\xB7\uCD9C\uCC98\xB7\uB77C\uC774\uC120\uC2A4\uC640 \uC218\uB85D \uB300\uD559 \uBAA9\uB85D(\uC9C0\uC5ED\xB7\uAD6C\uBD84)\uC744 \uB3CC\uB824\uC90D\uB2C8\uB2E4. \uC218\uB85D \uBC94\uC704\uB97C \uBB3B\uAC70\uB098 \uB300\uD559 \uC774\uB984\uC744 \uD655\uC778\uD560 \uB54C \uC501\uB2C8\uB2E4.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run(data) {
      return { ...data.meta, \uC218\uB85D\uB300\uD559: data.universities.map((u) => ({ \uB300\uD559: u.u, \uC9C0\uC5ED: u.rg, \uAD6C\uBD84: GNAME[u.g] || u.g })) };
    }
  }
];
var PROMPTS = [
  {
    name: "consult_prep",
    title: "\uC0C1\uB2F4 \uC900\uBE44\uD45C",
    description: "\uD559\uC0DD \uC870\uAC74(\uC775\uBA85)\uC5D0 \uB9DE\uB294 \uC9C0\uC6D0 \uAC00\uB2A5 \uC804\uD615 \uD6C4\uBCF4\uD45C\uB97C \uB9CC\uB4ED\uB2C8\uB2E4.",
    arguments: [
      { name: "condition", description: "\uD559\uC0DD \uC870\uAC74(\uC608: \uAD50\uACFC \uC704\uC8FC, \uC218\uB2A5 2\uAC1C \uD569 7 \uAC00\uB2A5, \uC218\uB3C4\uAD8C, \uBA74\uC811 \uBD80\uB2F4)", required: true },
      { name: "tracks", description: "\uBCFC \uC804\uD615 \uC885\uB958(\uC608: \uAD50\uACFC, \uC885\uD569)", required: false }
    ],
    text: /* @__PURE__ */ __name((a) => `\uB2E4\uC74C \uC870\uAC74\uC758 \uD559\uC0DD\uC744 \uC704\uD55C 2028\uD559\uB144\uB3C4 \uC218\uC2DC\xB7\uC815\uC2DC \uC9C0\uC6D0 \uD6C4\uBCF4\uD45C\uB97C \uB9CC\uB4E4\uC5B4 \uC8FC\uC138\uC694. \uD559\uC0DD \uAC1C\uC778\uC815\uBCF4\uB294 \uC5C6\uC2B5\uB2C8\uB2E4.
\uC870\uAC74: ${a.condition}${a.tracks ? `
\uBCFC \uC804\uD615: ${a.tracks}` : ""}
search_admissions \uB3C4\uAD6C\uB85C \uC870\uAC74\uC5D0 \uB9DE\uB294 \uC804\uD615\uC744 \uCC3E\uACE0, \uB300\uD559\xB7\uC804\uD615\uBA85\xB7\uBAA8\uC9D1\uC778\uC6D0\xB7\uC804\uD615\uBC29\uBC95\xB7\uC218\uB2A5\uCD5C\uC800\xB7\uBA74\uC811\xB7\uC6D0\uBB38 \uCABD\uC744 \uD45C\uB85C \uC815\uB9AC\uD558\uC138\uC694. \uC218\uB2A5\uCD5C\uC800 \uAE30\uC900\uBCC4\uB85C \uBB36\uACE0, \uC785\uC2DC \uACB0\uACFC\uB294 \uC5C6\uC73C\uB2C8 \uD569\uACA9 \uAC00\uB2A5\uC131\uC740 \uD310\uB2E8\uD558\uC9C0 \uB9D0\uACE0 \uD655\uC778\uD560 \uC810\uB9CC \uC801\uC5B4 \uC8FC\uC138\uC694.`, "text")
  },
  {
    name: "change_notice",
    title: "2028 \uBCC0\uACBD\uC0AC\uD56D \uC548\uB0B4\uBB38",
    description: "\uD559\uBD80\uBAA8\xB7\uD559\uC0DD\uC6A9 2028 \uB300\uC785 \uBCC0\uACBD\uC0AC\uD56D \uC548\uB0B4\uBB38 \uCD08\uC548\uC744 \uB9CC\uB4ED\uB2C8\uB2E4.",
    arguments: [
      { name: "audience", description: "\uC77D\uC744 \uC0AC\uB78C(\uC608: \uACE01 \uD559\uBD80\uBAA8)", required: true },
      { name: "focus", description: "\uB2E4\uB8F0 \uBC94\uC704(\uC608: \uACBD\uAE30 \uC9C0\uC5ED \uB300\uD559, \uC218\uB2A5\uCD5C\uC800, \uC11C\uC6B8 \uC8FC\uC694 \uB300\uD559)", required: false }
    ],
    text: /* @__PURE__ */ __name((a) => `${a.audience}\uC5D0\uAC8C \uBCF4\uB0BC 2028\uD559\uB144\uB3C4 \uB300\uC785\uC804\uD615 \uBCC0\uACBD\uC0AC\uD56D \uC548\uB0B4\uBB38 \uCD08\uC548\uC744 \uC368 \uC8FC\uC138\uC694.${a.focus ? ` \uBC94\uC704: ${a.focus}.` : ""}
list_changes \uB3C4\uAD6C\uB85C \uBCC0\uACBD\uC0AC\uD56D\uC744 \uCC3E\uC544 \uBD84\uB958(\uC218\uB2A5\uCD5C\uC800\xB7\uBAA8\uC9D1\uC778\uC6D0\xB7\uBA74\uC811\xB7\uBC18\uC601\uBE44\uC728 \uB4F1)\uBCC4\uB85C \uC26C\uC6B4 \uB9D0\uB85C \uC815\uB9AC\uD558\uACE0, \uB300\uD559\uBCC4 \uC608\uC2DC\uB97C 2~3\uAC1C\uC529 \uB4DC\uC138\uC694. \uB05D\uC5D0 '\uC2DC\uD589\uACC4\uD68D \uAE30\uC900\uC774\uBA70 \uCD5C\uC885 \uB0B4\uC6A9\uC740 \uAC01 \uB300\uD559 \uBAA8\uC9D1\uC694\uAC15\uC73C\uB85C \uD655\uC778' \uBB38\uAD6C\uB97C \uB123\uC73C\uC138\uC694.`, "text")
  }
];
var ok = /* @__PURE__ */ __name((id, result) => ({ jsonrpc: "2.0", id, result }), "ok");
var fail = /* @__PURE__ */ __name((id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), "fail");
async function rpc(msg, getData) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(msg && msg.id, -32600, "Invalid Request");
  const { id, method, params = {} } = msg;
  if (id === void 0) return null;
  switch (method) {
    case "initialize": {
      const v = PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
      return ok(id, { protocolVersion: v, capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS.map(({ run, ...t }) => t) });
    case "tools/call": {
      const t = TOOLS.find((x) => x.name === params.name);
      if (!t) return fail(id, -32602, `Unknown tool: ${params.name}`);
      try {
        const res = t.run(await getData(), params.arguments || {});
        return ok(id, { content: [{ type: "text", text: JSON.stringify(res) }], isError: !!res.\uC624\uB958 });
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: `\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4: ${e.message}` }], isError: true });
      }
    }
    case "prompts/list":
      return ok(id, { prompts: PROMPTS.map(({ text, ...p }) => p) });
    case "prompts/get": {
      const p = PROMPTS.find((x) => x.name === params.name);
      if (!p) return fail(id, -32602, `Unknown prompt: ${params.name}`);
      const a = params.arguments || {};
      const miss = p.arguments.filter((x) => x.required && !a[x.name]).map((x) => x.name);
      if (miss.length) return fail(id, -32602, `Missing arguments: ${miss.join(", ")}`);
      return ok(id, { description: p.description, messages: [{ role: "user", content: { type: "text", text: p.text(a) } }] });
    }
    default:
      return fail(id, -32601, `Method not found: ${method}`);
  }
}
__name(rpc, "rpc");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id"
};
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } }), "json");
async function handle(request, getData) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (url.pathname === "/" && request.method === "GET") {
    return new Response(`${SERVER.title} MCP \uC11C\uBC84 (v${SERVER.version})

Claude \uC124\uC815 \u203A \uCEE4\uB125\uD130 \u203A \uC0AC\uC6A9\uC790 \uC9C0\uC815 \uCEE4\uB125\uD130 \uCD94\uAC00\uC5D0 \uC544\uB798 \uC8FC\uC18C\uB97C \uB123\uC73C\uC138\uC694.
${url.origin}/mcp

\uB300\uC2DC\uBCF4\uB4DC: https://2023swhs3rd-a11y.github.io/2028plan/
`, { headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS } });
  }
  if (url.pathname !== "/mcp") return new Response("Not Found", { status: 404, headers: CORS });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST", ...CORS } });
  let body;
  try {
    body = await request.json();
  } catch {
    return json(fail(null, -32700, "Parse error"), 400);
  }
  if (Array.isArray(body)) {
    const res2 = (await Promise.all(body.map((m) => rpc(m, getData)))).filter(Boolean);
    return res2.length ? json(res2) : new Response(null, { status: 202, headers: CORS });
  }
  const res = await rpc(body, getData);
  return res ? json(res) : new Response(null, { status: 202, headers: CORS });
}
__name(handle, "handle");

// src/worker.js
var DEFAULT_DATA_URL = "https://2023swhs3rd-a11y.github.io/2028plan/data.json";
var TTL = 10 * 60 * 1e3;
var cache = { at: 0, data: null };
async function loadData(env) {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data;
  const res = await fetch(env.DATA_URL || DEFAULT_DATA_URL, { cf: { cacheTtl: 600 } });
  if (!res.ok) {
    if (cache.data) return cache.data;
    throw new Error(`data.json HTTP ${res.status}`);
  }
  cache = { at: Date.now(), data: await res.json() };
  return cache.data;
}
__name(loadData, "loadData");
var worker_default = {
  fetch: /* @__PURE__ */ __name((request, env) => handle(request, () => loadData(env)), "fetch")
};

// ../../../../tmp/claude-0/-home-claude-2028plan/66163a95-850e-5cd0-b3df-9283d51fd2bf/scratchpad/mcpt/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../tmp/claude-0/-home-claude-2028plan/66163a95-850e-5cd0-b3df-9283d51fd2bf/scratchpad/mcpt/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-K51Z6E/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../tmp/claude-0/-home-claude-2028plan/66163a95-850e-5cd0-b3df-9283d51fd2bf/scratchpad/mcpt/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-K51Z6E/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
