# 不活了（afterme.space）· 重构说明

> 给 Cursor 的说明：本项目当前是一个单文件原型 `index.html`（原名「电子墓地」）。请按本文档把它重构为 **Vue 3 + Tailwind 前端 + Laravel + MySQL 后端** 的独立网站。
> **原型 `index.html` 是视觉、文案、动画和交互的唯一参考**：除本文档明确要求改动的地方，界面和玩法尽量 1:1 平移，不要自行重新设计。

---

## 0. 不要做的事（重要）

- 不要做限流（rate limiting / throttle）。
- 不要做内容审核、敏感词过滤。
- 不要用 WebSocket / Socket.IO / Pusher / Reverb，一律用轮询。
- 不要做注册、登录、邮箱、密码、第三方登录。只有匿名身份 + 还魂码。
- 删除原型里所有 Claude 平台相关代码：`window.claude`、`claude.use('db' | 'user' | 'room')`、`makeDbStore`、`makeLocalStore`（单机模式）、`initRoom`、`pushPresence` 里的 room 调用、`S.canWrite`、所有「协作者 / Contributor / 只有查看权限 / 单机模式」相关文案和分支。

---

## 1. 产品与命名

- 产品名：**不活了**；域名 **afterme.space**；副标题 / slogan 保留「先死为敬」。
- 把原型里所有「电子墓地」替换为「不活了」（`<title>`、顶栏 `.brand`、文案、邀请话术）。
- 首页 hero 大标题保留「先死为敬」，顶栏品牌字改为「不活了」。
- 玩法不变：
  - 新用户给自己办葬礼（登记 → 选碑选墓位 → 墓志铭 → 追悼会六幕 → 入土）。
  - 鬼白天（06:00–18:00）在棺材里，晚上（18:00–06:00）出棺夜游、改碑文、托梦。
  - 白天可以「诈尸」出棺 10 分钟，次数公开刻在碑上。
  - 活人（和别的鬼）可以给任意坟烧纸、留言；墓主晚上托梦回复；对方在「我的梦」里看梦。
  - 5 位原住民 NPC，烧纸后几秒自动托梦。

---

## 2. 技术栈与项目结构

- 单个 Laravel 项目同时托管前端（一台服务器、一个域名）。
- 后端：Laravel（最新稳定版）+ MySQL 8，字符集 **utf8mb4 / utf8mb4_unicode_ci**（留言、名字里会有 emoji）。
- 认证：Laravel Sanctum **个人访问令牌**（Bearer Token），不用 Cookie/CSRF 模式。
- 前端：Vue 3（`<script setup>` + TypeScript）+ Pinia + Vue Router（history 模式）+ Tailwind CSS，用 Laravel 自带的 Vite 插件打包。
- 前端放在 `resources/js`，Laravel 用一个 catch-all web 路由返回 SPA 入口页；接口全部在 `/api` 下。
- 所有时间在数据库里存 UTC。

建议目录（前端部分）：

```
resources/js/
  main.ts  App.vue  router.ts
  api/            client.ts（带 Bearer 的 fetch 封装）  types.ts
  stores/         session.ts  clock.ts  cemetery.ts  offerings.ts  presence.ts  pulse.ts
  config/         items.ts  styles.ts  causes.ts  epitaphs.ts  specialPlots.ts  funeralText.ts  dreamStyles.ts
  composables/    useDayNight.ts  useSound.ts  useCanvasScene.ts  useJossRain.ts  usePolling.ts
  components/
    layout/       TopBar.vue  ToastStack.vue  Modal.vue
    cemetery/     CemeteryView.vue  Hero.vue  GhostBar.vue  PlotGrid.vue  Plot.vue  StoneMini.vue  Ghost.vue
    tomb/         TombDrawer.vue  StoneBig.vue  Portrait.vue
    coffin/       CoffinView.vue  OfferingList.vue
    funeral/      FuneralOverlay.vue  StepRegister.vue  StepPick.vue  StepEpitaph.vue  Ceremony.vue
    modals/       BurnModal.vue  DreamComposer.vue  InboxModal.vue  DreamsModal.vue  InviteModal.vue
                  WealthModal.vue  EpitaphModal.vue  ZhashiModal.vue  ResurrectModal.vue  ResurrectCodeModal.vue
    effects/      BurnOverlay.vue  DreamOverlay.vue  JossCanvas.vue
  styles/         app.css（Tailwind 入口 + @layer components 里的手工美术样式）
```

原型函数 → 新位置对照：

| 原型 `index.html` | 新位置 |
|---|---|
| `ITEMS` `STYLES` `CAUSES` `EPITAPHS` `SPECIAL` `FACES` `DREAM_STYLES` | `config/*.ts` |
| `ADJ` `ADJ2` `ACHV` `ACHV2` `CATEG` `LASTACT` `EFFECT` `WISH` `VERDICTS` `COUPLETS`、`makeEulogy` | `config/funeralText.ts`（悼词仍在前端生成，作为字段提交给后端保存） |
| `NPCS` | 后端 seeder + `config/afterme.php`（见第 6 节），前端不再写死 |
| `Sound` | `composables/useSound.ts`（原样平移 WebAudio 合成） |
| `BG` | `composables/useCanvasScene.ts` |
| `Joss` | `composables/useJossRain.ts` + `effects/JossCanvas.vue` |
| `renderHeader` | `TopBar.vue` |
| `renderYard` `plotHTML` `positionGhosts` `renderPeers` `moveGhost` | `CemeteryView.vue` `PlotGrid.vue` `Plot.vue` `Ghost.vue` |
| `stoneMini` `stoneBig` `portraitHTML` | `StoneMini.vue` `StoneBig.vue` `Portrait.vue` |
| `renderDrawer` | `TombDrawer.vue` |
| `renderCoffin` `burnListHTML` | `CoffinView.vue` `OfferingList.vue` |
| `openBurn` `openDreamComposer` `openInbox` `openDreams` `openInvite` `openWealth` `openEpitaph` `openZhashi` | `modals/*.vue` |
| `burnAnimation` | `BurnOverlay.vue` |
| `openDream` `showDream` | `DreamOverlay.vue`（含白天「闭眼眯一会儿」） |
| `openFuneral` `renderFun` `renderCeremony` `runSilence` `typeEulogy` `runBurial` `saveTomb` | `funeral/*.vue` |
| `layoutPlots` | 删除：墓位改由数据库唯一约束保证，不再前端顺延 |
| 时间工具 `shichen` `isNightAt` `cnDate` `cnYear` `fmtDur` `mmss` `ago` `address` | `composables/useDayNight.ts` + `utils/` |

---

## 3. 视觉与样式（Tailwind）

- 字体不变：Ma Shan Zheng（毛笔标题）、Noto Serif SC（正文）、ZCOOL QingKe HuangYou（赛博碑），通过 Google Fonts 引入，保留原型里的回退字体栈。
- 颜色写成 CSS 变量，再在 `tailwind.config` 里引用为主题色：`ink` `ink-2` `stone` `bone` `bone-dim` `joss` `seal` `wisp` `line`。
- **白天 / 黑夜不要用 Tailwind 的 `dark:`**（它跟随系统主题）。在 `<html>` 上挂 `data-time="day" | "night"`，由 `useDayNight` 按真实时间切换，两套变量值照抄原型的 `:root` 和 `body.day`。
- 棺材内（`.coffinview`）和葬礼（`.fun`）各自固定一套配色，同样用局部 CSS 变量覆盖，照抄原型。
- 布局、间距、按钮、表单、弹窗、响应式用 Tailwind 工具类。
- 以下手工美术**不要硬写成工具类**，放进 `styles/app.css` 的 `@layer components`，从原型照抄：墓碑五种样式（`.stone.s-*` `.bigstone.s-*`）、遗像黑纱（`.portrait`）、棺材（`.coffin` `.lid`）、盖棺定论印章（`.verdict`）、挽联（`.couplet`）、蜡烛、化纸火盆、梦境、闭眼眼皮、所有 `@keyframes`。
- 保留 `prefers-reduced-motion` 处理：减少动态时关闭动画和 canvas 循环。

---

## 4. 身份：匿名 + 还魂码

### 4.1 匿名进入
- 前端启动时，`localStorage` 里有令牌就调用 `GET /api/me`；没有或返回 401，就调用 `POST /api/enter`，拿到新令牌存起来。
- 每次 `enter`、`me` 都带上浏览器时区（`Intl.DateTimeFormat().resolvedOptions().timeZone`），后端更新 `users.timezone` 和 `last_seen_at`。

### 4.2 还魂码
- **格式**：16 位，字母表 `23456789ABCDEFGHJKMNPQRSTUVWXYZ`（去掉 0 O 1 I L），分 4 组显示，前缀「黄泉-」只用于显示，例如 `黄泉-7K3M-9QXA-RT2W-C8NP`。
- **生成时机**：第一次下葬成功时生成，在「礼成」之后弹出 `ResurrectCodeModal` 只展示这一次，提示「请抄下你的还魂码，换手机或清了浏览器时用它回到自己的坟里」，提供「复制」按钮。
- **存储**：数据库只存 `HMAC-SHA256(规范化后的码, APP_KEY)`，存在 `users.resurrect_code_hash`（唯一索引），这样既能查找又不存明文。
- **规范化**：去掉「黄泉」前缀、连字符、空格，转大写。
- **找回**：`POST /api/resurrect`，传入码，匹配到用户就签发新令牌返回；前端替换本地令牌并重新加载数据。入口放在：首页 hero 下方小字链接「我死过，回到我的坟」，以及「我的梦」弹窗底部。
- **重新生成**：自己的坟详情里提供「重新生成还魂码」，旧码立即失效，新码同样只展示一次。
- 不做限流，靠 16 位长度防猜（约 79 位熵）。

### 4.3 孤坟
- 非 NPC 坟的墓主 `last_seen_at` 早于 30 天前，接口返回 `is_orphan: true`。
- 前端在墓碑详情和墓位上显示「孤坟」标记；仍可烧纸，墓主回来后标记自动消失。

---

## 5. 数据库

### users
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigint PK | |
| timezone | varchar(64) | IANA 时区，默认 `Asia/Shanghai` |
| resurrect_code_hash | char(64) null, unique | 见 4.2 |
| last_seen_at | datetime | |
| timestamps | | |

外加 Sanctum 的 `personal_access_tokens` 表。

### tombs
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigint PK | |
| user_id | bigint null, unique, FK users | 一人一坟；NPC 为 null |
| is_npc | bool | |
| npc_key | varchar(32) null, unique | `laowang` `coder` `juanwang` `wuming` `afei` |
| code | varchar(16) unique | 墓址码，6 位小写字母数字；NPC 用 npc_key |
| name | varchar(8) | 最多 8 个字（按字符数校验） |
| birth_year | smallint | 1900–当前年份 |
| cause | varchar(12) | 死因 |
| portrait | tinyint | 0–5，对应 `FACES` |
| last_words | varchar(40) null | |
| style | enum(qingshi, hanbai, neon, tubao, mupai) | |
| plot | int unsigned, unique | 墓位号，从 0 开始，按 6 列编号：第 `floor(p/6)+1` 排第 `p%6+1` 号 |
| epitaph | varchar(40) | |
| epitaph_edits | int | |
| eulogy | text | 前端生成的悼词 |
| verdict | varchar(16) | 盖棺定论 |
| couplet | tinyint | 挽联序号 |
| zhashi_count | int | |
| zhashi_until | datetime null | |
| knock_count | int | |
| last_knock_at | datetime null | 用于让坟前的人看到「碑晃了」 |
| funerals | int | 办过几次葬礼 |
| died_at | datetime | |
| timestamps | | `updated_at` 用于墓园列表的版本判断 |

### offerings（烧纸）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigint PK | |
| tomb_id | FK tombs | 烧给谁 |
| user_id | FK users | 谁烧的 |
| from_name | varchar(12) | 落款，空则存「一位路过的活人」 |
| message | varchar(120) null | 留言 |
| created_at | datetime | |

### offering_items
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigint PK | |
| offering_id | FK offerings | |
| item_key | varchar(16) | 只能是 `config/items` 里的 13 个 key 之一 |
| qty | tinyint unsigned | 1–99 |

### dreams（托梦）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigint PK | |
| offering_id | FK offerings, unique | 一次烧纸只托一个梦（与原型一致） |
| tomb_id | FK tombs | 谁托的 |
| to_user_id | FK users | 托给谁（= 烧纸人） |
| text | varchar(120) | |
| style | enum(plain, warm, scary, mystic) | |
| visible_at | datetime | 普通托梦 = 创建时间；NPC 自动托梦 = 创建时间 + 6~11 秒 |
| read_at | datetime null | |
| created_at | datetime | |

### presences（在线状态，替代原型的 room）
| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | PK, FK users | |
| mode | enum(ghost, coffin, living) | |
| plot | int null | 鬼当前所在墓位 |
| viewing_tomb_id | bigint null | 正在看哪座坟 |
| seen_at | datetime | 超过 60 秒视为离线 |

---

## 6. NPC 原住民

- 写一个 seeder，把原型 `NPCS` 里的 5 位按原数据写入 tombs（`is_npc = true`，墓位 5 / 11 / 16 / 22 / 25，`died_at`、`birth_year`、`epitaph`、`style`、`portrait`、`last_words` 照抄）。
- 每位 NPC 的 3 条托梦文案放在 `config/afterme.php` 的 `npc_dreams[npc_key]`。
- 给 NPC 烧纸时，后端在同一个事务里自动创建一条 dream：随机挑一条文案，style 在 plain / warm / mystic 里随机，`visible_at = now + rand(6, 11) 秒`。
- 与原型不同：NPC 的香火现在是全站共享的（大家都能看到老王收了多少），去掉原型里「原住民只记得你烧的」这句文案。

---

## 7. 业务规则（后端负责判断，前端同步展示）

- **白天 / 黑夜**：按**墓主**的 `users.timezone` 判断，18:00–次日 06:00 为夜。
- **出棺（ghost_out）** = 有坟且（夜里 或 `zhashi_until > now`）。
- **诈尸**：只能在白天、有坟时调用；`zhashi_count + 1`，`zhashi_until = now + 10 分钟`。
- **改碑文**：仅 ghost_out 时允许；`epitaph_edits + 1`；内容没变就不写库。
- **托梦**：只有被烧纸那座坟的墓主能回；墓主必须 ghost_out；每次烧纸只能托一个梦（已存在则 409）。
- **敲棺材板**：任何时间都可以；`knock_count += count`，`last_knock_at = now`。前端连敲时攒 1.5 秒合并成一次请求（同原型 `flushKnocks`）。
- **办葬礼 / 重办葬礼**：没坟就新建，有坟就覆盖登记信息，保留 `knock_count`、`zhashi_count`、`code`，`funerals + 1`，`epitaph_edits` 归零，`zhashi_until` 清空，`died_at = now`。
- **墓位冲突**：plot 有唯一约束。选到已占用的墓位返回 409 和提示「这块刚被人占了」，前端刷新墓位表让用户重选（替代原型的自动顺延）。
- **墓位范围**：最少 30 个（5 排 × 6 列）；已用墓位接近上限时自动多显示一排。墓位总数由前端根据已占用的最大墓位号计算。
- **特殊墓位**名字照抄原型 `SPECIAL`：0 VIP 靠门位、3 风水宝地、8 学区墓、14 江景（看得见排水沟）、20 朝南 · 采光好、27 网红打卡位。
- **留言隐私**：`message` 只返回给该坟的墓主和这次烧纸的人；其他人看坟详情时只看到香火统计（各物品总数、祭拜次数、最近一次时间）。
- **给自己烧纸**：允许（原型里的「给自己烧点」），之后可以在香火簿里给自己托梦。
- **校验**：只做长度、枚举、范围这类格式校验（名字 ≤ 8 字、死因 ≤ 12、遗言 ≤ 40、碑文 ≤ 40、留言 ≤ 120、落款 ≤ 12、托梦 ≤ 120，至少烧 1 件，物品 key 合法，数量 1–99）。不做限流和审核。

---

## 8. 接口

所有接口前缀 `/api`，除 `enter` 和 `resurrect` 外都需要 `Authorization: Bearer <token>`。返回 JSON，字段统一用 snake_case。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/enter` | `{timezone}` → `{token, user}`，新建匿名用户 |
| GET | `/me` | `?timezone=` → `{user, tomb|null, is_night, ghost_out}` |
| POST | `/resurrect` | `{code}` → `{token, user}`；码不对返回 404「这串还魂码对不上」 |
| GET | `/tombs` | 墓园全部坟（含 NPC）：id, code, name, cause, style, portrait, plot, is_npc, is_orphan, hot（24 小时内有人烧纸） |
| GET | `/tombs/{code}` | 坟详情：上面字段 + birth_year, died_at, last_words, epitaph, epitaph_edits, zhashi_count, knock_count, funerals, item_totals, offering_count, last_offering_at |
| POST | `/me/tomb` | 办 / 重办葬礼：name, birth_year, cause, portrait, last_words, style, plot, epitaph, eulogy, verdict, couplet → `{tomb, resurrect_code?}`（首次下葬时返回明文还魂码） |
| PATCH | `/me/tomb/epitaph` | `{epitaph}` |
| POST | `/me/tomb/zhashi` | → 新的 zhashi_count / zhashi_until |
| POST | `/me/tomb/knock` | `{count}` |
| POST | `/me/resurrect-code` | 重新生成 → `{resurrect_code}` |
| POST | `/tombs/{code}/offerings` | `{items: {key: qty}, message, from_name}` → offering |
| GET | `/me/inbox` | 香火簿：烧给我的全部纸，含 message、items、是否已托梦和托梦内容，按时间倒序 |
| POST | `/offerings/{id}/dream` | `{text, style}` |
| GET | `/me/dreams` | 我烧过的纸 + 对方的托梦（只返回 `visible_at <= now` 的梦） |
| POST | `/dreams/{id}/read` | 标记已读 |
| POST | `/pulse` | 轮询 + 心跳，见第 9 节 |

---

## 9. 轮询（替代原型的实时推送）

### 9.1 请求
`POST /api/pulse`，body：

```
{ since: <上次 pulse 返回的 now>, mode: "ghost"|"coffin"|"living", plot: <鬼所在墓位或 null>, viewing_tomb_id: <打开的坟或 null> }
```

后端先 upsert 自己的 presences 记录，再返回。

### 9.2 返回
```
{
  now,                       // 服务器 UTC 时间，下次作为 since
  is_night, ghost_out,       // 按我的时区计算
  tombs_version,             // tombs 表最大 updated_at；变了前端就重新拉 /tombs
  new_offerings: [...],      // since 之后烧给我的纸（不含我自己烧的）
  new_dreams: [...],         // since 之后对我可见的托梦（visible_at 落在区间内）
  pending_dreams_count,      // 香火簿里待托梦数量（顶栏角标）
  unread_dreams_count,       // 我的梦未读数（顶栏角标）
  viewing_tomb: { id, last_knock_at, knock_count } | null,
  ghosts: [{ tomb_id, name, plot }],   // 60 秒内在线、mode=ghost 的其他人
  living_count               // 60 秒内在线的活人数（不含自己）
}
```

### 9.3 节奏
- 页面不可见（`document.hidden`）时停止；恢复可见立刻发一次。
- 默认每 25 秒一次。
- 打开了墓碑详情，或者自己是鬼且在墓园里夜游时：每 5 秒一次。
- 鬼移动墓位后，下一次 pulse 立即发送（防抖 500ms），不等定时器。

### 9.4 前端如何使用返回
- `new_offerings`：toast「（在棺材里时加前缀：头顶传来烧纸声……）XXX 给你烧了 …」，同原型 `onBurns`。
- `new_dreams`：toast「XXX 给你托梦了」+「去做梦」按钮，同原型 `notifyReplies`（托给自己的梦不弹）。
- `viewing_tomb.last_knock_at` 比上次记录的新：墓碑大图播放 `shake`，toast「棺材里传来“咚、咚、咚”的声音……」，播放敲击音效。
- `ghosts`：在对应墓位上画别人的鬼火和名字（原型 `renderPeers`）；位置会每 5 到 25 秒跳一次，加上 0.9 秒的过渡动画就够了。
- `living_count` 和鬼的数量显示在墓园统计行「此刻在场：活人 N · 鬼 N」。
- `is_night` / `ghost_out` 变化时切换视图，并弹出原型里那几条提示（天黑了 / 天亮了 / 被晒回棺材）。前端本地也每秒计时，用于倒计时显示，以服务器返回为准纠偏。

---

## 10. 前端需要改动的文案和行为

- 「电子墓地」→「不活了」。
- 邀请话术改为带链接：`我在「不活了」提前死了一下，坟在第 X 排第 Y 号，死因「…」。来给我烧点纸：https://afterme.space/t/{code} ，我晚上会托梦回你。` 邀请弹窗里去掉「分享 / 协作者权限」的步骤说明，只保留这段话和「复制」按钮。
- 路由改为 history 模式：`/` 墓园，`/t/:code` 打开对应坟的详情抽屉，`/funeral` 打开葬礼。替代原型的 `#tomb-xxx` 和 `#funeral`。
- 首页 hero 加「我死过，回到我的坟」入口（还魂）。
- 「我的梦」弹窗底部加一句：「换设备会丢失你的梦。想留住，就先办一场葬礼拿到还魂码。」并放还魂入口。
- 葬礼「入住新家」成功后：首次下葬先弹还魂码，关掉后再按白天 / 黑夜进入棺材或墓园（同原型 `saveTomb`）。
- 错误提示统一为：「阴间服务器开小差了，请稍后再试。」409 时用具体提示（墓位被占、已经托过梦）。
- 删除：单机模式提示条、所有权限不足的提示和按钮禁用逻辑、`canBurn` 中的权限判断（现在只要有令牌就能烧纸）。

---

## 11. 验收清单

1. 新开浏览器打开首页：自动拿到匿名令牌，能看到 5 位原住民和空墓位，白天 / 黑夜配色与当地时间一致。
2. 完整办一场葬礼，追悼会六幕和音效、纸钱雨都正常；礼成后弹出 16 位还魂码。
3. 白天进入棺材：倒计时正确，敲棺材板、翻身、数家当、诈尸可用；诈尸后碑上出现「白天诈尸 1 次」，10 分钟后自动被晒回棺材。
4. 另一个浏览器（另一个匿名用户）打开 `/t/{code}`，烧纸留言；墓主 25 秒内收到提示，香火簿里能看到留言；第三个用户看这座坟时看不到留言内容。
5. 墓主晚上（或把时区设到夜里）托梦；烧纸人收到提示，打开后看到梦（白天会先闭眼）；玄学梦显示彩票号码。
6. 坟前的人看着墓碑时，墓主敲棺材板，5 秒左右墓碑晃动。
7. 晚上两个鬼同时在墓园里，能互相看到对方的鬼火和名字。
8. 给 NPC 烧纸，6 到 11 秒后收到托梦；所有人都能看到 NPC 的香火统计。
9. 清空浏览器数据后用还魂码找回：坟、香火簿、我的梦都还在；重新生成还魂码后旧码失效。
10. 两个人同时抢同一个墓位，后提交的人收到「这块刚被人占了」。
11. 手机宽度（390px）下墓园三列、抽屉变成底部弹层，所有弹窗可正常操作。
12. 留言和名字里的 emoji 能正常保存和显示。
