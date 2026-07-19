"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  AlertTriangle, ArrowRight, Bot, Box, Building2, CheckCircle2, ChevronRight,
  CircleDot, ClipboardCheck, Clock3, Database, FileWarning, Gauge, History,
  LayoutDashboard, ListChecks, Loader2, Menu, PackageCheck, Play, RefreshCcw,
  RotateCcw, Route, Search, Send, Settings2, ShieldAlert, Sparkles, Store,
  TimerReset, UserCog, Users, Wrench, X, XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

type Role = "store" | "manager" | "supplier" | "admin";
type Entity = Record<string, any>;
type Bootstrap = {
  stores: Entity[];
  assets: Entity[];
  parties: Entity[];
  rules: Entity[];
  faults: Entity[];
  orders: Entity[];
  notifications: Entity[];
  generatedAt: string;
};

const roleMeta: Record<Role, { label: string; short: string; icon: typeof Store; home: string }> = {
  store: { label: "门店人员", short: "门店", icon: Store, home: "/store/orders" },
  manager: { label: "维修管理人员", short: "维修管理", icon: UserCog, home: "/manager" },
  supplier: { label: "供应商 / 工程师", short: "供应商", icon: Wrench, home: "/supplier" },
  admin: { label: "运营管理员", short: "运营", icon: LayoutDashboard, home: "/admin" },
};

const nav: Record<Role, { href: string; label: string; icon: typeof Store }[]> = {
  store: [
    { href: "/store/report", label: "发起报修", icon: Send },
    { href: "/store/orders", label: "我的工单", icon: ListChecks },
    { href: "/store/supplements", label: "待补充", icon: FileWarning },
    { href: "/store/acceptance", label: "待验收", icon: ClipboardCheck },
  ],
  manager: [
    { href: "/manager", label: "维修工作台", icon: Gauge },
    { href: "/manager/review", label: "人工复核", icon: UserCog },
    { href: "/manager/exceptions", label: "异常升级", icon: AlertTriangle },
    { href: "/manager/orders", label: "全部工单", icon: ListChecks },
  ],
  supplier: [
    { href: "/supplier", label: "任务中心", icon: Gauge },
    { href: "/supplier/orders", label: "我的任务", icon: Wrench },
  ],
  admin: [
    { href: "/admin", label: "运营看板", icon: LayoutDashboard },
    { href: "/admin/stores", label: "模拟门店", icon: Building2 },
    { href: "/admin/assets", label: "模拟设备", icon: Box },
    { href: "/admin/parties", label: "模拟责任方", icon: Users },
    { href: "/admin/rules", label: "路由规则", icon: Route },
    { href: "/admin/demo-control", label: "Demo 控制台", icon: Settings2 },
  ],
};

const statusTone: Record<string, string> = {
  待判断: "blue", 待补充: "amber", 待人工确认: "purple", 待接单: "blue",
  超时未接单: "red", 处理中: "green", 待验收: "amber", 返修中: "red",
  已关闭: "gray", 已取消: "gray",
};

function jsonList(value: string | undefined) {
  try { return JSON.parse(value || "[]") as string[]; } catch { return []; }
}

function jsonArray<T>(value: string | undefined) {
  try { return JSON.parse(value || "[]") as T[]; } catch { return []; }
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function Tag({ children, tone = "gray" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

function DemoTag() {
  return <span className="demo-tag">Demo 模拟</span>;
}

function Empty({ icon: Icon = Search, title, text }: { icon?: typeof Search; title: string; text: string }) {
  return <div className="empty"><Icon size={30} /><h3>{title}</h3><p>{text}</p></div>;
}

function Skeleton() {
  return <div className="loading-page"><div className="loading-mark"><Loader2 className="spin" /><span>正在载入 Demo 模拟数据…</span></div></div>;
}

function Countdown({ deadline, acceptedAt, status }: { deadline?: string | null; acceptedAt?: string | null; status: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!deadline || acceptedAt || status !== "待接单") return <span className="muted">SLA 已停止</span>;
  const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  const minute = String(Math.floor(seconds / 60)).padStart(2, "0");
  const second = String(seconds % 60).padStart(2, "0");
  return <span className={`countdown ${seconds <= 30 ? "danger" : ""}`}><Clock3 size={15} /> {minute}:{second}</span>;
}

function Kpi({ label, value, note, tone = "neutral", icon: Icon }: { label: string; value: number | string; note: string; tone?: string; icon: typeof Store }) {
  return <div className={`kpi kpi-${tone}`}><div className="kpi-top"><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small>{note}</small></div>;
}

function OrderCard({ order, onOpen, compact = false }: { order: Entity; onOpen: (id: string) => void; compact?: boolean }) {
  return (
    <article className={`order-card ${compact ? "compact" : ""}`} onClick={() => onOpen(order.id)}>
      <div className="order-head">
        <div><span className="eyebrow">{order.code}</span><h3>{order.faultEvent.aiSummary || order.faultEvent.originalDescription}</h3></div>
        <div className="tag-row"><Tag tone={order.finalPriority === "P1" ? "red" : order.finalPriority === "P2" ? "amber" : "gray"}>{order.finalPriority}</Tag><Tag tone={statusTone[order.status]}>{order.status}</Tag></div>
      </div>
      <div className="order-meta">
        <span><Store size={15} />{order.faultEvent.store.name}</span>
        <span><Box size={15} />{order.asset.code}</span>
        <span><Users size={15} />{order.finalParty?.name ?? "待人工定责"}</span>
      </div>
      <div className="order-foot">
        <Countdown deadline={order.acceptanceDeadline} acceptedAt={order.acceptedAt} status={order.status} />
        <span>查看详情 <ChevronRight size={14} /></span>
      </div>
    </article>
  );
}

export default function AppShell() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role>(() => {
    if (pathname.startsWith("/manager")) return "manager";
    if (pathname.startsWith("/supplier")) return "supplier";
    if (pathname.startsWith("/admin")) return "admin";
    return "store";
  });
  const [supplierPartyId, setSupplierPartyId] = useState("party-a");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "数据加载失败");
    setData(payload);
  }, []);

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
    const timer = window.setInterval(() => load().catch(() => undefined), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const pathRole = pathname.startsWith("/manager")
      ? "manager"
      : pathname.startsWith("/supplier")
        ? "supplier"
        : pathname.startsWith("/admin")
          ? "admin"
          : pathname.startsWith("/store")
            ? "store"
            : null;
    const savedRole = window.localStorage.getItem("demo-role");
    const validRoles: Role[] = ["store", "manager", "supplier", "admin"];
    const nextRole = pathRole ?? (validRoles.includes(savedRole as Role) ? savedRole as Role : "store");
    setRole(nextRole);
    window.localStorage.setItem("demo-role", nextRole);
    const savedParty = window.localStorage.getItem("demo-supplier-party");
    if (savedParty) setSupplierPartyId(savedParty);
  }, [pathname]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const switchRole = (next: Role) => {
    setRole(next);
    window.localStorage.setItem("demo-role", next);
    router.push(roleMeta[next].home);
  };

  const switchSupplierParty = (partyId: string) => {
    setSupplierPartyId(partyId);
    window.localStorage.setItem("demo-supplier-party", partyId);
  };

  if (!data && !error) return <Skeleton />;
  if (error && !data) return <div className="fatal"><AlertTriangle /><h2>Demo 数据未就绪</h2><p>{error}</p><code>npm run demo:setup</code></div>;

  return (
    <div className="app">
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
      <header className="topbar">
        <button className="icon-button mobile-only" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu /></button>
        <Link href="/" className="brand">
          <span><strong>野人先生</strong><small>AI 设备维修协同中枢</small></span>
        </Link>
        <div className="topbar-actions">
          <Tag tone="purple"><Sparkles size={13} /> 本地确定性 AI</Tag>
          <span className="global-demo"><CircleDot size={12} /> DEMO MODE · 全部数据为模拟</span>
          <div className="role-switcher">
            {(Object.keys(roleMeta) as Role[]).map((item) => {
              const Icon = roleMeta[item].icon;
              return <button key={item} className={role === item ? "active" : ""} onClick={() => switchRole(item)} title={roleMeta[item].label}><Icon size={15} /><span>{roleMeta[item].short}</span></button>;
            })}
          </div>
        </div>
      </header>
      <div className="body">
        <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
          <button className="icon-button close-nav mobile-only" onClick={() => setMobileNav(false)}><X /></button>
          <div className="role-card">
            {(() => { const Icon = roleMeta[role].icon; return <Icon />; })()}
            <div><small>当前模拟角色</small><strong>{roleMeta[role].label}</strong></div>
          </div>
          <nav>
            {nav[role].map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileNav(false)} className={pathname === href ? "active" : ""}><Icon size={18} /><span>{label}</span></Link>)}
          </nav>
          <div className="sidebar-bottom">
            <Link href="/demo"><Play size={17} />演示场景中心</Link>
            <p>Demo 模拟 SLA<br />P1 60秒 · P2 120秒 · P3 300秒</p>
          </div>
        </aside>
        <main className="main">
          <div className="simulation-notice">当前系统使用模拟设备、供应商、SLA和工单数据，仅用于产品逻辑与技术链路验证，不代表野人先生现行制度或运营情况。</div>
          <PageRouter pathname={pathname} role={role} supplierPartyId={supplierPartyId} setSupplierPartyId={switchSupplierParty} data={data!} reload={load} notify={notify} navigate={router.push} />
        </main>
      </div>
    </div>
  );
}

function PageRouter({ pathname, role, supplierPartyId, setSupplierPartyId, data, reload, notify, navigate }: { pathname: string; role: Role; supplierPartyId: string; setSupplierPartyId: (id: string) => void; data: Bootstrap; reload: () => Promise<void>; notify: (m: string) => void; navigate: (href: string) => void }) {
  const common = { role, supplierPartyId, setSupplierPartyId, data, reload, notify, navigate };
  if (pathname === "/") return <Home {...common} />;
  if (pathname === "/demo") return <DemoCenter {...common} />;
  if (pathname.startsWith("/orders/")) return <OrderDetail id={pathname.split("/")[2]} {...common} />;
  if (pathname.startsWith("/supplier/orders/")) return <OrderDetail id={pathname.split("/")[3]} {...common} />;
  if (pathname.startsWith("/assets/")) return <AssetDetail id={pathname.split("/")[2]} {...common} />;
  if (pathname === "/store/report") return <ReportForm {...common} />;
  if (pathname === "/store/supplements") return <Supplements {...common} />;
  if (pathname === "/store/acceptance") return <OrderList title="待门店验收" subtitle="维修方已提交结果，请依据现场真实情况进行验收。" orders={data.orders.filter((o) => o.status === "待验收")} {...common} />;
  if (pathname === "/store/orders") return <OrderList title="我的维修工单" subtitle="查看光谷店的报修进度、责任方与下一步动作。" orders={data.orders.filter((o) => o.faultEvent.storeId === "store-001")} {...common} />;
  if (pathname === "/manager") return <ManagerDashboard {...common} />;
  if (pathname === "/manager/review") return <OrderList title="待人工复核" subtitle="原始事实、AI 建议和规则结果并排核对，人工决策必须留痕。" orders={data.orders.filter((o) => o.status === "待人工确认")} {...common} />;
  if (pathname === "/manager/exceptions") return <OrderList title="超时与异常" subtitle="优先处理超时、返修与责任异常工单。" orders={data.orders.filter((o) => ["超时未接单", "返修中"].includes(o.status))} {...common} />;
  if (pathname === "/manager/orders") return <OrderList title="全部维修工单" subtitle="跨门店查看 Demo 工单全生命周期。" orders={data.orders} {...common} />;
  if (pathname === "/supplier" || pathname === "/supplier/orders") return <SupplierBoard {...common} />;
  if (pathname === "/admin") return <AdminDashboard {...common} />;
  if (pathname === "/admin/stores") return <MasterTable type="stores" {...common} />;
  if (pathname === "/admin/assets") return <MasterTable type="assets" {...common} />;
  if (pathname === "/admin/parties") return <MasterTable type="parties" {...common} />;
  if (pathname === "/admin/rules") return <MasterTable type="rules" {...common} />;
  if (pathname === "/admin/demo-control") return <DemoControl {...common} />;
  return <Empty title="页面不存在" text="请从左侧导航选择一个 Demo 页面。" />;
}

type PageProps = { role: Role; supplierPartyId: string; setSupplierPartyId: (id: string) => void; data: Bootstrap; reload: () => Promise<void>; notify: (m: string) => void; navigate: (href: string) => void };

function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: React.ReactNode }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

function Home(props: PageProps) {
  const active = props.data.orders.filter((o) => !["已关闭", "已取消"].includes(o.status)).length;
  return <div className="home-page">
    <section className="hero">
      <div className="hero-copy">
        <div className="hero-kicker"><Bot size={17} /> AI 提取 · 规则定责 · 人工兜底</div>
        <h1>让每一次设备故障，<br /><em>都有清楚的下一步。</em></h1>
        <p>连接门店、维修管理与责任方，从原始报修到验收关闭，用同一张工单沉淀完整维修事实。</p>
        <div className="hero-actions"><button className="btn primary" onClick={() => props.navigate("/demo")}><Play size={17} />进入演示场景</button><button className="btn secondary" onClick={() => props.navigate("/store/report")}>发起一笔报修<ArrowRight size={17} /></button></div>
      </div>
      <div className="hero-panel">
        <div className="live-head"><span><span className="live-dot" />协同中枢实时概览</span><DemoTag /></div>
        <div className="hero-metrics"><div><strong>{active}</strong><span>活跃工单</span></div><div><strong>{props.data.orders.filter((o) => o.status === "待人工确认").length}</strong><span>待人工确认</span></div><div><strong>{props.data.orders.filter((o) => o.status === "超时未接单").length}</strong><span>超时升级</span></div></div>
        {props.data.orders.slice(0, 3).map((o) => <div className="live-order" key={o.id}><Tag tone={o.finalPriority === "P1" ? "red" : "amber"}>{o.finalPriority}</Tag><span>{o.code}</span><b>{o.asset.code}</b><Tag tone={statusTone[o.status]}>{o.status}</Tag></div>)}
      </div>
    </section>
    <section className="flow-strip">
      {[["01", "门店提交", "保留现场原始事实"], ["02", "AI 结构化", "识别缺失与风险"], ["03", "规则定责", "确定性匹配责任方"], ["04", "三方协同", "接单、维修与验收"], ["05", "履历沉淀", "关闭后更新设备历史"]].map(([n, title, text], i) => <div key={n} className="flow-step"><span>{n}</span><div><strong>{title}</strong><small>{text}</small></div>{i < 4 && <ChevronRight />}</div>)}
    </section>
    <div className="boundary-note"><ShieldAlert /><div><strong>安全与证据边界</strong><p>系统不虚构真实供应商、保修或故障原因，不提供拆机、接电、复位或制冷剂操作。高风险情况强制人工复核。</p></div></div>
  </div>;
}

const scenarios = [
  { id: "normal", n: "01", title: "正常自动派单", text: "Gelato 设备异响 + 出品异常，唯一规则命中供应商A。", tone: "green", icon: Route, expected: "待接单 · P2", goal: "走通接单、维修、验收与履历闭环", role: "门店 → 供应商 → 门店", next: "查看四块决策信息后切换供应商接单", route: "/orders/order-001" },
  { id: "missing", n: "02", title: "信息缺失并补充", text: "售卖柜温度升高但设备不明，先补设备编号再分析。", tone: "amber", icon: FileWarning, expected: "待补充", goal: "证明缺少设备时不提前建正式工单", role: "门店", next: "选择 COLD-002 并点击补充分析", route: "/store/supplements" },
  { id: "low-confidence", n: "03", title: "低置信度人工复核", text: "“机器坏了，没反应”，禁止 AI 自动定责。", tone: "purple", icon: UserCog, expected: "待人工确认", goal: "证明低置信度必须由人工决策并留痕", role: "维修管理", next: "填写类别、等级、责任方和决策原因", route: "/orders/order-003" },
  { id: "timeout", n: "04", title: "P1 超时升级", text: "60 秒接单倒计时，可一键模拟超时并通知管理与运营。", tone: "red", icon: TimerReset, expected: "P1 · 待接单", goal: "展示 SLA 异常、通知与重新定责", role: "运营 → 维修管理", next: "到 Demo 控制台模拟即将超时/已超时", route: "/admin/demo-control" },
];

function DemoCenter(props: PageProps) {
  const [busy, setBusy] = useState("");
  const loadScenario = async (id: string) => {
    setBusy(id);
    const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", scenario: id }) });
    const result = await response.json();
    setBusy("");
    if (!response.ok) return props.notify(result.error);
    await props.reload();
    props.notify("演示场景已恢复到初始状态");
    props.navigate(result.route);
  };
  const reset = async () => {
    setBusy("reset");
    const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
    const result = await response.json();
    setBusy("");
    if (!response.ok) return props.notify(result.error);
    await props.reload();
    props.notify("全部 Demo 数据已重置");
  };
  const completed = (id: string) => {
    if (id === "normal") return props.data.orders.find((o) => o.code === "WO-20260719-001")?.status === "已关闭";
    if (id === "missing") return Boolean(props.data.orders.find((o) => o.faultEvent.code === "FE-002"));
    if (id === "low-confidence") return Boolean(props.data.orders.find((o) => o.code === "WO-20260719-003")?.manuallyReviewed);
    return Boolean(props.data.orders.find((o) => o.code === "WO-20260719-004")?.stateEvents.some((event: Entity) => event.toStatus === "超时未接单"));
  };
  return <div>
    <PageHeader eyebrow="DEMO PLAYBOOK" title="稳定演示四条核心路径" subtitle="每次载入都会恢复确定性模拟数据，正式演示无需依赖模型密钥或第三方服务。" actions={<button className="btn danger-ghost" disabled={!!busy} onClick={reset}>{busy === "reset" ? <Loader2 className="spin" /> : <RotateCcw />}重置全部 Demo 数据</button>} />
    <div className="scenario-grid">{scenarios.map((scene) => { const Icon = scene.icon; const isCompleted = completed(scene.id); return <article className={`scenario tone-${scene.tone}`} key={scene.id}><div className="scenario-top"><span>{scene.n}</span><Icon /></div><div className="scenario-status"><Tag tone={isCompleted ? "green" : "gray"}>{isCompleted ? "当前已完成" : "当前未完成"}</Tag></div><h2>{scene.title}</h2><p>{scene.text}</p><div className="scenario-facts"><span><small>场景目标</small>{scene.goal}</span><span><small>推荐角色</small>{scene.role}</span><span><small>推荐下一步</small>{scene.next}</span></div><div className="scenario-result"><small>初始分流</small><strong>{scene.expected}</strong></div><div className="scenario-actions"><button className="btn primary" disabled={busy === scene.id} onClick={() => loadScenario(scene.id)}>{busy === scene.id ? <Loader2 className="spin" /> : <Play />}一键载入</button><button className="btn secondary" onClick={() => props.navigate(scene.route)}>跳转页面<ArrowRight /></button></div></article>; })}</div>
    <div className="demo-tip"><Sparkles /><span><strong>演示建议：</strong>先讲“原始事实不被覆盖”，再展示 AI 建议、规则命中与人工最终决策的边界。</span></div>
  </div>;
}

function ReportForm(props: PageProps) {
  const [form, setForm] = useState({ storeId: "store-001", assetId: "asset-gel-001", originalDescription: "今天上午开始机器运行时有明显异响，做出来的产品不太成型，已经影响正常出品。", occurredAtText: "今天上午", productionImpact: "中", businessImpact: "中", reporterName: "张店长（模拟）" });
  const [risks, setRisks] = useState<string[]>(["异常声音"]);
  const [busy, setBusy] = useState(false);
  const assets = props.data.assets.filter((a) => a.storeId === form.storeId);
  const selectedAsset = props.data.assets.find((item) => item.id === form.assetId);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    const response = await fetch("/api/faults", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, assetId: form.assetId || null, userRiskTags: risks.length ? risks : ["无明显风险"], attachmentUrls: [] }) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) return props.notify(result.error);
    await props.reload(); props.notify(`报修 ${result.fault.code} 已提交`);
    props.navigate(result.order ? `/orders/${result.order.id}` : "/store/supplements");
  };
  return <div>
    <PageHeader eyebrow="STORE · SMART REPORT" title="发起设备报修" subtitle="请描述现场真实情况。系统会整理信息，但不会覆盖原始报修内容。" actions={<DemoTag />} />
    <form className="report-layout" onSubmit={submit}>
      <div className="form-card">
        <div className="section-title"><span>1</span><div><h2>确认门店与设备</h2><p>设备可暂选“待确认”，系统会进入补充流程。</p></div></div>
        <div className="form-grid">
          <label><span>报修门店 *</span><select value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value, assetId: "" })}>{props.data.stores.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
          <label><span>故障设备</span><select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}><option value="">设备待确认</option>{assets.map((a) => <option value={a.id} key={a.id}>{a.code} · {a.category}（模拟）</option>)}</select></label>
        </div>
        {selectedAsset && <div className="asset-inline"><Box /><div><strong>{selectedAsset.code} · {selectedAsset.name}</strong><span>{selectedAsset.location} · {selectedAsset.warrantyStatus} · {selectedAsset.defaultParty?.name}</span></div><DemoTag /></div>}
        <div className="section-title"><span>2</span><div><h2>描述故障现象</h2><p>请写“看到什么、何时开始、影响什么”，不要填写猜测的故障原因。</p></div></div>
        <label><span>原始故障描述 *</span><textarea rows={5} value={form.originalDescription} onChange={(e) => setForm({ ...form, originalDescription: e.target.value })} /></label>
        <div className="form-grid three">
          <label><span>发生时间 *</span><select value={form.occurredAtText} onChange={(e) => setForm({ ...form, occurredAtText: e.target.value })}>{["刚刚", "今天上午", "今天下午", "昨天", "不确定"].map((v) => <option key={v}>{v}</option>)}</select></label>
          <label><span>生产影响 *</span><select value={form.productionImpact} onChange={(e) => setForm({ ...form, productionImpact: e.target.value })}>{["高", "中", "低", "无", "不确定"].map((v) => <option key={v}>{v}</option>)}</select></label>
          <label><span>营业影响 *</span><select value={form.businessImpact} onChange={(e) => setForm({ ...form, businessImpact: e.target.value })}>{["高", "中", "低", "无", "不确定"].map((v) => <option key={v}>{v}</option>)}</select></label>
        </div>
        <label><span>现场风险 *</span><div className="check-row">{["无明显风险", "温度异常", "异常声音", "食品安全", "冒烟", "漏电", "人员安全"].map((risk) => <button type="button" key={risk} className={risks.includes(risk) ? "selected" : ""} onClick={() => setRisks(risks.includes(risk) ? risks.filter((r) => r !== risk) : [...risks.filter((r) => r !== "无明显风险"), risk])}>{risk}</button>)}</div></label>
        <label><span>联系人 *</span><input value={form.reporterName} onChange={(e) => setForm({ ...form, reporterName: e.target.value })} /></label>
        <div className="safe-inline"><ShieldAlert /><span>如出现冒烟、漏电或焦味，请停止自行操作并等待专业人员；系统不会生成危险维修步骤。</span></div>
        <div className="form-actions"><button className="btn primary large" disabled={busy}>{busy ? <Loader2 className="spin" /> : <Send />}提交报修并运行本地 AI</button></div>
      </div>
      <aside className="ai-preview"><div className="ai-icon"><Bot /></div><span className="eyebrow">AI WORKSPACE</span><h3>提交后将自动完成</h3>{["结构化故障摘要", "关键信息完整性检查", "故障类别与紧急度建议", "确定性路由规则匹配", "低置信度与高风险转人工"].map((item) => <div key={item}><CheckCircle2 />{item}</div>)}<p>默认使用本地确定性 AI，同样输入始终得到同样结果。</p></aside>
    </form>
  </div>;
}

function Supplements(props: PageProps) {
  const faults = props.data.faults.filter((f) => f.status === "待补充");
  const [assetByFault, setAssetByFault] = useState<Record<string, string>>({});
  const supplement = async (fault: Entity) => {
    const assetId = assetByFault[fault.id] || props.data.assets.find((a) => a.storeId === fault.storeId)?.id;
    const response = await fetch(`/api/faults/${fault.id}/supplement`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId, supplementText: `已确认设备编号为 ${props.data.assets.find((a) => a.id === assetId)?.code}，请重新分析。`, role: "store" }) });
    const result = await response.json(); if (!response.ok) return props.notify(result.error);
    await props.reload(); props.notify("补充成功，AI 已生成新版本"); if (result.order) props.navigate(`/orders/${result.order.id}`);
  };
  return <div><PageHeader eyebrow="STORE · SUPPLEMENT" title="待补充信息" subtitle="只补充影响识别和派单的关键字段；原始报修内容永久保留。" />
    <div className="stack">{faults.length ? faults.map((fault) => <article className="supplement-card" key={fault.id}><div className="supplement-main"><div className="tag-row"><Tag tone="amber">待补充</Tag><span className="eyebrow">{fault.code}</span></div><h2>{fault.originalDescription}</h2><div className="compare-mini"><div><small>AI 已识别</small><strong>{fault.aiFaultCategory}</strong></div><div><small>缺失字段</small><strong>{jsonList(fault.missingFields).join("、")}</strong></div></div>{jsonList(fault.followUpQuestions).map((q) => <p className="question" key={q}><Bot />{q}</p>)}</div><div className="supplement-action"><label><span>选择本门店设备</span><select value={assetByFault[fault.id] || ""} onChange={(e) => setAssetByFault({ ...assetByFault, [fault.id]: e.target.value })}><option value="">请选择</option>{props.data.assets.filter((a) => a.storeId === fault.storeId).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label><button className="btn primary" onClick={() => supplement(fault)}><RefreshCcw />补充并重新分析</button></div></article>) : <Empty icon={CheckCircle2} title="暂无待补充事项" text="所有报修信息都已完成关键字段检查。" />}</div>
  </div>;
}

function OrderList({ title, subtitle, orders, ...props }: PageProps & { title: string; subtitle: string; orders: Entity[] }) {
  const [query, setQuery] = useState("");
  const filtered = orders.filter((o) => `${o.code}${o.asset.code}${o.faultEvent.aiSummary}`.toLowerCase().includes(query.toLowerCase()));
  return <div><PageHeader eyebrow="WORK ORDER CENTER" title={title} subtitle={subtitle} actions={<div className="search"><Search /><input placeholder="搜索工单号或设备" value={query} onChange={(e) => setQuery(e.target.value)} /></div>} /><div className="stack">{filtered.length ? filtered.map((order) => <OrderCard key={order.id} order={order} onOpen={(id) => props.navigate(`/orders/${id}`)} />) : <Empty title="没有符合条件的工单" text="调整筛选条件，或载入一个演示场景。" />}</div></div>;
}

function ManagerDashboard(props: PageProps) {
  const review = props.data.orders.filter((o) => o.status === "待人工确认");
  const timeout = props.data.orders.filter((o) => o.status === "超时未接单");
  const returns = props.data.orders.filter((o) => o.status === "返修中");
  return <div><PageHeader eyebrow="MAINTENANCE CONTROL TOWER" title="维修管理工作台" subtitle="只把需要人工判断和升级的事项放到最前面。" actions={<button className="btn secondary" onClick={() => props.navigate("/manager/orders")}>查看全部工单<ArrowRight /></button>} />
    <div className="kpi-grid"><Kpi label="待人工确认" value={review.length} note="低置信度 / 高风险 / 规则异常" tone="purple" icon={UserCog} /><Kpi label="超时未接单" value={timeout.length} note="需要重新定责或升级" tone="red" icon={TimerReset} /><Kpi label="返修处理中" value={returns.length} note="验收不通过回到原责任方" tone="amber" icon={RotateCcw} /><Kpi label="P1 活跃工单" value={props.data.orders.filter((o) => o.finalPriority === "P1" && !["已关闭", "已取消"].includes(o.status)).length} note="Demo 60 秒接单 SLA" tone="neutral" icon={ShieldAlert} /></div>
    <div className="manager-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">ACTION REQUIRED</span><h2>优先处理</h2></div><Tag tone="red">{review.length + timeout.length} 项</Tag></div><div className="stack compact-stack">{[...timeout, ...review].slice(0, 5).map((o) => <OrderCard compact key={o.id} order={o} onOpen={(id) => props.navigate(`/orders/${id}`)} />)}</div></section>
      <aside className="panel activity"><div className="panel-head"><div><span className="eyebrow">NOTIFICATION</span><h2>异常通知</h2></div></div>{props.data.notifications.slice(0, 6).map((n) => <div className="notice" key={n.id}><span className={n.type.includes("超时") ? "red-dot" : "blue-dot"} /><div><strong>{n.type}</strong><p>{n.content}</p><small>{formatTime(n.sentAt)} · {n.recipient}</small></div></div>)}</aside></div>
  </div>;
}

function SupplierBoard(props: PageProps) {
  const groups = ["待接单", "处理中", "返修中", "待验收"];
  const supplierParties = props.data.parties;
  const ownOrders = props.data.orders.filter((o) => o.finalPartyId === props.supplierPartyId);
  return <div><PageHeader eyebrow="SUPPLIER TASK CENTER" title="责任方任务中心" subtitle="模拟责任方身份已绑定；只能操作分配给当前责任方的工单。" actions={<div className="supplier-identity"><DemoTag /><label><span>当前模拟责任方</span><select aria-label="当前模拟责任方" value={props.supplierPartyId} onChange={(event) => props.setSupplierPartyId(event.target.value)}>{supplierParties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label></div>} /><div className="kanban">{groups.map((status) => <section key={status}><div className="kanban-head"><span>{status}</span><b>{ownOrders.filter((o) => o.status === status).length}</b></div>{ownOrders.filter((o) => o.status === status).slice(0, 5).map((o) => <OrderCard compact key={o.id} order={o} onOpen={(id) => props.navigate(`/supplier/orders/${id}`)} />)}</section>)}</div></div>;
}

function AdminDashboard(props: PageProps) {
  const byStatus = Object.entries(props.data.orders.reduce<Record<string, number>>((acc, order) => ({ ...acc, [order.status]: (acc[order.status] || 0) + 1 }), {})).map(([name, value]) => ({ name, value }));
  const byCategory = Object.entries(props.data.orders.reduce<Record<string, number>>((acc, order) => ({ ...acc, [order.asset.category]: (acc[order.asset.category] || 0) + 1 }), {})).map(([name, value]) => ({ name: name.replace("设备", ""), value }));
  const closed = props.data.orders.filter((o) => o.status === "已关闭").length;
  return <div><PageHeader eyebrow="OPS ANALYTICS" title="全局维修运营看板" subtitle="基于模拟工单，仅用于产品逻辑验证，不代表企业真实运营表现。" actions={<button className="btn secondary" onClick={() => props.navigate("/admin/demo-control")}><Settings2 />Demo 控制台</button>} />
    <div className="kpi-grid"><Kpi label="模拟工单总数" value={props.data.orders.length} note="覆盖 3 家模拟门店" icon={ListChecks} /><Kpi label="闭环率" value={`${Math.round(closed / props.data.orders.length * 100)}%`} note={`${closed} 张已验收关闭`} tone="green" icon={CheckCircle2} /><Kpi label="AI 低置信度率" value={`${Math.round(props.data.faults.filter((f) => f.aiConfidence === "low").length / props.data.faults.length * 100)}%`} note="低置信度全部进入人工" tone="purple" icon={Bot} /><Kpi label="超时 / 返修" value={`${props.data.orders.filter((o) => o.status === "超时未接单").length} / ${props.data.orders.filter((o) => o.returnCount > 0).length}`} note="异常均可追溯状态日志" tone="red" icon={AlertTriangle} /></div>
    <div className="chart-grid"><section className="panel chart-panel"><div className="panel-head"><div><span className="eyebrow">STATUS DISTRIBUTION</span><h2>工单状态分布</h2></div><DemoTag /></div><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={64} outerRadius={98} paddingAngle={3}>{byStatus.map((_, i) => <Cell key={i} fill={["#ee7f37", "#5e8e64", "#6f67a7", "#cf5d4e", "#547a91", "#b58b55", "#7f8a82"][i % 7]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="chart-legend">{byStatus.map((item) => <span key={item.name}><i />{item.name} {item.value}</span>)}</div></section>
      <section className="panel chart-panel"><div className="panel-head"><div><span className="eyebrow">ASSET CATEGORY</span><h2>设备类别故障量</h2></div><DemoTag /></div><ResponsiveContainer width="100%" height={300}><BarChart data={byCategory} margin={{ top: 10, right: 12, left: -20, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee6dc" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#e97835" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></section></div>
  </div>;
}

function MasterTable({ type, ...props }: PageProps & { type: "stores" | "assets" | "parties" | "rules" }) {
  const config = {
    stores: { title: "模拟门店", subtitle: "Demo 组织与门店主数据。", rows: props.data.stores, columns: [["code", "门店编号"], ["name", "门店名称"], ["region", "区域"], ["type", "类型"], ["managerName", "负责人"], ["status", "状态"]] },
    assets: { title: "模拟设备台账", subtitle: "设备、门店、保修与默认责任方的唯一绑定。", rows: props.data.assets, columns: [["code", "设备编号"], ["name", "设备名称"], ["category", "类别"], ["store.name", "所属门店"], ["warrantyStatus", "保修"], ["operationalStatus", "运行状态"]] },
    parties: { title: "模拟责任方", subtitle: "供应商、内部维修、IT 与设施责任方。", rows: props.data.parties, columns: [["code", "责任方编号"], ["name", "责任方名称"], ["type", "类型"], ["contactName", "接单联系人"], ["status", "服务状态"]] },
    rules: { title: "路由与 SLA 规则", subtitle: "AI 只提取信息；最终责任方由这些确定性规则决定。", rows: props.data.rules, columns: [["code", "规则编号"], ["name", "规则名称"], ["priority", "优先级"], ["responsibilityParty.name", "推荐责任方"], ["priorityLevel", "等级"], ["acceptanceSlaSeconds", "接单SLA（秒）"], ["requiresHumanReview", "人工复核"]] },
  }[type];
  const get = (row: Entity, path: string) => path.split(".").reduce((value, key) => value?.[key], row);
  return <div><PageHeader eyebrow="MASTER DATA · DEMO" title={config.title} subtitle={config.subtitle} actions={<DemoTag />} /><div className="table-wrap"><table><thead><tr>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{config.rows.map((row) => <tr key={row.id} onClick={() => type === "assets" && props.navigate(`/assets/${row.id}`)}>{config.columns.map(([key]) => <td key={key}>{key === "requiresHumanReview" ? (get(row, key) ? <Tag tone="purple">是</Tag> : "否") : String(get(row, key) ?? "—")}</td>)}</tr>)}</tbody></table></div></div>;
}

function DemoControl(props: PageProps) {
  const waiting = props.data.orders.filter((o) => o.status === "待接单");
  const [selected, setSelected] = useState(waiting[0]?.id ?? "");
  const call = async (action: string) => {
    const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, orderId: selected }) });
    const result = await response.json(); if (!response.ok) return props.notify(result.error);
    await props.reload(); props.notify(action === "reset" ? "Demo 数据已重置" : "Demo 时间状态已更新");
  };
  return <div><PageHeader eyebrow="ADMIN · DEMO CONTROL" title="Demo 控制台" subtitle="仅运营管理员可见。所有操作只影响本地模拟数据。" />
    <div className="control-grid"><section className="panel"><div className="control-icon orange"><Database /></div><h2>数据场景</h2><p>恢复 20 条测试数据和四个稳定演示场景。</p><button className="btn danger-ghost" onClick={() => call("reset")}><RotateCcw />重置全部 Demo 数据</button><button className="btn secondary" onClick={() => props.navigate("/demo")}><Play />载入演示场景</button></section>
      <section className="panel"><div className="control-icon red"><TimerReset /></div><h2>SLA 时间模拟</h2><p>选择一张待接单工单，模拟提醒、超时或恢复正常。</p><label><span>目标工单</span><select value={selected} onChange={(e) => setSelected(e.target.value)}>{props.data.orders.filter((o) => ["待接单", "超时未接单"].includes(o.status)).map((o) => <option key={o.id} value={o.id}>{o.code} · {o.finalPriority} · {o.status}</option>)}</select></label><div className="button-stack"><button className="btn secondary" onClick={() => call("almost-timeout")}><Clock3 />模拟即将超时</button><button className="btn danger" onClick={() => call("timeout")}><AlertTriangle />模拟已经超时</button><button className="btn secondary" onClick={() => call("restore")}><RefreshCcw />恢复正常时间</button></div></section></div>
    <div className="sla-banner"><Clock3 /><div><strong>Demo 模拟 SLA，正式落地需按企业规则配置。</strong><span>P1：60 秒 · P2：120 秒 · P3：300 秒</span></div></div>
  </div>;
}

function AssetDetail({ id, ...props }: PageProps & { id: string }) {
  const asset = props.data.assets.find((item) => item.id === id);
  if (!asset) return <Empty title="未找到设备" text="该设备可能已在 Demo 重置后更新。" />;
  const history = props.data.orders.filter((o) => o.assetId === id);
  return <div><PageHeader eyebrow="ASSET · REPAIR HISTORY" title={`${asset.code} · ${asset.name}`} subtitle="设备基础信息与维修历史均为 Demo 模拟数据。" actions={<Tag tone={asset.operationalStatus === "正常" ? "green" : "amber"}>{asset.operationalStatus}</Tag>} />
    <div className="asset-profile"><div><small>所属门店</small><strong>{asset.store.name}</strong></div><div><small>设备类别 / 型号</small><strong>{asset.category} · {asset.model}</strong></div><div><small>默认责任方</small><strong>{asset.defaultParty?.name}</strong></div><div><small>模拟保修</small><strong>{asset.warrantyStatus}</strong></div></div>
    <div className="kpi-grid"><Kpi label="历史工单" value={history.length} note="同一设备关联工单" icon={History} /><Kpi label="已关闭" value={history.filter((o) => o.status === "已关闭").length} note="均经过门店验收" tone="green" icon={CheckCircle2} /><Kpi label="返修次数" value={history.reduce((n, o) => n + o.returnCount, 0)} note="验收不通过产生" tone="amber" icon={RotateCcw} /><Kpi label="重复故障" value={history.filter((o) => o.repeatedFault).length} note="Demo 30 天窗口" tone="red" icon={AlertTriangle} /></div>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">WORK ORDER HISTORY</span><h2>维修履历</h2></div></div><div className="stack compact-stack">{history.map((o) => <OrderCard compact key={o.id} order={o} onOpen={(orderId) => props.navigate(`/orders/${orderId}`)} />)}</div></section>
  </div>;
}

function OrderDetail({ id, ...props }: PageProps & { id: string }) {
  const order = props.data.orders.find((item) => item.id === id);
  const [busy, setBusy] = useState("");
  const [showTrace, setShowTrace] = useState(false);
  if (!order) return <Empty title="未找到工单" text="该工单可能已在场景重置后更新。" />;
  const fault = order.faultEvent;
  const ai = (() => { try { return JSON.parse(fault.aiResultJson); } catch { return {}; } })();
  const analysisHistory = jsonArray<{ version: number; createdAt: string; analysis: Entity }>(fault.aiHistoryJson);
  const routeTrace = jsonArray<Entity | string>(order.routeTraceJson);
  const selectedRule = routeTrace.find((item): item is Entity => typeof item !== "string" && Boolean(item.priorityLevel));
  const rulePriority = selectedRule?.priorityLevel
    ?? (routeTrace.some((item) => typeof item === "string" && item.includes("R010")) ? "待确认" : order.finalPriority);
  const nextStep = ({
    待人工确认: ["维修管理", "核对 AI 建议与规则结果，填写最终决策"],
    待接单: [order.finalParty?.name ?? "责任方", "确认接单并进入处理"],
    超时未接单: ["维修管理", "处理 SLA 异常并重新定责派发"],
    处理中: [order.finalParty?.name ?? "责任方", "填写实际故障原因和维修动作"],
    待验收: [fault.store.name, "现场验收维修结果"],
    返修中: [order.finalParty?.name ?? "原责任方", "接受返修并重新处理"],
    已关闭: ["已完成", "维修事实已沉淀到设备履历"],
    已取消: ["已结束", "无需继续操作"],
  } as Record<string, [string, string]>)[order.status] ?? ["系统", "等待下一步状态"];

  const action = async (name: string, extra: Entity = {}) => {
    setBusy(name);
    const defaults: Entity = { role: props.role, actorName: `${roleMeta[props.role].label}（Demo）` };
    if (props.role === "supplier") defaults.actorPartyId = props.supplierPartyId;
    const response = await fetch(`/api/orders/${id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: name, ...defaults, ...extra }),
    });
    const result = await response.json();
    setBusy("");
    if (!response.ok) return props.notify(result.error);
    await props.reload();
    props.notify("操作成功，状态与日志已更新");
  };

  return <div>
    <div className="order-title">
      <button className="back-link" onClick={() => history.back()}>← 返回</button>
      <div className="title-line">
        <div><span className="eyebrow">{order.code} · <DemoTag /></span><h1>{fault.aiSummary}</h1></div>
        <div className="tag-row"><Tag tone={order.finalPriority === "P1" ? "red" : order.finalPriority === "P2" ? "amber" : "gray"}>{order.finalPriority}</Tag><Tag tone={statusTone[order.status]}>{order.status}</Tag>{order.returnCount > 0 && <Tag tone="red">返修 {order.returnCount} 次</Tag>}</div>
      </div>
      <div className="detail-strip"><span><Store />{fault.store.name} <DemoTag /></span><Link href={`/assets/${order.asset.id}`}><Box />{order.asset.code} · {order.asset.category} · 查看履历</Link><span><Users />{order.finalParty?.name ?? "待人工定责"}</span><Countdown deadline={order.acceptanceDeadline} acceptedAt={order.acceptedAt} status={order.status} /></div>
    </div>
    <section className={`status-summary ${["超时未接单", "返修中"].includes(order.status) ? "risk" : ""}`}>
      <div><small>当前状态</small><strong>{order.status}</strong></div>
      <div><small>当前责任方</small><strong>{order.finalParty?.name ?? "尚未形成最终责任方"}</strong></div>
      <div><small>下一步由谁做什么</small><strong>{nextStep[0]}：{nextStep[1]}</strong></div>
      <div><small>SLA 状态</small><strong>{order.slaStatus === "即将超时" ? order.slaStatus : order.liveSlaStatus ?? order.slaStatus}</strong></div>
    </section>
    <div className="sla-disclaimer"><Clock3 />Demo 模拟 SLA，正式落地需按企业规则配置。</div>
    <div className="decision-grid">
      <section className="decision-card raw">
        <div className="decision-head"><span>01</span><div><small>ORIGINAL FACT</small><h2>门店原始报修</h2></div></div>
        <blockquote>{fault.originalDescription}</blockquote>
        <dl><div><dt>发生时间</dt><dd>{fault.occurredAtText}</dd></div><div><dt>生产 / 营业影响</dt><dd>{fault.productionImpact} / {fault.businessImpact}</dd></div><div><dt>门店风险标签</dt><dd>{jsonList(fault.userRiskTags).join("、")}</dd></div><div><dt>补充信息</dt><dd>{fault.supplementText || "无"}</dd></div></dl>
      </section>
      <section className="decision-card ai">
        <div className="decision-head"><span>02</span><div><small>AI SUGGESTION</small><h2>AI 分析建议</h2></div><Tag tone={fault.aiConfidence === "low" ? "red" : "purple"}>{fault.aiConfidence} 置信度</Tag></div>
        <p className="ai-summary">{fault.aiSummary}</p>
        <dl><div><dt>故障类别建议</dt><dd>{fault.aiFaultCategory}</dd></div><div><dt>紧急度建议</dt><dd>{fault.aiPrioritySuggestion}</dd></div><div><dt>业务影响识别</dt><dd>生产 {ai.productionImpact ?? fault.productionImpact} / 营业 {ai.businessImpact ?? fault.businessImpact}</dd></div><div><dt>AI 风险标签</dt><dd>{(ai.riskTags || []).join("、") || "无明显风险"}</dd></div><div><dt>判断证据</dt><dd>{(ai.evidence || []).join("；")}</dd></div></dl>
        <details className="analysis-history"><summary>分析版本历史（当前 v{fault.analysisVersion}）</summary>{analysisHistory.map((item) => <div key={item.version}><strong>v{item.version} · {formatTime(item.createdAt)}</strong><span>{item.analysis.standardSummary}</span><small>{item.analysis.faultCategorySuggestion} · {item.analysis.prioritySuggestion} · {item.analysis.confidence}</small></div>)}</details>
        {(props.role === "manager" || props.role === "admin") && <button className="text-button" disabled={busy === "rerunAI"} onClick={() => action("rerunAI")}><RefreshCcw />重新运行 AI 分析</button>}
      </section>
      <section className="decision-card rule">
        <div className="decision-head"><span>03</span><div><small>DETERMINISTIC RULE</small><h2>确定性规则结果</h2></div><Tag tone="green">系统规则</Tag></div>
        <p className="route-result"><Route />{order.routeExplanation}</p>
        <dl><div><dt>命中规则</dt><dd>{routeTrace.map((item) => typeof item === "string" ? item : `${item.ruleCode ?? item.code ?? "规则"} ${item.ruleName ?? ""}`).join("；") || "无唯一规则命中"}</dd></div><div><dt>规则推荐责任方</dt><dd>{order.recommendedParty?.name ?? "无唯一结果"}</dd></div><div><dt>规则建议等级</dt><dd>{rulePriority}</dd></div></dl>
        <button className="text-button" onClick={() => setShowTrace(!showTrace)}><Search />{showTrace ? "收起" : "查看"}规则命中依据</button>
        {showTrace && <div className="trace-box">{routeTrace.length ? routeTrace.map((item, index) => <span key={`${index}-${JSON.stringify(item)}`}><CheckCircle2 />{typeof item === "string" ? item : `${item.ruleCode ?? "规则"}：${item.explanation ?? item.ruleName ?? JSON.stringify(item)}`}</span>) : <span>没有唯一规则结果，必须人工确认。</span>}</div>}
      </section>
      <section className="decision-card human">
        <div className="decision-head"><span>04</span><div><small>HUMAN FINAL DECISION</small><h2>人工最终决策</h2></div><Tag tone={order.manuallyReviewed ? "amber" : "gray"}>{order.manuallyReviewed ? "已人工确认" : "尚未人工修改"}</Tag></div>
        <p className="human-result"><UserCog />{order.manuallyReviewed ? order.manualReviewReason : "当前沿用规则结果；AI 不直接决定最终责任方。"}</p>
        <dl><div><dt>最终责任方</dt><dd>{order.finalParty?.name ?? "待人工确认"}</dd></div><div><dt>最终分类 / 等级</dt><dd>{order.finalFaultCategory} / {order.finalPriority}</dd></div><div><dt>人工修改留痕</dt><dd>{order.manuallyReviewed ? "完整记录在下方状态时间线" : "无人工修改"}</dd></div></dl>
      </section>
    </div>
    {order.repairCause && <section className="repair-facts"><div><small>维修人员实际诊断</small><strong>{order.repairCause}</strong></div><div><small>已执行维修动作</small><strong>{order.repairAction}</strong></div><div><small>使用配件</small><strong>{order.partsUsed || "无"}</strong></div><DemoTag /></section>}
    <div className="detail-columns">
      <section className="panel timeline"><div className="panel-head"><div><span className="eyebrow">AUDIT TRAIL</span><h2>状态时间线</h2></div><Tag tone="blue">{order.stateEvents.length} 条日志</Tag></div>{order.stateEvents.map((event: Entity, index: number) => <div className="timeline-item" key={event.id}><span className={`timeline-dot ${index === order.stateEvents.length - 1 ? "current" : ""}`} /><div><div><Tag tone={statusTone[event.toStatus]}>{event.toStatus}</Tag><time>{formatTime(event.timestamp)}</time></div><strong>{event.reason}</strong><p>{event.actorName} · {event.actorRole}</p></div></div>)}</section>
      <aside className="panel next-action"><div className="panel-head"><div><span className="eyebrow">NEXT ACTION</span><h2>当前操作</h2></div></div><ActionButtons order={order} role={props.role} supplierPartyId={props.supplierPartyId} parties={props.data.parties} busy={busy} action={action} navigate={props.navigate} /></aside>
    </div>
  </div>;
}

function ActionButtons({ order, role, supplierPartyId, parties, busy, action, navigate }: { order: Entity; role: Role; supplierPartyId: string; parties: Entity[]; busy: string; action: (name: string, extra?: Entity) => void; navigate: (href: string) => void }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [repair, setRepair] = useState({ repairCause: "", repairAction: "", partsUsed: "" });
  const [decision, setDecision] = useState({
    finalFaultCategory: order.finalFaultCategory === "不确定" ? "无法启动" : order.finalFaultCategory,
    finalPriority: order.finalPriority === "待确认" ? "P2" : order.finalPriority,
    finalPartyId: order.finalPartyId || order.recommendedPartyId || "party-a",
  });
  const submit = (event: FormEvent, name: string, extra: Entity) => {
    event.preventDefault();
    action(name, extra);
  };
  const SimpleButton = ({ name, children, tone = "primary" }: { name: string; children: React.ReactNode; tone?: string }) => <button type="button" className={`btn ${tone}`} disabled={!!busy} onClick={() => action(name)}>{busy === name ? <Loader2 className="spin" /> : null}{children}</button>;

  if (role === "supplier" && order.finalPartyId !== supplierPartyId) return <div className="permission-block"><ShieldAlert /><div><strong>不可操作其他责任方工单</strong><span>请返回任务中心切换到工单当前责任方。</span></div></div>;
  if (role === "supplier" && order.status === "待接单") return <><p>请先确认设备、门店、故障摘要和模拟保修信息。</p><SimpleButton name="accept"><CheckCircle2 />接单并进入处理</SimpleButton><form className="action-form" onSubmit={(event) => submit(event, "reject", { reason })}><label><span>拒单原因 *</span><textarea rows={2} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="说明为什么当前责任方无法受理" /></label><button className="btn danger-ghost" disabled={!!busy}>{busy === "reject" && <Loader2 className="spin" />}拒单并转人工</button></form></>;
  if (role === "supplier" && order.status === "处理中") return <><p>实际故障原因必须由维修人员填写，AI 不代替专业诊断。</p>{!order.repairStartedAt && <SimpleButton name="start"><Wrench />开始处理</SimpleButton>}<form className="action-form" onSubmit={(event) => submit(event, "complete", repair)}><label><span>实际故障原因 *</span><textarea rows={2} required value={repair.repairCause} onChange={(event) => setRepair({ ...repair, repairCause: event.target.value })} placeholder="由维修人员填写现场诊断事实" /></label><label><span>维修动作 *</span><textarea rows={2} required value={repair.repairAction} onChange={(event) => setRepair({ ...repair, repairAction: event.target.value })} placeholder="记录已实施的安全维修动作" /></label><label><span>使用配件</span><input value={repair.partsUsed} onChange={(event) => setRepair({ ...repair, partsUsed: event.target.value })} placeholder="无" /></label><button className="btn primary" disabled={!!busy}>{busy === "complete" ? <Loader2 className="spin" /> : <PackageCheck />}提交维修结果</button></form></>;
  if (role === "supplier" && order.status === "返修中") return <><p>门店验收未通过，工单已回到原责任方；不会创建无关联新工单。</p><SimpleButton name="restart"><RotateCcw />接受返修</SimpleButton></>;
  if (role === "store" && order.status === "待验收") return <><div className="repair-summary"><strong>维修方提交结果</strong><span>原因：{order.repairCause || "未填写"}</span><span>动作：{order.repairAction || "未填写"}</span><span>配件：{order.partsUsed || "无"}</span></div><form className="action-form" onSubmit={(event) => submit(event, "approve", { comment })}><label><span>验收意见</span><textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="可选：记录现场验收结果" /></label><button className="btn primary" disabled={!!busy}>{busy === "approve" ? <Loader2 className="spin" /> : <CheckCircle2 />}验收通过并关闭</button></form><form className="action-form rejection-form" onSubmit={(event) => submit(event, "rejectAcceptance", { reason })}><label><span>验收不通过原因 *</span><textarea rows={2} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="必须说明仍未满足的现场结果" /></label><button className="btn danger" disabled={!!busy}>{busy === "rejectAcceptance" ? <Loader2 className="spin" /> : <XCircle />}验收不通过，进入返修</button></form></>;
  if ((role === "manager" || role === "admin") && order.status === "待人工确认") return <form className="action-form decision-form" onSubmit={(event) => submit(event, "manualReview", { ...decision, reason })}><p>页面已并排保留原始信息、AI 建议和规则结果。人工决策原因不能为空。</p><label><span>最终故障类别 *</span><input required value={decision.finalFaultCategory} onChange={(event) => setDecision({ ...decision, finalFaultCategory: event.target.value })} /></label><label><span>最终紧急度 *</span><select value={decision.finalPriority} onChange={(event) => setDecision({ ...decision, finalPriority: event.target.value })}>{["P1", "P2", "P3"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>最终责任方 *</span><select value={decision.finalPartyId} onChange={(event) => setDecision({ ...decision, finalPartyId: event.target.value })}>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label><label><span>人工决策原因 *</span><textarea rows={3} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="写明依据及为何采纳或修改 AI/规则建议" /></label><button className="btn primary" disabled={!!busy}>{busy === "manualReview" ? <Loader2 className="spin" /> : <UserCog />}确认人工决策并派发</button><button type="button" className="btn danger-ghost" disabled={!reason.trim() || !!busy} onClick={() => action("cancel", { reason })}><XCircle />按上述原因取消</button></form>;
  if ((role === "manager" || role === "admin") && order.status === "超时未接单") return <form className="action-form decision-form" onSubmit={(event) => submit(event, "redispatch", { ...decision, reason })}><p>工单已升级。重新定责会把原责任方、新责任方和原因写入时间线。</p><label><span>新责任方 *</span><select value={decision.finalPartyId} onChange={(event) => setDecision({ ...decision, finalPartyId: event.target.value })}>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label><label><span>最终紧急度 *</span><select value={decision.finalPriority} onChange={(event) => setDecision({ ...decision, finalPriority: event.target.value })}>{["P1", "P2", "P3"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>重新定责原因 *</span><textarea rows={3} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="说明超时处置与改派依据" /></label><button className="btn primary" disabled={!!busy}>{busy === "redispatch" ? <Loader2 className="spin" /> : <RefreshCcw />}重新定责并派发</button><button type="button" className="btn danger-ghost" disabled={!reason.trim() || !!busy} onClick={() => action("cancel", { reason })}><XCircle />按上述原因取消</button></form>;
  return <><div className="current-state"><CheckCircle2 /><div><strong>当前无需此角色操作</strong><span>切换顶部角色可继续演示下一步。</span></div></div><button className="btn secondary" onClick={() => navigate("/demo")}><Play />返回演示场景</button></>;
}
