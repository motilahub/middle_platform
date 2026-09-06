export function mapUser(row) {
  return {
    id: Number(row.id), uuid: row.uuid, code: row.code, name: row.name, avatar: row.avatar_thumbnail || row.avatar || undefined, avatarOriginal: row.avatar_original || undefined, role: row.role,
    groups: row.groups || [], permissions: row.permissions || [],
  }
}

export function mapApp(row) {
  return {
    id: Number(row.id), code: row.code, name: row.name, priority: row.priority,
    url: row.url, enabled: row.enabled, categoryId: row.category_id ? Number(row.category_id) : undefined,
    categoryCode: row.category_code || undefined, categoryName: row.category_name || undefined,
    categoryPriority: row.category_priority === null || row.category_priority === undefined ? undefined : Number(row.category_priority),
    img: row.image_original || undefined,
    imgThumbnail: row.image_thumbnail || undefined, imgFileName: row.image_filename || undefined,
    outboundSsoConfigId: row.outbound_sso_config_id ? Number(row.outbound_sso_config_id) : undefined,
    visibility: row.visibility || 'public',
    userIds: (row.user_ids || []).map(Number),
  }
}

export function mapSystemSettings(row) {
  return {
    systemTitle: row.system_title,
    browserTitle: row.browser_title,
    systemLogo: row.system_logo || undefined,
    systemLogoOriginal: row.system_logo_original || row.system_logo || undefined,
    titleLogo: row.title_logo || undefined,
    titleLogoOriginal: row.title_logo_original || row.title_logo || undefined,
    loginText: row.login_text,
    footerRecord: row.footer_record || undefined,
    showWorkbenchHeader: !!row.show_workbench_header,
    showAiChatHeader: row.show_ai_chat_header !== false,
    aiChatWelcome: row.ai_chat_welcome || '你好，我是通用助手，有什么可以帮你？',
    aiChatFirstPromptCount: Number(row.ai_chat_first_prompt_count ?? 3),
    aiChatMaxRounds: Number(row.ai_chat_max_rounds ?? 20),
    aiChatFollowupCount: Number(row.ai_chat_followup_count ?? 3),
    aiChatRobotIcon: row.ai_chat_robot_icon || undefined,
    aiChatRobotIconOriginal: row.ai_chat_robot_icon_original || row.ai_chat_robot_icon || undefined,
    aiChatTheme: row.ai_chat_theme || 'light',
    aiChatEffects: row.ai_chat_effects !== false,
    updatedAt: row.updated_at,
  }
}

export function mapSecuritySettings(row) {
  return {
    apiRateLimitPerMinute: Number(row.api_rate_limit_per_minute),
    passwordMinLength: Number(row.password_min_length),
    passwordRequireUppercase: !!row.password_require_uppercase,
    passwordRequireLowercase: !!row.password_require_lowercase,
    passwordRequireSpecial: !!row.password_require_special,
    passwordRequireNumber: !!row.password_require_number,
    updatedAt: row.updated_at,
  }
}
