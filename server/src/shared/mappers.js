export function mapUser(row) {
  return {
    id: Number(row.id), uuid: row.uuid, code: row.code, name: row.name, role: row.role,
    groups: row.groups || [], permissions: row.permissions || [],
  }
}

export function mapApp(row) {
  return {
    id: Number(row.id), code: row.code, name: row.name, priority: row.priority,
    url: row.url, enabled: row.enabled, img: row.image_original || undefined,
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
    titleLogo: row.title_logo || undefined,
    loginText: row.login_text,
    footerRecord: row.footer_record || undefined,
    showWorkbenchHeader: !!row.show_workbench_header,
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
