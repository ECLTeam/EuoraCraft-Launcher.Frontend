/**
 * 工具卡片内复选框的统一主题覆盖。
 *
 * 下载卡片的「允许覆盖已有文件」与头像裁剪的「包含帽子层」属于同一类选项，
 * 必须使用同一套字号、边框与选中色，避免两个卡片出现两种复选框样式。
 *
 * 对勾颜色由全局主题的 Checkbox 覆盖统一提供（与主按钮正文同色），
 * 这里不再单独指定，避免两处配置各自漂移。
 */
export const toolCheckboxTheme = {
  fontSizeMedium: '12px',
  textColor: 'var(--text-secondary)',
  color: 'var(--control-bg)',
  colorChecked: 'var(--primary)',
  border: '1px solid var(--control-border)',
  borderChecked: '1px solid var(--primary)',
  boxShadowFocus: 'var(--control-ring)',
}
