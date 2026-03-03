export interface SettingDto {
  settingKey: string;
  settingValue: string;
  category: string;
  description?: string;
  encrypted?: boolean;
}

export interface UpdateSettingDto {
  settingValue: string;
}

export interface SettingResponse {
  id: string;
  settingKey: string;
  settingValue: string | null;
  category: string;
  description: string | null;
  encrypted: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BatchUpdateSettingsDto {
  settings: Array<{
    settingKey: string;
    settingValue: string;
  }>;
}
