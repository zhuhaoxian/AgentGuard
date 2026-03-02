import { PolicyCondition } from './policy.types';

/**
 * 条件评估器
 * 用于评估策略条件是否满足
 */
export class ConditionEvaluator {
  /**
   * 评估单个条件
   */
  evaluate(
    data: any,
    field: string,
    operator: string,
    expectedValue: any
  ): boolean {
    const actualValue = this.getNestedValue(data, field);

    // 处理 null 值
    if (actualValue === null || actualValue === undefined) {
      return operator === 'isNull';
    }

    switch (operator.toLowerCase()) {
      case 'eq':
      case 'equals':
        return this.compareEquals(actualValue, expectedValue);
      case 'ne':
      case 'notequals':
        return !this.compareEquals(actualValue, expectedValue);
      case 'gt':
        return this.compareNumeric(actualValue, expectedValue) > 0;
      case 'gte':
      case 'ge':
        return this.compareNumeric(actualValue, expectedValue) >= 0;
      case 'lt':
        return this.compareNumeric(actualValue, expectedValue) < 0;
      case 'lte':
      case 'le':
        return this.compareNumeric(actualValue, expectedValue) <= 0;
      case 'contains':
        return String(actualValue).includes(String(expectedValue));
      case 'startswith':
        return String(actualValue).startsWith(String(expectedValue));
      case 'endswith':
        return String(actualValue).endsWith(String(expectedValue));
      case 'matches':
        return this.matchesPattern(String(actualValue), String(expectedValue));
      case 'in':
        return this.isInList(actualValue, expectedValue);
      case 'notin':
        return !this.isInList(actualValue, expectedValue);
      case 'isnull':
        return false; // actualValue is not null at this point
      case 'isnotnull':
        return true;
      default:
        console.warn('Unknown operator:', operator);
        return false;
    }
  }

  /**
   * 评估多个条件（支持 AND/OR 逻辑）
   */
  evaluateConditions(
    data: any,
    conditions: PolicyCondition[],
    logic: 'AND' | 'OR' = 'AND'
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    const results = conditions.map(condition =>
      this.evaluate(data, condition.field, condition.operator, condition.value)
    );

    if (logic === 'AND') {
      return results.every(result => result === true);
    } else {
      return results.some(result => result === true);
    }
  }

  /**
   * 获取嵌套字段的值
   * 支持路径如 "user.name" 或 "data.items[0].id"
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) {
      return undefined;
    }

    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[key];
    }, obj);
  }

  /**
   * 评估 URL 模式匹配
   */
  matchUrlPattern(url: string, pattern: string): boolean {
    if (!pattern) {
      return true;
    }

    try {
      // 支持通配符和正则表达式
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(url);
    } catch (error) {
      console.error('Invalid URL pattern:', pattern, error);
      return false;
    }
  }

  /**
   * 评估 HTTP 方法匹配
   */
  matchMethod(method: string, allowedMethods: string | string[]): boolean {
    if (!allowedMethods) {
      return true;
    }

    const methods = Array.isArray(allowedMethods) ? allowedMethods : [allowedMethods];
    return methods.includes(method.toUpperCase());
  }

  /**
   * 比较相等（支持数值和字符串）
   */
  private compareEquals(actual: any, expected: any): boolean {
    if (actual === null && expected === null) {
      return true;
    }
    if (actual === null || expected === null) {
      return false;
    }
    // 尝试数值比较
    if (this.isNumeric(actual) && this.isNumeric(expected)) {
      return this.compareNumeric(actual, expected) === 0;
    }
    return String(actual) === String(expected);
  }

  /**
   * 数值比较
   */
  private compareNumeric(actual: any, expected: any): number {
    const actualNum = this.toNumber(actual);
    const expectedNum = this.toNumber(expected);

    if (actualNum === null || expectedNum === null) {
      return String(actual).localeCompare(String(expected));
    }

    if (actualNum > expectedNum) return 1;
    if (actualNum < expectedNum) return -1;
    return 0;
  }

  /**
   * 检查是否为数值
   */
  private isNumeric(value: any): boolean {
    if (typeof value === 'number') {
      return !isNaN(value);
    }
    if (typeof value === 'string') {
      return !isNaN(Number(value)) && value.trim() !== '';
    }
    return false;
  }

  /**
   * 转换为数值
   */
  private toNumber(value: any): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    if (typeof value === 'string') {
      const num = Number(value);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  /**
   * 正则匹配
   */
  private matchesPattern(value: string, pattern: string): boolean {
    try {
      return new RegExp(pattern).test(value);
    } catch (error) {
      console.warn('Invalid regex pattern:', pattern);
      return false;
    }
  }

  /**
   * 检查值是否在列表中
   */
  private isInList(actual: any, expected: any): boolean {
    if (Array.isArray(expected)) {
      return expected.some(item => this.compareEquals(actual, item));
    }
    return this.compareEquals(actual, expected);
  }
}
