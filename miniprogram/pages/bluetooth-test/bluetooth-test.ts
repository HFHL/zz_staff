import { BLEManager } from '../../utils/ble-manager';

interface PageData {
  devices: {
    scales: WechatMiniprogram.BlueToothDevice[];
    printers: WechatMiniprogram.BlueToothDevice[];
  };
  scanning: boolean;
}

Page<PageData>({
  data: {
    devices: {
      scales: [],
      printers: []
    },
    scanning: false
  },

  onLoad() {
    this.initBluetooth();
  },

  onUnload() {
    // 页面卸载时清理蓝牙状态
    this.cleanupBluetooth();
  },

  // 初始化蓝牙
  async initBluetooth() {
    try {
      // 先关闭蓝牙模块，确保状态清理
      await wx.closeBluetoothAdapter();
      
      // 等待一下再初始化
      await new Promise(resolve => setTimeout(resolve, 500));

      // 初始化蓝牙模块
      await wx.openBluetoothAdapter();
      console.log('蓝牙初始化成功');

      // 停止可能正在进行的搜索
      await this.stopBluetoothDevicesDiscovery();
      
      // 开始搜索设备
      await this.startBluetoothDevicesDiscovery();
    } catch (error) {
      console.error('蓝牙初始化失败:', error);
      if (error.errCode === 10001) {
        wx.showToast({
          title: '请打开蓝牙',
          icon: 'none'
        });
      } else {
        wx.showToast({
          title: '蓝牙初始化失败',
          icon: 'none'
        });
      }
    }
  },

  // 清理蓝牙状态
  async cleanupBluetooth() {
    try {
      // 先停止搜索
      await this.stopBluetoothDevicesDiscovery();
      // 关闭蓝牙模块
      await wx.closeBluetoothAdapter();
    } catch (error) {
      console.error('清理蓝牙状态失败:', error);
    }
  },

  // 开始搜索设备
  async startBluetoothDevicesDiscovery() {
    if (this.data.scanning) {
      console.log('已经在搜索中');
      return;
    }

    try {
      await wx.startBluetoothDevicesDiscovery({
        services: ['FFF0'],  // 打印机的服务 UUID
        allowDuplicatesKey: true,
        interval: 200,
        powerLevel: "high"
      });

      this.setData({ scanning: true });
      console.log('开始搜索设备');
      this.onBluetoothDeviceFound();
    } catch (error) {
      console.error('搜索设备失败:', error);
      this.setData({ scanning: false });
      
      if (error.errMsg.includes('already discovering')) {
        // 如果已经在搜索，先停止再重新开始
        await this.stopBluetoothDevicesDiscovery();
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.startBluetoothDevicesDiscovery();
      }
    }
  },

  // 停止搜索设备
  async stopBluetoothDevicesDiscovery() {
    try {
      await wx.stopBluetoothDevicesDiscovery();
      this.setData({ scanning: false });
      console.log('停止搜索设备');
    } catch (error) {
      console.error('停止搜索失败:', error);
    }
  },

  isScaleDevice(device: WechatMiniprogram.BlueToothDevice): boolean {
    const name = device.name || device.localName || '';
    return name.toUpperCase().startsWith('LEAP');
  },

  isPrinterDevice(device: WechatMiniprogram.BlueToothDevice): boolean {
    const name = device.name || device.localName || '';
    const rssi = device.RSSI || -100;
    
    // 信号强度过滤
    if (rssi < -85 || rssi === 0) return false;
    
    // 检查设备名称是否以 HM 开头
    return name.toUpperCase().startsWith('HM');
  },

  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        // 只处理有名字的设备
        if (!device.name && !device.localName) return;

        const { scales, printers } = this.data.devices;

        if (this.isScaleDevice(device)) {
          // 检查是否已存在该称重设备
          const idx = scales.findIndex(d => d.deviceId === device.deviceId);
          if (idx === -1) {
            // 新设备，添加到列表
            this.setData({
              'devices.scales': [...scales, device]
            });
          } else {
            // 更新已有设备的信息
            scales[idx] = device;
            this.setData({ 'devices.scales': scales });
          }
        } else if (this.isPrinterDevice(device)) {
          // 检查是否已存在该打印机
          const idx = printers.findIndex(d => d.deviceId === device.deviceId);
          if (idx === -1) {
            // 新设备，添加到列表
            this.setData({
              'devices.printers': [...printers, device]
            });
          } else {
            // 更新已有设备的信息
            printers[idx] = device;
            this.setData({ 'devices.printers': printers });
          }
        }
      });
    });
  },

  async connectDevice(e: WechatMiniprogram.Touch) {
    const deviceId = e.currentTarget.dataset.deviceId;
    const deviceType = e.currentTarget.dataset.type; // 'scale' 或 'printer'
    const bleManager = new BLEManager();
    
    try {
      await bleManager.createBLEConnection(deviceId);
      
      wx.showToast({
        title: '连接成功',
        icon: 'success'
      });
      
      // 可以根据设备类型进行不同的处理
      if (deviceType === 'printer') {
        // 处理打印机连接后的逻辑
        console.log('打印机已连接');
        // 获取服务
        const services = await bleManager.getBLEDeviceServices(deviceId);
        
        // 找到 FFF0 服务
        const targetService = services.find(s => 
          s.uuid.toUpperCase().includes('FFF0')
        );
        
        if (!targetService) {
          throw new Error('未找到打印机服务');
        }
        
        const characteristics = await bleManager.getBLEDeviceCharacteristics(
          deviceId, 
          targetService.uuid
        );
        
        // 可以进行打印相关操作
        console.log('打印机特征值:', characteristics);
      } else if (deviceType === 'scale') {
        // 处理称重设备连接后的逻辑
        console.log('称重设备已连接');
      }
    } catch (error) {
      console.error('连接设备失败:', error);
      wx.showToast({
        title: '连接失败',
        icon: 'error'
      });
    }
  }
});
