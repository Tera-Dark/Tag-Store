/**
 * 简单的加密/解密函数 (基础安全性)
 * 注意：这种客户端加密提供的是有限的保护，不能防止确定的攻击者
 */

// 加密密钥 (实际应用中应该设置为应用特定的复杂字符串)
const ENCRYPTION_KEY = 'tagstore-secure-key-20231215';

/**
 * 安全存储工具
 */
export const secureStore = {
  /**
   * 加密数据
   * @param value 要加密的值
   * @returns 加密后的字符串
   */
  encrypt(value: string): string {
    if (!value) return '';
    
    try {
      // 简单的XOR加密
      let result = '';
      for (let i = 0; i < value.length; i++) {
        const charCode = value.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
        result += String.fromCharCode(charCode);
      }
      // 转为Base64编码
      return btoa(result);
    } catch (e) {
      console.error('加密失败:', e);
      return '';
    }
  },
  
  /**
   * 解密数据
   * @param encrypted 加密后的字符串
   * @returns 解密后的原始值
   */
  decrypt(encrypted: string): string {
    if (!encrypted) return '';
    
    try {
      // 从Base64解码
      const decoded = atob(encrypted);
      // 应用相同的XOR算法解密
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
        result += String.fromCharCode(charCode);
      }
      return result;
    } catch (e) {
      console.error('解密失败:', e);
      return '';
    }
  },
  
  /**
   * 安全地存储数据到localStorage
   * @param key 存储键名
   * @param value 要存储的值
   */
  setItem(key: string, value: string): void {
    if (!key || value === undefined) return;
    
    try {
      const encryptedValue = this.encrypt(value);
      localStorage.setItem(key, encryptedValue);
    } catch (e) {
      console.error('安全存储失败:', e);
    }
  },
  
  /**
   * 安全地从localStorage获取数据
   * @param key 存储键名
   * @returns 解密后的数据，失败时返回空字符串
   */
  getItem(key: string): string {
    if (!key) return '';
    
    try {
      const encryptedValue = localStorage.getItem(key);
      if (!encryptedValue) return '';
      
      return this.decrypt(encryptedValue);
    } catch (e) {
      console.error('安全获取数据失败:', e);
      return '';
    }
  },
  
  /**
   * 从localStorage删除指定键的数据
   * @param key 要删除的键名
   */
  removeItem(key: string): void {
    if (!key) return;
    
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('删除存储项失败:', e);
    }
  },
  
  /**
   * 存储对象数据（自动序列化为JSON）
   * @param key 存储键名
   * @param value 要存储的对象
   */
  setObject<T>(key: string, value: T): void {
    if (!key || value === undefined) return;
    
    try {
      const jsonString = JSON.stringify(value);
      this.setItem(key, jsonString);
    } catch (e) {
      console.error('存储对象失败:', e);
    }
  },
  
  /**
   * 获取存储的对象数据（自动反序列化）
   * @param key 存储键名
   * @param defaultValue 默认值（如果获取失败）
   * @returns 解析后的对象
   */
  getObject<T>(key: string, defaultValue: T): T {
    if (!key) return defaultValue;
    
    try {
      const jsonString = this.getItem(key);
      if (!jsonString) return defaultValue;
      
      return JSON.parse(jsonString) as T;
    } catch (e) {
      console.error('获取对象失败:', e);
      return defaultValue;
    }
  }
}; 