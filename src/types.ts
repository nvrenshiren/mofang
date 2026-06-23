/**
 * 应用级跨层类型 —— 不属于任何单一层的共享枚举/常量
 *
 * 入此文件的标准: 被 input / store / ui 中 2 个或以上层共用
 * 不要往这里堆业务逻辑, 这只是个类型出口
 */

/**
 * 三种应用模式
 *   - training: 默认, 锁视角, 全套辅助 UI
 *   - free:     自由相机, 全套辅助 UI
 *   - challenge: 实战模拟, 15s 观察 + 计时, 隐藏所有辅助
 */
export type AppMode = 'training' | 'free' | 'challenge'
