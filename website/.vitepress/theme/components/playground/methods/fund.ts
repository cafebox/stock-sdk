/**
 * 公募基金扩展数据演示（v1.10.0+）
 *
 * 4 个方法承载在 FundService 上：分红 / 历史净值 / 实时估值 / 同类排名。
 * 数据源为东方财富 / 天天基金；浏览器端走 <script> 注入加载（无 CORS 头），
 * 并发由 SDK 内部 withScriptMutex 串行化保护。
 */
import type { MethodSpec } from '../types';
import { jsStr } from '../utils';

export const fundMethods: MethodSpec[] = [
  // ---- 主题基金 (v2) ----
  {
    name: 'getThemeList',
    desc: '获取全部主题基金列表（行业/概念分类）',
    category: 'fund',
    market: ['fund'],
    params: [
      {
        key: 'category',
        label: '分类',
        type: 'select',
        default: '2',
        options: [
          { label: '全部', value: '2' },
          { label: '行业', value: '0' },
          { label: '概念', value: '1' },
        ],
      },
    ],
    code: (p) => {
      const opts: string[] = [];
      if (p.category && p.category !== '2') {
        opts.push(`category: ${p.category}`);
      }
      return `const list = await sdk.fund.getThemeList(${opts.length ? `{ ${opts.join(', ')} }` : ''});
console.log('total themes:', list.items.length);
list.items.slice(0, 10).forEach(t => {
  console.log(\`\${t.code} \${t.name}  近1周: \${t.weeklyReturn}%  近1月: \${t.monthlyReturn}%  近1年: \${t.yearlyReturn}%\`);
});`;
    },
    run: (sdk, params) => {
      const opts: Record<string, unknown> = {};
      if (params.category && params.category !== '2') {
        opts.category = Number(params.category) as 0 | 1;
      }
      return sdk.fund.getThemeList(opts);
    },
  },
  {
    name: 'getHotThemes',
    desc: '获取热门主题排行（按涨跌幅/收益率排序）',
    category: 'fund',
    market: ['fund'],
    params: [
      {
        key: 'sort',
        label: '排序字段',
        type: 'select',
        default: 'ZDF',
        options: [
          { label: '日涨幅 (ZDF)', value: 'ZDF' },
          { label: '近1周 (SYL_W)', value: 'SYL_W' },
          { label: '近1月 (SYL_M)', value: 'SYL_M' },
          { label: '近3月 (SYL_3M)', value: 'SYL_3M' },
          { label: '近1年 (SYL_1N)', value: 'SYL_1N' },
        ],
      },
    ],
    code: (p) => `const list = await sdk.fund.getHotThemes(${(p.sort && p.sort !== 'ZDF') ? `{ sort: '${p.sort}' }` : ''});
console.log('hot themes:', list.items.length);
list.items.slice(0, 5).forEach(t => {
  console.log(\`\${t.name}  日涨幅: \${t.dailyReturn}%  近1周: \${t.weeklyReturn}%\`);
});`,
    run: (sdk, params) => {
      const opts: Record<string, unknown> = {};
      if (params.sort) opts.sort = params.sort;
      return sdk.fund.getHotThemes(opts);
    },
  },
  {
    name: 'getThemeFunds',
    desc: '获取指定主题下的基金列表（含各阶段收益率）',
    category: 'fund',
    market: ['fund'],
    params: [
      {
        key: 'themeCode',
        label: '主题代码',
        type: 'text',
        default: 'BK0438',
        required: true,
        placeholder: '如 BK0438（食品饮料）',
      },
      {
        key: 'sort',
        label: '排序字段',
        type: 'select',
        default: 'SYL_1N',
        options: [
          { label: '近1周 (SYL_Z)', value: 'SYL_Z' },
          { label: '近1月 (SYL_Y)', value: 'SYL_Y' },
          { label: '近3月 (SYL_3Y)', value: 'SYL_3Y' },
          { label: '近1年 (SYL_1N)', value: 'SYL_1N' },
          { label: '日涨幅 (RZDF)', value: 'RZDF' },
        ],
      },
      {
        key: 'pageSize',
        label: '每页条数',
        type: 'number',
        default: '10',
        placeholder: '最大 30',
      },
    ],
    code: (p) => `const list = await sdk.fund.getThemeFunds('${p.themeCode || 'BK0438'}', {
  sortColumn: '${p.sort || 'SYL_1N'}',
  pageSize: ${p.pageSize || 10},
});
console.log('funds in theme:', list.items.length);
list.items.slice(0, 5).forEach(f => {
  console.log(\`\${f.code} \${f.name}  近1年: \${f.yearlyReturn}%  日涨幅: \${f.dailyReturn}%\`);
});`,
    run: (sdk, params) => {
      const opts: Record<string, unknown> = {
        sortColumn: params.sort || 'SYL_1N',
        pageSize: params.pageSize ? Number(params.pageSize) : 10,
      };
      return sdk.fund.getThemeFunds(params.themeCode || 'BK0438', opts);
    },
  },
  // ---- 基金扩展数据 (v1.10.0+) ----
  {
    name: 'getFundDividendList',
    desc: '基金 / ETF 分红明细（按年份分页，可按代码过滤）',
    category: 'fund',
    market: ['fund'],
    params: [
      {
        key: 'year',
        label: '年份',
        type: 'number',
        default: '2024',
        required: true,
        placeholder: '如 2024',
      },
      {
        key: 'page',
        label: '页码',
        type: 'text',
        default: '1',
        placeholder: "数字或 'all'（全部页面聚合）",
      },
      {
        key: 'code',
        label: '基金代码（可选过滤）',
        type: 'text',
        default: '',
        placeholder: '如 110011；留空查全市场',
      },
    ],
    code: (p) => {
      const opts: string[] = [`year: ${p.year || '2024'}`];
      if (p.page && p.page !== '1') {
        opts.push(p.page === 'all' ? `page: 'all'` : `page: ${p.page}`);
      }
      if (p.code) opts.push(`code: ${jsStr(p.code)}`);
      return `const r = await sdk.getFundDividendList({ ${opts.join(', ')} });
console.log('total pages:', r.totalPages, 'page size:', r.pageSize);
console.log('items:', r.items.length);
console.log(r.items[0]);
// { code, name, equityRecordDate, exDividendDate, dividendPerShare, payDate, raw }`;
    },
    run: (sdk, params) => {
      const opts: Record<string, unknown> = {
        year: params.year ? Number(params.year) : new Date().getFullYear(),
      };
      if (params.page === 'all') opts.page = 'all';
      else if (params.page && params.page !== '1') {
        opts.page = Number(params.page);
      }
      if (params.code) opts.code = params.code;
      return sdk.getFundDividendList(opts);
    },
  },
  {
    name: 'getFundNavHistory',
    desc: '基金历史净值（单位 + 累计，一次返回全历史）',
    category: 'fund',
    market: ['fund'],
    params: [
      {
        key: 'code',
        label: '基金代码',
        type: 'text',
        default: '110011',
        required: true,
        placeholder: '如 110011（易方达优质精选）',
      },
    ],
    code: (p) => `const h = await sdk.getFundNavHistory(${jsStr(p.code)});
console.log(h.name, '共', h.items.length, '条净值');
const latest = h.items[h.items.length - 1];
console.log('最新:', latest.date, '单位', latest.nav, '累计', latest.accNav);
console.log('最近 5 条:', h.items.slice(-5));`,
    run: (sdk, params) => sdk.getFundNavHistory(params.code),
  },
  {
    name: 'getFundEstimate',
    desc: '基金当日实时估值（含 T-1 净值 + 盘中估算）',
    category: 'fund',
    market: ['fund'],
    params: [
      {
        key: 'code',
        label: '基金代码',
        type: 'text',
        default: '005827',
        required: true,
        placeholder: '如 005827（易方达蓝筹精选）',
      },
    ],
    code: (p) => `const e = await sdk.getFundEstimate(${jsStr(p.code)});
console.log(e.name);
console.log('最新已结净值:', e.nav, '（', e.navDate, '）');
console.log('盘中估算:', e.estimatedNav, '（', e.estimatedChangePercent, '%）');
console.log('估算时间:', e.estimateTime);`,
    run: (sdk, params) => sdk.getFundEstimate(params.code),
  },
  {
    name: 'getFundRankHistory',
    desc: '基金同类排名走势（每日近三月排名 + 百分位）',
    category: 'fund',
    market: ['fund'],
    params: [
      {
        key: 'code',
        label: '基金代码',
        type: 'text',
        default: '110011',
        required: true,
        placeholder: '如 110011',
      },
    ],
    code: (p) => `const r = await sdk.getFundRankHistory(${jsStr(p.code)});
console.log(r.name, '共', r.items.length, '个报告点');
const latest = r.items[r.items.length - 1];
console.log(\`最新: \${latest.date}  排名 \${latest.rank}/\${latest.total}  百分位 \${latest.percentile}%\`);`,
    run: (sdk, params) => sdk.getFundRankHistory(params.code),
  },
];
