// pages/weighing/weighing.ts
import { BLEManager } from '../../utils/ble-manager';
import { strToGBKByte } from '../../utils/printUtil-GBK';

interface ScaleDevice {
  deviceId: string;
  name: string;
  weight: string;
  batteryLevel: number;
  connected: boolean;
  serviceId?: string;
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
  lastUpdateTime?: number;
  category?: string;  // 添加品类字段
}

interface CategoryPrice {
  name: string;
  price: number;
}

interface PageData {
  devices: ScaleDevice[];
  totalWeight: number;
  hasValidWeight: boolean;
  printerConnected: boolean;
  printerStatus: string;
  printerDeviceId: string;
  printerServiceId: string;
  printerCharacteristicId: string;
  categories: string[];  // 添加品类列表
  selectedCategory: string;  // 当前选中的品类
  selectedCategoryIndex: number;
  categoryPrices: CategoryPrice[];
  totalAmount: number;  // 添加总金额字段
  employees: string[];  // 添加员工列表
  selectedEmployee: string;  // 当前选中的员工
  selectedEmployeeIndex: number;
  showActionSheet: boolean;
  currentDeviceId: string;
}

Page({
  data: {
    devices: [],
    totalWeight: 0,
    hasValidWeight: false,
    printerConnected: false,
    printerStatus: '未连接',
    printerDeviceId: '',
    printerServiceId: '',
    printerCharacteristicId: '',
    categories: ['纸板', '矿泉水瓶', '铁', '拉罐', '铝合金', '塑料杂料', '洗衣液瓶类','织物类(非黑料)'],
    selectedCategory: '纸类',
    selectedCategoryIndex: 0,
    categoryPrices: [
      { name: '纸板', price: 1.0 },
      { name: '矿泉水瓶', price: 2.2 },
      { name: '铁', price: 1.0 },
      { name: '拉罐', price: 10.0 },
      { name: '铝合金', price: 12.0 },
      { name: '塑料杂料', price: 0.6 },
      { name: '洗衣液瓶类', price: 1.4 },
      { name: '织物类(非黑料)', price: 1.2 }
    ],
    totalAmount: 0,
    employees: ['苏小龙', '魏强', '刘豪', '冉永平', '王一诺', '邓杰元'],
    selectedEmployee: '',
    selectedEmployeeIndex: 0,
    showActionSheet: false,
    currentDeviceId: '',
  },

  bleManager: new BLEManager(),
  deviceTimers: new Map<string, any>(),
  weightUpdateInterval: 500, // 重量更新间隔（毫秒）
  weightTimeout: 3000, // 重量数据超时时间（毫秒）

  onLoad() {
    this.initBluetooth();
  },

  onUnload() {
    this.cleanupBluetooth();
    // 清理所有定时器
    this.deviceTimers.forEach(timer => {
      if (timer) clearInterval(timer);
    });
    this.deviceTimers.clear();
  },

  /**
   * 刷新按钮的点击处理函数
   */
  async onRefresh() {
    wx.showLoading({
      title: '正在刷新...',
      mask: true
    });

    try {
      // 关闭蓝牙适配器
      await wx.closeBluetoothAdapter();
      await this.sleep(1000); // 等待蓝牙完全关闭

      // 重新开启蓝牙适配器
      await wx.openBluetoothAdapter();
      await this.sleep(1000); // 等待蓝牙初始化完成

      // 清空当前设备列表
      this.setData({ 
        devices: [],
        totalWeight: 0,
        totalAmount: 0,
        hasValidWeight: false
      });

      // 重新初始化蓝牙并开始扫描
      await this.initBluetooth();

      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('刷新失败:', error);
      wx.showToast({
        title: '请重启蓝牙后重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 断开所有已连接的设备和打印机
   */
  async disconnectAllDevices() {
    const connectedDevices = this.data.devices.filter(device => device.connected);
    for (const device of connectedDevices) {
      await this.disconnectScale(device.deviceId, false); // 不显示提示
    }

    if (this.data.printerConnected) {
      await this.disconnectPrinter(false); // 不显示提示
    }
  },

  /**
   * 初始化蓝牙
   */
  async initBluetooth() {
    try {
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) {
        throw new Error('未获得必要的权限');
      }

      // 确保蓝牙适配器可用
      const state = await wx.getBluetoothAdapterState();
      if (!state.available) {
        throw new Error('当前蓝牙适配器不可用');
      }

      // 启动设备发现
      await wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false,
        interval: 500,
      });

      this.setupBLEListeners();
      this.connectPrinter(); // 开始后台连接打印机
    } catch (error) {
      console.error('蓝牙初始化失败:', error);
      wx.showModal({
        title: '蓝牙初始化失败',
        content: '请检查蓝牙是否开启，并重新授权位置权限',
        showCancel: false,
        success: () => {
          wx.openSetting();
        }
      });
    }
  },

  /**
   * 检查并请求必要的权限
   */
  async checkAndRequestPermissions(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.userLocation']) {
            // 已授权
            resolve(true);
          } else {
            // 未授权，尝试请求授权
            wx.authorize({
              scope: 'scope.userLocation',
              success: () => {
                resolve(true);
              },
              fail: () => {
                // 用户拒绝授权
                resolve(false);
              }
            });
          }
        },
        fail: () => {
          reject(new Error('获取权限设置失败'));
        }
      });
    });
  },

  /**
   * 开始蓝牙设备发现
   */
  startBluetoothDevicesDiscovery() {
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      interval: 500,
      success: () => {
        console.log('开始搜索蓝牙设备');
      },
      fail: (error) => {
        console.error('搜索设备失败:', error);
      }
    });
  },

  /**
   * 设置蓝牙监听器
   */
  setupBLEListeners() {
    // 监听新设备发现
    wx.onBluetoothDeviceFound((result) => {
      result.devices.forEach(newDevice => {
        console.log('扫描到设备:', newDevice);
        if (this.isScaleDevice(newDevice)) {
          // 检查设备是否已存在
          const existingDeviceIndex = this.data.devices.findIndex(
            device => device.deviceId === newDevice.deviceId
          );

          if (existingDeviceIndex === -1) {
            // 添加新设备
            const scaleDevice: ScaleDevice = {
              deviceId: newDevice.deviceId,
              name: newDevice.name || newDevice.localName || '未知设备',
              weight: '',
              batteryLevel: 0,
              connected: false
            };

            this.setData({
              devices: [...this.data.devices, scaleDevice]
            });

            console.log('添加新称重设备:', scaleDevice);

            // 自动连接新发现的设备
            this.connectScale(newDevice.deviceId);
          } else {
            console.log('设备已存在:', newDevice.deviceId);
          }
        } else {
          console.log('非称重设备，忽略:', newDevice.name || newDevice.localName || '未知设备');
        }
      });
    });

    // 监听特征值变化
    wx.onBLECharacteristicValueChange((result) => {
      const device = this.data.devices.find(d => d.deviceId === result.deviceId);
      if (!device) return;

      const dataStr = this.arrayBufferToString(result.value);
      console.log(`[接收] ${device.deviceId.slice(-8)} -> ${dataStr}`);

      // 解析重量数据
      const weightData = this.parseWeightData(dataStr);
      if (weightData) {
        console.log(`[解析成功] 重量: ${weightData.weight} kg, 电量: ${weightData.batteryLevel}/4`);
        device.weight = weightData.weight;
        device.batteryLevel = weightData.batteryLevel;
        device.lastUpdateTime = Date.now();
        this.setData({ devices: this.data.devices });
        this.updateTotalWeight();
      } else {
        console.log(`[解析失败] ${dataStr}`);
      }

      // 检查数据超时
      this.checkWeightTimeout(device.deviceId);
    });
  },

  /**
   * 判断是否为称重设备
   */
  isScaleDevice(device: any): boolean {
    const name = device.name || device.localName || '';
    console.log(`检查设备名称: ${name}`);
    // 根据实际设备名称调整过滤条件
    return name.includes('Scale') || name.includes('BLE') || name.includes('秤');
  },

  /**
   * 连接称重设备
   */
  async connectScale(deviceId: string) {
    try {
      await wx.createBLEConnection({ deviceId });
      console.log(`已连接设备: ${deviceId}`);

      // 获取设备服务
      const servicesRes = await wx.getBLEDeviceServices({ deviceId });
      console.log('设备服务:', servicesRes.services);

      // 完整的服务UUID
      const PRIMARY_SERVICE_UUID = "0000FFF0-0000-1000-8000-00805F9B34FB";
      const service = servicesRes.services.find(s => s.uuid.toUpperCase() === PRIMARY_SERVICE_UUID.toUpperCase()) || servicesRes.services.find(s => s.isPrimary);
      if (!service) throw new Error('未找到主服务');

      // 获取特征值
      const characteristicsRes = await wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId: service.uuid
      });
      console.log('设备特征值:', characteristicsRes.characteristics);

      // 输出特征值的UUID和属性
      characteristicsRes.characteristics.forEach(char => {
        console.log(`特征值 UUID: ${char.uuid}, 属性: ${JSON.stringify(char.properties)}`);
      });

      // 使用正确的特征值UUID
      const WRITE_CHARACTERISTIC_UUID = "0000FFF1-0000-1000-8000-00805F9B34FB";
      const NOTIFY_CHARACTERISTIC_UUID = "0000FFF1-0000-1000-8000-00805F9B34FB"; // FFF1 同时支持 notify 和 write

      // 查找可写特征值
      const writeCharacteristic = characteristicsRes.characteristics.find(char =>
        char.uuid.toUpperCase() === WRITE_CHARACTERISTIC_UUID.toUpperCase() &&
        (char.properties.write || char.properties.writeNoResponse)
      );
      if (!writeCharacteristic) throw new Error('未找到指定的可写特征值 UUID');

      // 查找可通知特征值
      const notifyCharacteristic = characteristicsRes.characteristics.find(char =>
        char.uuid.toUpperCase() === NOTIFY_CHARACTERISTIC_UUID.toUpperCase() &&
        char.properties.notify
      );
      if (!notifyCharacteristic) throw new Error('未找到指定的可通知特征值 UUID');

      // 更新设备信息
      const deviceIndex = this.data.devices.findIndex(d => d.deviceId === deviceId);
      if (deviceIndex !== -1) {
        const devices = [...this.data.devices];
        devices[deviceIndex] = {
          ...devices[deviceIndex],
          connected: true,
          serviceId: service.uuid,
          writeCharacteristicId: writeCharacteristic.uuid,
          notifyCharacteristicId: notifyCharacteristic.uuid,
          weight: '',
          batteryLevel: 0,
          lastUpdateTime: Date.now()
        };
        this.setData({ devices });

        console.log('更新设备信息:', devices[deviceIndex]);

        // 开始监听重量数据
        await this.startWeightMonitoring(deviceId, service.uuid, notifyCharacteristic.uuid);
      }
    } catch (error) {
      console.error(`连接设备 ${deviceId} 失败:`, error);
      const deviceIndex = this.data.devices.findIndex(d => d.deviceId === deviceId);
      if (deviceIndex !== -1) {
        const devices = [...this.data.devices];
        devices.splice(deviceIndex, 1); // 移除设备
        this.setData({ devices });
        this.updateTotalWeight();
        console.log(`设备 ${deviceId.slice(-8)} 已移除列表`);
      }
      // 重试连接
      setTimeout(() => this.connectScale(deviceId), 3000);
    }
  },

  /**
   * 开始重量监控
   */
  async startWeightMonitoring(deviceId: string, serviceId: string, notifyCharacteristicId: string) {
    try {
      // 启用特征值通知
      await wx.notifyBLECharacteristicValueChange({
        deviceId,
        serviceId,
        characteristicId: notifyCharacteristicId,
        state: true
      });
      console.log(`已启用设备 ${deviceId} 的通知`);

      // 定时发送称重指令
      const timer = setInterval(() => {
        console.log(`[发送] ${deviceId.slice(-8)} <- $WEI#`);
        this.sendWeighCommand(deviceId, serviceId, this.getWriteCharacteristicId(deviceId));
        this.checkWeightTimeout(deviceId);
      }, this.weightUpdateInterval);

      this.deviceTimers.set(deviceId, timer);
    } catch (error) {
      console.error(`启用设备 ${deviceId} 的通知失败:`, error);
    }
  },

  /**
   * 获取设备的可写特征值UUID
   */
  getWriteCharacteristicId(deviceId: string): string | undefined {
    const device = this.data.devices.find(d => d.deviceId === deviceId);
    return device?.writeCharacteristicId;
  },

  /**
   * 发送称重指令
   */
  async sendWeighCommand(deviceId: string, serviceId: string, writeCharacteristicId?: string) {
    if (!writeCharacteristicId) {
      console.error(`设备 ${deviceId} 未配置可写特征值 UUID`);
      return;
    }
    try {
      const command = '$WEI#';
      const buffer = new Uint8Array(command.split('').map(char => char.charCodeAt(0))).buffer;
      console.log(`[发送] ${deviceId.slice(-8)} <- ${command}`);

      await wx.writeBLECharacteristicValue({
        deviceId,
        serviceId,
        characteristicId: writeCharacteristicId,
        value: buffer
      });
    } catch (error) {
      console.log('发送称重指令失败:', error);
    }
  },

  /**
   * 解析重量数据
   * 假设数据格式为 "50088W22.5V4" 或 "50088W-0.1V4"
   */
  parseWeightData(data: string): { weight: string; batteryLevel: number } | null {
    try {
      const match = data.match(/(\d+)W(-?\d+\.?\d*)V(\d)/);
      if (match) {
        const [, , weight, batteryLevel] = match;
        return {
          weight: parseFloat(weight).toFixed(2),
          batteryLevel: parseInt(batteryLevel)
        };
      }
      return null;
    } catch (error) {
      console.error('解析重量数据失败:', error);
      return null;
    }
  },

  /**
   * 检查重量数据是否超时
   */
  checkWeightTimeout(deviceId: string) {
    const deviceIndex = this.data.devices.findIndex(d => d.deviceId === deviceId);
    if (deviceIndex === -1) return;

    const device = this.data.devices[deviceIndex];
    const now = Date.now();

    // 如果数据超时，断开连接并移除设备
    if (device.lastUpdateTime && (now - device.lastUpdateTime > this.weightTimeout)) {
      console.log(`设备 ${device.deviceId.slice(-8)} 重量数据超时，断开连接并移除设备`);
      this.disconnectScale(device.deviceId, false); // 不显示提示
    }
  },

  /**
   * 更新总重量和总金额
   */
  updateTotalWeight() {
    let total = 0;
    let totalAmount = 0;
    let hasValid = false;

    this.data.devices.forEach(device => {
      if (device.connected && device.weight) {  // 移除 device.category 检查
        const weight = parseFloat(device.weight);
        if (!isNaN(weight)) {
          total += weight;
          // 只有在有品类时才计算金额
          if (device.category) {
            const categoryPrice = this.data.categoryPrices.find(cp => cp.name === device.category);
            if (categoryPrice) {
              totalAmount += weight * categoryPrice.price;
            }
          }
          hasValid = true;
        }
      }
    });

    this.setData({
      totalWeight: parseFloat(total.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      hasValidWeight: hasValid
    });
    console.log(`更新总重量: ${this.data.totalWeight} kg, 总金额: ${this.data.totalAmount} 元`);
  },

  /**
   * 连接打印机
   */
  async connectPrinter() {
    try {
      await wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false
      });

      // 等待设备发现
      await this.sleep(3000);

      const devicesRes = await wx.getBluetoothDevices();
      console.log('扫描到的所有设备:', devicesRes.devices);

      // 目标MAC地址
      const TARGET_MAC = "714D30F6-5AB8-EC0B-BF12-20092D03F3BC";
      
      // 查找打印机设备，优先匹配MAC地址，其次匹配设备名称
      const printer = devicesRes.devices.find(device => {
        const name = device.name || device.localName || '';
        return device.deviceId === TARGET_MAC || 
               name.toUpperCase().includes('HM-A300') || 
               name.includes('8734');
      });

      if (!printer) {
        console.log('设备列表:', devicesRes.devices.map(d => ({
          name: d.name || d.localName,
          deviceId: d.deviceId
        })));
        throw new Error('未找到打印机设备');
      }

      console.log('找到打印机:', {
        name: printer.name || printer.localName,
        deviceId: printer.deviceId,
        RSSI: printer.RSSI
      });

      // 连接打印机
      await wx.createBLEConnection({ deviceId: printer.deviceId });
      console.log('打印机连接成功');

      // 获取服务
      const servicesRes = await wx.getBLEDeviceServices({ deviceId: printer.deviceId });
      console.log('打印机所有服务:', servicesRes.services);

      // 查找主服务 (FFF0)
      const service = servicesRes.services.find(s => 
        s.uuid.toUpperCase().includes('FFF0')
      );

      if (!service) throw new Error('未找到打印机主服务');
      console.log('找到打印机主服务:', service.uuid);

      // 获取特征值
      const characteristicsRes = await wx.getBLEDeviceCharacteristics({
        deviceId: printer.deviceId,
        serviceId: service.uuid
      });

      // 查找可写特征值 (FFF2)
      const writeCharacteristic = characteristicsRes.characteristics.find(char => 
        char.uuid.toUpperCase().includes('FFF2') && 
        (char.properties.write || char.properties.writeNoResponse)
      );

      if (!writeCharacteristic) throw new Error('未找到打印机可写特征值');
      console.log('找到可写特征值:', writeCharacteristic.uuid);

      this.setData({
        printerConnected: true,
        printerStatus: '已连接',
        printerDeviceId: printer.deviceId,
        printerServiceId: service.uuid,
        printerCharacteristicId: writeCharacteristic.uuid
      });

      console.log('打印机初始化完成');
    } catch (error) {
      console.error('打印机连接失败:', error);
      this.setData({
        printerConnected: false,
        printerStatus: '未连接'
      });
      wx.showToast({
        title: '打印机连接失败',
        icon: 'none'
      });
    } finally {
      wx.stopBluetoothDevicesDiscovery();
    }
  },

  /**
   * 断开打印机连接
   */
  async disconnectPrinter(showToast: boolean = true) {
    try {
      await wx.closeBLEConnection({ deviceId: this.data.printerDeviceId });
      this.setData({
        printerConnected: false,
        printerStatus: '未连接'
      });
      if (showToast) {
        wx.showToast({
          title: '打印机已断开',
          icon: 'success'
        });
      }
      console.log(`已断开打印机: ${this.data.printerDeviceId}`);
    } catch (error) {
      console.error('断开打印机失败:', error);
      if (showToast) {
        wx.showToast({
          title: '断开打印机失败',
          icon: 'none'
        });
      }
    }
  },

  /**
   * 打印重量信息
   */
  async printWeight() {
    if (!this.data.printerConnected) {
      wx.showToast({
        title: '打印机未连接',
        icon: 'none'
      });
      return;
    }

    try {
      // 初始化打印机
      const initCmd = new Uint8Array([0x1B, 0x40]);
      await wx.writeBLECharacteristicValue({
        deviceId: this.data.printerDeviceId,
        serviceId: this.data.printerServiceId,
        characteristicId: this.data.printerCharacteristicId,
        value: initCmd.buffer
      });
      await this.sleep(100);

      // 获取当前时间
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      // 准备打印数据
      let printContent = '\n';
      if (this.data.selectedEmployee) {
        printContent += `员工：${this.data.selectedEmployee}\n`;
      }
      if (this.data.selectedCategory) {
        printContent += `类别：${this.data.selectedCategory}\n`;
      }
      printContent += `总重量：${this.data.totalWeight} kg\n`;
      printContent += `总金额：${this.data.totalAmount} 元\n\n`;
      printContent += `时间：${timeStr}\n\n\n`;

      // 转换为GBK编码并分段发送
      const gbkBuffer = strToGBKByte(printContent);
      const CHUNK_SIZE = 20;
      
      for (let i = 0; i < gbkBuffer.byteLength; i += CHUNK_SIZE) {
        const chunk = gbkBuffer.slice(i, Math.min(i + CHUNK_SIZE, gbkBuffer.byteLength));
        await wx.writeBLECharacteristicValue({
          deviceId: this.data.printerDeviceId,
          serviceId: this.data.printerServiceId,
          characteristicId: this.data.printerCharacteristicId,
          value: chunk
        });
        await this.sleep(50);
      }

      wx.showToast({
        title: '打印成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('打印失败:', error);
      wx.showToast({
        title: '打印失败',
        icon: 'none'
      });
    }
  },

  /**
   * 将字符串转换为 ArrayBuffer
   */
  charToArrayBuffer(str: string): ArrayBuffer {
    const buffer = new ArrayBuffer(str.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
      view[i] = str.charCodeAt(i);
    }
    return buffer;
  },

  /**
   * 将 ArrayBuffer 转换为字符串
   */
  arrayBufferToString(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    let string = '';
    for (let i = 0; i < uint8Array.length; i++) {
      string += String.fromCharCode(uint8Array[i]);
    }
    return string;
  },

  /**
   * 清理蓝牙资源
   */
  async cleanupBluetooth() {
    // 先停止搜索
    await wx.stopBluetoothDevicesDiscovery();
    
    // 断开所有连接
    for (const device of this.data.devices) {
      if (device.connected) {
        try {
          await wx.closeBLEConnection({ deviceId: device.deviceId });
          console.log(`断开设备 ${device.deviceId} 连接`);
        } catch (error) {
          console.error(`断开设备 ${device.deviceId} 连接失败:`, error);
        }
      }
    }
    
    // 断开打印机连接
    if (this.data.printerConnected && this.data.printerDeviceId) {
      try {
        await wx.closeBLEConnection({ deviceId: this.data.printerDeviceId });
        console.log(`断开打印机 ${this.data.printerDeviceId} 连接`);
      } catch (error) {
        console.error(`断开打印机 ${this.data.printerDeviceId} 连接失败:`, error);
      }
    }

    // 清理监听器
    wx.offBluetoothDeviceFound();
    wx.offBLECharacteristicValueChange();
    
    // 清理定时器
    this.deviceTimers.forEach(timer => {
      if (timer) clearInterval(timer);
    });
    this.deviceTimers.clear();

    console.log('已清理所有蓝牙资源');
  },

  /**
   * 显示设备操作菜单
   */
  showDeviceActions(e: any) {
    const deviceId = e.currentTarget.dataset.deviceId;
    this.setData({
      showActionSheet: true,
      currentDeviceId: deviceId
    });
  },

  /**
   * 隐藏操作菜单
   */
  hideActionSheet() {
    this.setData({
      showActionSheet: false,
      currentDeviceId: ''
    });
  },

  /**
   * 阻止事件冒泡
   */
  preventDefault() {
    // 空函数，用于阻止事件冒泡
  },

  /**
   * 处理置零操作
   */
  async handleZero() {
    if (this.data.currentDeviceId) {
      await this.sendZeroCommand(this.data.currentDeviceId);
    }
    this.hideActionSheet();
  },

  /**
   * 处理删除操作
   */
  async handleDelete() {
    if (this.data.currentDeviceId) {
      await this.disconnectScale(this.data.currentDeviceId);
    }
    this.hideActionSheet();
  },

  /**
   * 断开称重设备连接并移除设备
   * @param deviceId 设备ID
   * @param showToast 是否显示提示（默认显示）
   */
  async disconnectScale(deviceId: string, showToast: boolean = true) {
    try {
      await wx.closeBLEConnection({ deviceId });
      console.log(`已断开设备: ${deviceId}`);

      // 移除设备
      const deviceIndex = this.data.devices.findIndex(d => d.deviceId === deviceId);
      if (deviceIndex !== -1) {
        const devices = [...this.data.devices];
        devices.splice(deviceIndex, 1); // 从数组中移除设备
        this.setData({ devices });
        this.updateTotalWeight();
        console.log(`设备 ${deviceId.slice(-8)} 已从列表中移除`);
      }

      // 清除定时器
      const timer = this.deviceTimers.get(deviceId);
      if (timer) {
        clearInterval(timer);
        this.deviceTimers.delete(deviceId);
        console.log(`已清除设备 ${deviceId.slice(-8)} 的定时器`);
      }

      if (showToast) {
        wx.showToast({
          title: '设备已断开',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error(`断开设备 ${deviceId} 失败:`, error);
      if (showToast) {
        wx.showToast({
          title: '断开设备失败',
          icon: 'none'
        });
      }
    }
  },

  /**
   * 发送置零命令
   */
  async sendZeroCommand(deviceId: string) {
    const device = this.data.devices.find(d => d.deviceId === deviceId);
    if (!device || !device.connected || !device.serviceId || !device.writeCharacteristicId) {
      console.error('设备未连接或配置不完整');
      return;
    }

    try {
      const command = '$CLE#';
      const buffer = new Uint8Array(command.split('').map(char => char.charCodeAt(0))).buffer;
      
      await wx.writeBLECharacteristicValue({
        deviceId: device.deviceId,
        serviceId: device.serviceId,
        characteristicId: device.writeCharacteristicId,
        value: buffer
      });

      console.log(`[发送置零指令] ${device.deviceId.slice(-8)} <- ${command}`);
      
      wx.showToast({
        title: '置零成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('发送置零指令失败:', error);
      wx.showToast({
        title: '置零失败',
        icon: 'none'
      });
    }
  },

  /**
   * 修改品类选择
   */
  handleCategoryChange(e: any) {
    const categoryIndex = parseInt(e.detail.value);
    const category = this.data.categories[categoryIndex];
    
    this.setData({
      selectedCategoryIndex: categoryIndex,
      selectedCategory: category
    });

    // 更新所有已连接设备的品类
    const devices = this.data.devices.map(device => {
      if (device.connected) {
        return { ...device, category };
      }
      return device;
    });

    this.setData({ devices });
  },

  /**
   * 处理员工选择
   */
  handleEmployeeChange(e: any) {
    const employeeIndex = parseInt(e.detail.value);
    const employee = this.data.employees[employeeIndex];
    
    this.setData({
      selectedEmployeeIndex: employeeIndex,
      selectedEmployee: employee
    });
  },

  /**
   * 延时函数
   */
  sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 跳转到个人中心
  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },
});