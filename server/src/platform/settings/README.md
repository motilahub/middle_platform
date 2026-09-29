# Settings

提供系统展示配置和安全策略配置。系统图片由独立图片存储适配器处理，更新安全策略时同步刷新公共限流和密码校验状态。

基础配置中的工作台通知存放在 `system_settings.workbench_notice`，由公开系统设置接口供工作台读取；只有具备 `platform.settings.write` 权限的用户可以维护。升级时由 `022_add_workbench_notice.sql` 添加可空字段，旧数据默认不展示；回退旧版本代码时可保留此字段，不影响既有设置。
