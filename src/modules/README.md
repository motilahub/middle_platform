# 前端业务模块

本目录承载行业业务前端模块。每个模块应自包含页面、组件、API、类型和路由，并通过 `src/modules/registry.ts` 注册到统一应用壳。模块 `key` 必须唯一。

推荐结构：

```text
<module-key>/
├── pages/
├── components/
├── hooks/
├── api.ts
├── types.ts
├── routes.tsx
└── index.ts
```

模块不得直接依赖其他业务模块的内部文件；跨模块能力通过平台服务或公共包访问。

当前已注册的前端业务模块包括：

- `media-library`：豆瓣榜单影视库、选集与资源入口。
- `video-search`：影视资源搜索与网盘链接解析。
- `video-player`：浏览器直连的 HLS 和普通媒体播放器。

注册示例：

```ts
registerBusinessModule({
  key: 'education.sunny-class',
  routes: [<Route path="/education/sunny-class" element={<SunnyClassHome />} />],
})
```
