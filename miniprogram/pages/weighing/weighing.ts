import { BLEManager } from '../../utils/ble-manager';
import { strToGBKByte } from '../../utils/printUtil-GBK';

interface PageData {
  devices: WechatMiniprogram.BlueToothDevice[];
  connected: boolean;
  deviceNumber: string;
  weight: string;
  batteryLevel: number;
  connectedDeviceId: string;
  serviceId: string;
  writeCharacteristicId: string;
  printerConnected: boolean;
  printerStatus: string;
  printerDeviceId: string;
  printerServiceId: string;
  printerCharacteristicId: string;
}

Page<PageData>({
  data: {
    devices: [],
    connected: false,
    deviceNumber: '',
    weight: '0.0',
    batteryLevel: 0,
    connectedDeviceId: '',
    serviceId: '',
    writeCharacteristicId: '',
    printerConnected: false,
    printerStatus: '未连接',
    printerDeviceId: '',
    printerServiceId: '',
    printerCharacteristicId: ''
  },

  onLoad() {
    this.initBluetooth();
  },

  onUnload() {
    // 清理定时器
    if (this.weightTimer) {
      clearInterval(this.weightTimer);
    }
    this.cleanupBluetooth();
  },

  weightTimer: null as any,

  async initBluetooth() {
    try {
      await wx.closeBluetoothAdapter();
      await new Promise(resolve => setTimeout(resolve, 500));
      await wx.openBluetoothAdapter();
      console.log('蓝牙初始化成功');
      
      await this.startBluetoothDevicesDiscovery();
    } catch (error) {
      console.error('蓝牙初始化失败:', error);
      wx.showToast({
        title: '请打开蓝牙',
        icon: 'none'
      });
    }
  },

  async cleanupBluetooth() {
    try {
      await wx.stopBluetoothDevicesDiscovery();
      await wx.closeBluetoothAdapter();
    } catch (error) {
      console.error('清理蓝牙状态失败:', error);
    }
  },

  async startBluetoothDevicesDiscovery() {
    try {
      await wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: true,
        interval: 200,
        powerLevel: "high"
      });

      this.onBluetoothDeviceFound();
    } catch (error) {
      console.error('搜索设备失败:', error);
    }
  },

  isScaleDevice(device: WechatMiniprogram.BlueToothDevice): boolean {
    const name = device.name || device.localName || '';
    return name.toUpperCase().startsWith('LEAP');
  },

  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (!device.name && !device.localName) return;

        if (this.isScaleDevice(device)) {
          const idx = this.data.devices.findIndex(d => d.deviceId === device.deviceId);
          if (idx === -1) {
            this.setData({
              devices: [...this.data.devices, device]
            });
          } else {
            const devices = this.data.devices;
            devices[idx] = device;
            this.setData({ devices });
          }
        }
      });
    });
  },

  async connectDevice(e: any) {
    const deviceId = e.currentTarget.dataset.deviceId;
    try {
      wx.showLoading({ title: '连接中...' });

      // 连接称重设备
      await wx.createBLEConnection({ deviceId });
      console.log('连接成功');

      // 获取服务
      const servicesRes = await wx.getBLEDeviceServices({ deviceId });
      console.log('获取服务成功:', servicesRes.services);

      // 获取特征值
      for (let service of servicesRes.services) {
        const characteristicsRes = await wx.getBLEDeviceCharacteristics({
          deviceId,
          serviceId: service.uuid
        });

        const characteristic = characteristicsRes.characteristics.find(
          char => char.properties.write || char.properties.writeNoResponse
        );

        if (characteristic) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 保存连接信息
          this.setData({
            connectedDeviceId: deviceId,
            serviceId: service.uuid,
            writeCharacteristicId: characteristic.uuid
          });

          // 启用特征值变化监听
          await wx.notifyBLECharacteristicValueChange({
            deviceId,
            serviceId: service.uuid,
            characteristicId: characteristic.uuid,
            state: true
          });

          // 开始监听数据
          this.startWeightMonitoring();

          // 搜索并连接打印机
          await this.searchAndConnectPrinter();

          this.setData({ connected: true });
          wx.hideLoading();
          wx.showToast({
            title: '连接成功',
            icon: 'success'
          });
          return;
        }
      }

      throw new Error('未找到可写特征值');
    } catch (error) {
      console.error('连接失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '连接失败',
        icon: 'error'
      });
    }
  },

  // 搜索并连接打印机
  async searchAndConnectPrinter() {
    try {
      wx.showLoading({ title: '搜索打印机...' });
      
      // 开始搜索蓝牙设备
      await wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false
      });

      // 等待3秒以发现设备
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 获取发现的设备
      const devicesRes = await wx.getBluetoothDevices();
      const printers = devicesRes.devices.filter(device => 
        device.name && device.name.includes('HM')
      );

      if (printers.length === 0) {
        throw new Error('未找到打印机');
      }

      // 连接第一个找到的打印机
      const printer = printers[0];
      await wx.createBLEConnection({ deviceId: printer.deviceId });

      // 获取打印机服务
      const servicesRes = await wx.getBLEDeviceServices({ deviceId: printer.deviceId });
      const service = servicesRes.services[0]; // 通常打印机只有一个服务

      // 获取特征值
      const characteristicsRes = await wx.getBLEDeviceCharacteristics({
        deviceId: printer.deviceId,
        serviceId: service.uuid
      });

      const characteristic = characteristicsRes.characteristics.find(
        char => char.properties.write || char.properties.writeNoResponse
      );

      if (!characteristic) {
        throw new Error('未找到打印机可写特征值');
      }

      // 保存打印机连接信息
      this.setData({
        printerConnected: true,
        printerStatus: '已连接',
        printerDeviceId: printer.deviceId,
        printerServiceId: service.uuid,
        printerCharacteristicId: characteristic.uuid
      });

      wx.hideLoading();
      console.log('打印机连接成功');
    } catch (error) {
      console.error('打印机连接失败:', error);
      wx.hideLoading();
      this.setData({
        printerConnected: false,
        printerStatus: '未连接'
      });
    } finally {
      // 停止搜索
      wx.stopBluetoothDevicesDiscovery();
    }
  },

  startWeightMonitoring() {
    // 监听数据
    wx.onBLECharacteristicValueChange((result) => {
      if (result.deviceId === this.data.connectedDeviceId) {
        // 手动将 ArrayBuffer 转换为字符串
        const value = this.arrayBufferToString(result.value);
        console.log('收到数据:', value);
        this.parseWeightData(value);
      }
    });

    // 定时发送称重指令
    this.weightTimer = setInterval(async () => {
      try {
        await this.sendWeighCommand();
      } catch (error) {
        console.error('发送称重指令失败:', error);
      }
    }, 1000); // 增加发送间隔到1秒
  },

  async sendWeighCommand() {
    try {
      const command = "$WEI#";
      const buffer = new ArrayBuffer(command.length);
      const dataView = new DataView(buffer);
      for (let i = 0; i < command.length; i++) {
        dataView.setUint8(i, command.charCodeAt(i));
      }

      await wx.writeBLECharacteristicValue({
        deviceId: this.data.connectedDeviceId,
        serviceId: this.data.serviceId,
        characteristicId: this.data.writeCharacteristicId,
        value: buffer
      });
      console.log('发送称重指令成功');
    } catch (error) {
      console.log('发送称重指令失败:', error);
    }
  },

  parseWeightData(data: string) {
    console.log('原始数据:', data);
    console.log('数据类型:', typeof data);
    console.log('数据长度:', data.length);
    
    // 解析格式：50088W22.5V4 或 50088W-0.1V4
    const match = data.match(/(\d+)W(-?\d+\.?\d*)V(\d)/);
    if (match) {
      const [fullMatch, deviceNumber, weight, batteryLevel] = match;
      console.log('匹配结果:', { fullMatch, deviceNumber, weight, batteryLevel });
      
      this.setData({
        deviceNumber,
        weight: parseFloat(weight).toFixed(1),
        batteryLevel: parseInt(batteryLevel)
      });
      console.log('更新后的数据:', this.data);
    } else {
      console.log('数据格式不匹配:', data);
    }
  },

  // 将 ArrayBuffer 转换为字符串
  arrayBufferToString(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    let string = '';
    for (let i = 0; i < uint8Array.length; i++) {
      string += String.fromCharCode(uint8Array[i]);
    }
    return string;
  },

  // 打印重量信息
  async printWeight() {
    try {
      if (!this.data.printerConnected) {
        await this.connectPrinter();
      }

      const printData = `设备号: ${this.data.deviceNumber}\n重量: ${this.data.weight}kg\n电量: ${this.data.batteryLevel}/4\n`;
      await this.sendPrintData(printData);
      
      wx.showToast({
        title: '打印成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('打印失败:', error);
      wx.showToast({
        title: '打印失败',
        icon: 'error'
      });
    }
  },

  // 连接打印机
  async connectPrinter() {
    try {
      // 搜索打印机设备
      wx.showLoading({ title: '搜索打印机...' });
      const printerDevices = await this.searchPrinterDevices();
      
      if (printerDevices.length === 0) {
        throw new Error('未找到打印机设备');
      }

      // 连接第一个找到的打印机
      const printer = printerDevices[0];
      const printerInfo = await this.connectToPrinter(printer);
      
      this.setData({
        printerConnected: true,
        printerStatus: '已连接',
        printerDeviceId: printerInfo.deviceId,
        printerServiceId: printerInfo.serviceId,
        printerCharacteristicId: printerInfo.characteristicId
      });

      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      throw error;
    }
  },

  // 搜索打印机设备
  async searchPrinterDevices() {
    return new Promise((resolve, reject) => {
      wx.startBluetoothDevicesDiscovery({
        services: ['000018F0-0000-1000-8000-00805F9B34FB'], // 打印机服务UUID
        success: () => {
          setTimeout(() => {
            wx.getBluetoothDevices({
              success: (res) => {
                const printers = res.devices.filter(device => 
                  device.name && (
                    device.name.includes('Printer') || 
                    device.name.includes('Print') ||
                    device.name.includes('HM') ||
                    device.localName && (
                      device.localName.includes('Printer') ||
                      device.localName.includes('Print') ||
                      device.localName.includes('HM')
                    )
                  )
                );
                resolve(printers);
              },
              fail: reject
            });
          }, 3000); // 搜索3秒
        },
        fail: reject
      });
    });
  },

  // 连接到打印机
  async connectToPrinter(printer: WechatMiniprogram.BlueToothDevice) {
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId: printer.deviceId,
        success: () => {
          wx.getBLEDeviceServices({
            deviceId: printer.deviceId,
            success: (res) => {
              const service = res.services.find(s => s.uuid.includes('18F0'));
              if (!service) {
                reject(new Error('未找到打印服务'));
                return;
              }

              wx.getBLEDeviceCharacteristics({
                deviceId: printer.deviceId,
                serviceId: service.uuid,
                success: (res) => {
                  const characteristic = res.characteristics.find(c => 
                    c.properties.write || c.properties.writeNoResponse
                  );
                  if (!characteristic) {
                    reject(new Error('未找到可写特征值'));
                    return;
                  }

                  resolve({
                    deviceId: printer.deviceId,
                    serviceId: service.uuid,
                    characteristicId: characteristic.uuid
                  });
                },
                fail: reject
              });
            },
            fail: reject
          });
        },
        fail: reject
      });
    });
  },

  // 发送打印数据
  async sendPrintData(data: string) {
    try {
      console.log('开始打印数据:', data);

      // 使用GBK编码转换字符串
      const gbkBytes = strToGBKByte(data);
      console.log('GBK编码后的数据:', gbkBytes);

      // 添加打印机指令前缀（初始化打印机）
      const initCommand = new Uint8Array([0x1B, 0x40]); // ESC @ 初始化打印机
      await wx.writeBLECharacteristicValue({
        deviceId: this.data.printerDeviceId,
        serviceId: this.data.printerServiceId,
        characteristicId: this.data.printerCharacteristicId,
        value: initCommand.buffer
      });
      console.log('已发送初始化命令');

      // 设置中文模式
      const chineseCommand = new Uint8Array([0x1C, 0x26]); // FS & 选择汉字模式
      await wx.writeBLECharacteristicValue({
        deviceId: this.data.printerDeviceId,
        serviceId: this.data.printerServiceId,
        characteristicId: this.data.printerCharacteristicId,
        value: chineseCommand.buffer
      });
      console.log('已设置中文模式');

      // 转换打印数据
      const buffer = new ArrayBuffer(gbkBytes.byteLength);
      const dataView = new DataView(buffer);
      const uint8Array = new Uint8Array(gbkBytes);
      console.log('打印数据字节数组:', Array.from(uint8Array));
      
      for (let i = 0; i < uint8Array.length; i++) {
        dataView.setUint8(i, uint8Array[i]);
      }

      // 发送数据到打印机
      console.log('正在发送打印数据...');
      await wx.writeBLECharacteristicValue({
        deviceId: this.data.printerDeviceId,
        serviceId: this.data.printerServiceId,
        characteristicId: this.data.printerCharacteristicId,
        value: buffer
      });
      console.log('打印数据发送完成');

      // 添加换行和切纸命令
      const endCommand = new Uint8Array([
        0x0A, // 换行
        0x0A, // 换行
        0x1D, 0x56, 0x42, 0x00 // GS V B 0 切纸
      ]);
      console.log('发送结束命令...');
      await wx.writeBLECharacteristicValue({
        deviceId: this.data.printerDeviceId,
        serviceId: this.data.printerServiceId,
        characteristicId: this.data.printerCharacteristicId,
        value: endCommand.buffer
      });
      console.log('打印完成');

      wx.showToast({
        title: '打印成功',
        icon: 'success'
      });
    } catch (error) {
      wx.showToast({
        title: '打印失败',
        icon: 'none'
      });
      console.error('打印失败:', error);
      console.error('打印机状态:', {
        deviceId: this.data.printerDeviceId,
        serviceId: this.data.printerServiceId,
        characteristicId: this.data.printerCharacteristicId
      });
    }
  },
});
