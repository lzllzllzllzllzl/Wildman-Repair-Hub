# 野人先生 AI 设备维修协同中枢

一个本地优先、无需模型密钥或第三方登录即可完整演示的中文全栈 Web Demo。

> 重要：系统内所有门店、设备、责任方、保修、SLA、联系方式和维修案例均为 **Demo 模拟数据**，不代表野人先生真实流程或运营数据。

## 已实现的闭环

门店报修 → 本地 AI 结构化 → 完整性检查 → 缺失补充 → 确定性规则路由 / 人工复核 → 工单派发 → 接单或拒单 → 维修处理 → 维修结果 → 门店验收 → 返修或关闭 → 设备维修履历。

稳定支持：

1. 正常自动派单；
2. 信息缺失并补充；
3. AI 低置信度人工复核；
4. P1 超时未接单升级；
5. 验收不通过返修；
6. 验收通过关闭并写入设备履历。

## 环境要求

- Node.js 20 或更高；
- npm 10 或更高；
- 无需外部数据库；
- 无需模型 API 密钥；
- 无需飞书或其他第三方账号。

## 安装与启动

```bash
npm install
cp .env.example .env
npm run demo:setup
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

如果本地已有 `.env`，无需重复复制。

## 数据库

本项目使用 Prisma + SQLite，数据库文件位于 `prisma/dev.db`。

```bash
# 生成客户端并创建/同步数据库
npm run db:init

# 写入 3 店、9 设备、6 责任方、10 规则、20 故障事件和四个场景
npm run db:seed

# 一键清空并恢复全部 Demo 数据
npm run db:reset
```

`npm run demo:setup` 等价于依次执行数据库初始化和种子写入。

## 质量检查

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 角色切换

页面顶部有四个角色按钮：

- 门店：报修、补充、查看进度、验收；
- 维修管理：低置信度/高风险/超时复核、重新定责、取消；
- 供应商：接单、拒单、开始处理、提交维修结果；
- 运营：全局看板、主数据、路由规则和 Demo 控制台。

这是 Demo 快速身份切换器，不是生产登录系统。

## 载入演示场景

访问 `/demo` 或点击侧栏“演示场景中心”，选择四条固定路径之一。每个场景显示目标、推荐角色、下一步、完成状态和页面跳转。点击“一键载入”会恢复种子数据，保证输入和结果稳定；页面顶部可一键重置全部 Demo 数据。

## 模拟 SLA 超时

1. 切换到“运营”；
2. 打开“Demo 控制台”；
3. 选择待接单工单；
4. 点击“模拟即将超时”“模拟已经超时”或“恢复正常时间”。

Demo SLA 为 P1 60 秒、P2 120 秒、P3 300 秒。正式落地必须按企业真实规则配置。

## 重置 Demo

可以在运营 Demo 控制台点击“重置全部 Demo 数据”，或在终端执行：

```bash
npm run db:reset
```

## 页面截图

开发服务启动后执行：

```bash
npm run screenshots
```

截图保存到 `screenshots/`，包含 10 张指定演示截图和 2 张移动端 QA 截图。脚本优先使用系统 Chrome；本机没有 Chrome 时，先执行 `npx playwright install chromium`。

## 技术结构

- `app/`：页面与 API；
- `components/`：完整角色界面；
- `lib/ai.ts`：`AIProvider` 与确定性本地实现；
- `lib/routing.ts`：可解释路由规则；
- `lib/state-machine.ts`：核心状态机与权限边界；
- `lib/sla.ts`：Demo SLA；
- `lib/services.ts`：业务操作与状态日志；
- `prisma/schema.prisma`：数据模型；
- `prisma/seed.ts`：种子与四个演示场景；
- `tests/`：单元和集成流程测试；
- `feishu-import/`：飞书 CSV 导入材料。

## 安全边界

- AI 不决定最终专业故障原因；
- AI 不自由决定最终责任方；
- AI 不输出拆机、接电、复位、制冷剂等危险操作；
- 冒烟、漏电、焦味、食品安全等风险强制人工复核；
- 原始报修永远与 AI 摘要、人工结果分开保存；
- 未经门店验收不得关闭工单。
- 供应商操作同时校验当前模拟责任方，不能修改其他责任方工单；
- AI 分析 v1/v2 保存并可追溯，原始报修不被覆盖。

## 文档

- `IMPLEMENTATION_PLAN.md`：实施计划；
- `BUILD_STATUS.md`：构建与验证状态；
- `DEMO_SCRIPT.md`：演示脚本；
- `PRODUCT_ACCEPTANCE_REPORT.md`：第二轮产品验收结论；
- `MANUAL_TEST_RESULTS.md`：真实页面操作记录；
- `UI_REVIEW.md`：界面与信息层级复核；
- `docs/ASSUMPTIONS_AND_CONFLICTS.md`：证据边界、假设和冲突；
- `docs/FEISHU_MAPPING.md`：飞书迁移映射；
- `KNOWN_LIMITATIONS.md`：已知限制。
