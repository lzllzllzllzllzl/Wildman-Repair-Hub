# Web Demo 与飞书多维表格迁移映射

> 本材料只描述迁移设计，不连接或操作真实飞书账号。所有 CSV 内容均为 Demo 模拟数据。

## 实体映射

| Web / Prisma 实体 | 飞书建议表 | 主字段 | 关键关联 |
|---|---|---|---|
| Store | 01_门店表 | 门店ID（文本） | 关联设备、关联故障事件 |
| Asset | 02_设备台账 | 设备ID（文本） | 所属门店、默认责任方、关联工单 |
| ResponsibilityParty | 03_供应商与责任方 | 责任方ID（文本） | 关联设备、路由规则、工单 |
| FaultEvent | 04_故障事件 | 事件ID（文本） | 报修门店、设备、关联工单 |
| RoutingRule | 06_派单与SLA规则 | 规则ID（文本） | 推荐责任方 |
| WorkOrder | 07_维修工单中心 | 工单ID（文本） | 故障事件、设备、推荐/最终责任方 |
| StateEvent | 08_状态与责任变更日志 | 状态事件ID（自动编号） | 关联工单 |
| NotificationLog | A02_通知日志 | 通知ID（自动编号） | 关联工单 |

如进入正式 PoC，建议按 v0.3 再增加 `05_AI分析记录`、`09_预约与到店记录`、`10_维修记录`、`11_验收记录`，避免覆盖历史分析和业务记录。

## 字段与类型

### 01_门店表

| Web 字段 | 飞书字段 | 类型 |
|---|---|---|
| code | 门店ID | 文本，唯一 |
| name | 门店名称 | 文本 |
| region | 所属区域 | 单选 |
| type | 门店类型 | 单选：直营/加盟 |
| address | 门店地址 | 多行文本 |
| managerName | 店长/联系人 | 人员或文本 |
| phone | 联系电话 | 文本 |
| status | 门店状态 | 单选 |
| isDemo | Demo数据标记 | 复选框 |

### 02_设备台账

| Web 字段 | 飞书字段 | 类型 |
|---|---|---|
| code | 设备ID | 文本，唯一，可生成二维码 |
| name | 设备名称 | 文本 |
| storeId | 所属门店 | 关联 01_门店表 |
| category | 设备类别 | 单选 |
| model | 品牌型号 | 文本 |
| location | 设备位置 | 文本 |
| defaultPartyId | 默认责任方 | 关联 03_供应商与责任方 |
| warrantyStatus | 保修状态 | 公式/单选 |
| warrantyEndDate | 保修截止日 | 日期 |
| operationalStatus | 当前运行状态 | 单选 |
| isDemo | Demo数据标记 | 复选框 |

### 03_供应商与责任方

| Web 字段 | 飞书字段 | 类型 |
|---|---|---|
| code | 责任方ID | 文本，唯一 |
| name | 责任方名称 | 文本 |
| type | 责任方类型 | 单选 |
| serviceCategories | 服务设备类别 | 多选 |
| serviceRegions | 服务区域 | 多选 |
| contactName | 接单负责人 | 人员或文本 |
| contactPhone | 联系方式 | 文本 |
| status | 当前服务状态 | 单选 |
| isDemo | Demo数据标记 | 复选框 |

### 04_故障事件

| Web 字段 | 飞书字段 | 类型 |
|---|---|---|
| code | 事件ID | 文本/自动编号 |
| createdAt | 创建时间 | 创建时间 |
| occurredAtText | 发现时间描述 | 文本；正式版建议日期时间 |
| storeId | 报修门店 | 关联 01_门店表 |
| assetId | 关联设备 | 关联 02_设备台账，可空 |
| originalDescription | 原始故障描述 | 多行文本，不允许被 AI 覆盖 |
| attachmentUrls | 原始附件 | 附件 |
| productionImpact | 是否影响生产 | 单选 |
| businessImpact | 是否影响营业 | 单选 |
| userRiskTags | 用户风险标签 | 多选 |
| reporterName | 报修人 | 人员或文本 |
| status | 当前处理阶段 | 单选 |
| supplementText | 补充内容 | 多行文本 |
| isDemo | Demo数据标记 | 复选框 |

### 05_AI分析记录（建议拆分）

| Web 来源 | 飞书字段 | 类型 |
|---|---|---|
| FaultEvent.code | 关联故障事件 | 关联 04_故障事件 |
| analysisVersion | 分析版本 | 数字 |
| aiSummary | AI标准化摘要 | 多行文本 |
| aiFaultCategory | 故障类别建议 | 单选 |
| aiPrioritySuggestion | 紧急度建议 | 单选 |
| aiConfidence | AI置信度 | 单选 |
| missingFields | 缺失字段 | 多选 |
| followUpQuestions | 定向追问 | 多行文本 |
| aiResultJson | AI原始JSON | 多行文本 |
| requiresHumanReview | 是否强制人工复核 | 复选框 |

### 06_派单与SLA规则

| Web 字段 | 飞书字段 | 类型 |
|---|---|---|
| code | 规则ID | 文本，唯一 |
| name | 规则名称 | 文本 |
| enabled | 是否启用 | 复选框 |
| priority | 优先级 | 数字，越小越高 |
| assetCategories | 适用设备类别 | 多选 |
| faultCategories | 适用故障类别 | 多选 |
| riskTags | 风险标签条件 | 多选 |
| warrantyCondition | 保修条件 | 单选 |
| regions | 区域条件 | 多选 |
| responsibilityPartyId | 推荐责任方 | 关联 03_供应商与责任方 |
| priorityLevel | 最终紧急度 | 单选 |
| acceptanceSlaSeconds | 接单SLA秒数 | 数字；飞书界面可换算分钟 |
| requiresHumanReview | 是否强制人工复核 | 复选框 |
| explanation | 规则说明 | 多行文本 |

### 07_维修工单中心

| Web 字段 | 飞书字段 | 类型 |
|---|---|---|
| code | 工单ID | 文本/自动编号 |
| faultEventId | 关联故障事件 | 关联 04_故障事件 |
| assetId | 关联设备 | 关联 02_设备台账 |
| finalFaultCategory | 最终故障类别 | 单选 |
| finalPriority | 最终紧急度 | 单选 |
| recommendedPartyId | 推荐责任方 | 关联 03_供应商与责任方 |
| finalPartyId | 最终责任方 | 关联 03_供应商与责任方 |
| routeExplanation | 路由原因 | 多行文本 |
| manuallyReviewed | 是否人工确认 | 复选框 |
| manualReviewReason | 人工确认原因 | 多行文本 |
| status | 当前业务状态 | 单选 |
| slaStatus | SLA状态 | 单选 |
| dispatchedAt | 派发时间 | 日期时间 |
| acceptanceDeadline | 接单截止时间 | 日期时间 |
| acceptedAt | 接单时间 | 日期时间 |
| repairStartedAt / repairCompletedAt | 维修开始/完成 | 日期时间 |
| acceptanceAt / closedAt | 验收/关闭 | 日期时间 |
| returnCount | 返修次数 | 数字 |
| repeatedFault | 是否重复故障 | 复选框 |
| isDemo | Demo数据标记 | 复选框 |

## 建议视图

- 门店：我的工单、待补充、处理中、待验收、已关闭；
- 维修管理：待人工确认、超时未接单、拒单、返修、全部异常；
- 供应商：待接单、处理中、返修中、待提交结果；
- 运营：P1、已超时、返修、重复故障、按责任方分组；
- 设备台账：异常设备、维修中、保修即将到期、疑似重复故障。

## 建议按钮

| 按钮 | 前置条件 | 主要动作 |
|---|---|---|
| 提交人工确认 | 状态=待人工确认，原因完整 | 写最终类别/等级/责任方，记录日志 |
| 派发工单 | 最终责任方有效 | 状态=待接单，计算截止时间并通知 |
| 接单 | 状态=待接单 | 记录接单时间，状态进入处理中 |
| 拒单 | 已填写固定拒单原因 | 状态=待人工确认，通知维修管理 |
| 开始维修 | 状态=处理中 | 写维修开始时间 |
| 提交维修完成 | 原因和动作完整 | 状态=待验收，通知门店 |
| 验收通过 | 验收项完成 | 状态=已关闭，写设备履历 |
| 验收不通过 | 原因完整 | 状态=返修中，返修次数 +1 |

## 建议自动化

1. 新故障事件触发 AI 结构化；
2. AI JSON 校验并新增分析版本；
3. 关键字段缺失时转待补充并通知门店；
4. 低置信度、高风险、设备冲突或无唯一规则时转人工；
5. 信息完整且规则唯一时创建并派发工单；
6. 派发后按 P1/P2/P3 计算接单截止；
7. 即将超时提醒责任方；
8. 已超时通知维修管理，P1 同时升级运营；
9. 供应商拒单通知维修管理；
10. 维修完成通知门店验收；
11. 验收通过关闭并更新设备状态；
12. 验收不通过进入返修并通知原责任方；
13. 每次状态/责任变化新增状态事件；
14. 关闭时按企业确认窗口检查重复故障。

## 需要开放平台或真实凭证的功能

- 飞书用户身份、组织架构和门店权限；
- 外部供应商账号或外部协作权限；
- 飞书消息卡片、机器人或群消息发送；
- 多维表格记录新增、更新与定时扫描；
- 附件真实上传和下载；
- Web Demo 与多维表格双向同步；
- 企业大模型或飞书 AI 节点调用；
- 应用 ID、App Secret、Tenant Access Token、Webhook。

凭证必须通过环境变量或企业密钥系统配置，不得写入代码、CSV 或本文档。
