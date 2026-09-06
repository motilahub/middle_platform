const systemColumns = 'system_title,browser_title,system_logo,system_logo_original,title_logo,title_logo_original,login_text,footer_record,show_workbench_header,show_ai_chat_header,ai_chat_welcome,ai_chat_first_prompt_count,ai_chat_max_rounds,ai_chat_followup_count,ai_chat_robot_icon,ai_chat_robot_icon_original,ai_chat_theme,ai_chat_effects,updated_at'
const securityColumns = 'api_rate_limit_per_minute,password_min_length,password_require_uppercase,password_require_lowercase,password_require_special,password_require_number,updated_at'

export function createSettingsRepository(pool) {
  return {
    readSystem() { return pool.query(`SELECT ${systemColumns} FROM system_settings WHERE id=1`).then((result) => result.rows[0]) },
    updateSystem(values) { return pool.query(`UPDATE system_settings SET system_title=$1,browser_title=$2,system_logo=$3,system_logo_original=$4,title_logo=$5,title_logo_original=$6,login_text=$7,footer_record=$8,show_workbench_header=$9,show_ai_chat_header=$10,updated_at=NOW() WHERE id=1 RETURNING ${systemColumns}`, values).then((result) => result.rows[0]) },
    readAiChat() { return pool.query(`SELECT ai_chat_welcome,ai_chat_first_prompt_count,ai_chat_max_rounds,ai_chat_followup_count,ai_chat_robot_icon,ai_chat_robot_icon_original,ai_chat_theme,ai_chat_effects,updated_at FROM system_settings WHERE id=1`).then((result) => result.rows[0]) },
    updateAiChat(values) { return pool.query(`UPDATE system_settings SET ai_chat_welcome=$1,ai_chat_first_prompt_count=$2,ai_chat_max_rounds=$3,ai_chat_followup_count=$4,ai_chat_robot_icon=$5,ai_chat_robot_icon_original=$6,ai_chat_theme=$7,ai_chat_effects=$8,updated_at=NOW() WHERE id=1 RETURNING ${systemColumns}`, values).then((result) => result.rows[0]) },
    readSecurity() { return pool.query(`SELECT ${securityColumns} FROM system_settings WHERE id=1`).then((result) => result.rows[0]) },
    updateSecurity(values) { return pool.query(`UPDATE system_settings SET api_rate_limit_per_minute=$1,password_min_length=$2,password_require_uppercase=$3,password_require_lowercase=$4,password_require_special=$5,password_require_number=$6,updated_at=NOW() WHERE id=1 RETURNING ${securityColumns}`, values).then((result) => result.rows[0]) },
  }
}
