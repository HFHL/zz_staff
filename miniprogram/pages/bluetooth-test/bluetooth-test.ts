import { BLEManager } from '../../utils/ble-manager';

interface PageData {
  devices: {
    scales: WechatMiniprogram.BlueToothDevice[];
    printers: WechatMiniprogram.BlueToothDevice[];
  };
  scanning: boolean;
  printerConnected: boolean;
  searchingPrinter: boolean;
}

Page<PageData, WechatMiniprogram.IAnyObject>({
  data: {
    devices: {
      scales: [],
      printers: []
    },
    scanning: false,
    printerConnected: false,
    searchingPrinter: false
  },

  bleManager: new BLEManager(),
  searchTimeout: null as any,

  onLoad() {
    this.initBluetooth();
  },

  onUnload() {
    this.cleanupBluetooth();
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  },

  async initBluetooth() {
    try {
      const res = await wx.openBluetoothAdapter();
      console.log('Bluetooth adapter opened:', res);
      this.startSearchingPrinter();
    } catch (error) {
      console.error('Failed to initialize Bluetooth:', error);
      wx.showToast({
        title: '请打开蓝牙',
        icon: 'error'
      });
    }
  },

  async startSearchingPrinter() {
    if (this.data.printerConnected) {
      return;
    }

    try {
      this.setData({ searchingPrinter: true });
      await wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false,
      });
      this.onBluetoothDeviceFound();
      this.searchTimeout = setTimeout(async () => {
        if (!this.data.printerConnected) {
          await wx.stopBluetoothDevicesDiscovery();
          this.setData({ searchingPrinter: false });
          setTimeout(() => this.startSearchingPrinter(), 3000);
        }
      }, 30000);
    } catch (error) {
      console.error('搜索蓝牙设备失败:', error);
      this.setData({ searchingPrinter: false });
      setTimeout(() => this.startSearchingPrinter(), 3000);
    }
  },

  cleanupBluetooth() {
    if (this.data.searchingPrinter) {
      wx.stopBluetoothDevicesDiscovery();
    }
    wx.closeBluetoothAdapter();
  },

  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((result) => {
      const newDevice = result.devices[0];
      if (this.isPrinterDevice(newDevice)) {
        const printers = [...this.data.devices.printers];
        if (!printers.find(device => device.deviceId === newDevice.deviceId)) {
          printers.push(newDevice);
          this.setData({
            'devices.printers': printers
          });
          this.tryConnectPrinter();
        }
      } else if (this.isScaleDevice(newDevice)) {
        const scales = [...this.data.devices.scales];
        if (!scales.find(device => device.deviceId === newDevice.deviceId)) {
          scales.push(newDevice);
          this.setData({
            'devices.scales': scales
          });
        }
      }
    });
  },

  async tryConnectPrinter() {
    if (this.data.printerConnected) return;

    const printers = this.data.devices.printers;
    if (printers.length > 0) {
      try {
        const printer = printers[0];
        await this.bleManager.createBLEConnection(printer.deviceId);
        const services = await this.bleManager.getBLEDeviceServices(printer.deviceId);
        const targetService = services.find((s: WechatMiniprogram.BLEService) => 
          s.uuid.toUpperCase().includes('FFF0')
        );
        if (!targetService) {
          throw new Error('未找到打印机服务');
        }
        const characteristics = await this.bleManager.getBLEDeviceCharacteristics(
          printer.deviceId, 
          targetService.uuid
        );
        console.log('打印机已连接');
        this.setData({ printerConnected: true });
      } catch (error) {
        console.error('自动连接打印机失败:', error);
        setTimeout(() => this.tryConnectPrinter(), 3000);
      }
    } else {
      setTimeout(() => this.tryConnectPrinter(), 1000);
    }
  },

  isScaleDevice(device: WechatMiniprogram.BlueToothDevice): boolean {
    const name = device.name || device.localName || '';
    return name.toUpperCase().startsWith('LEAP');
  },

  isPrinterDevice(device: WechatMiniprogram.BlueToothDevice): boolean {
    const name = device.name || device.localName || '';
    const rssi = device.RSSI || -100;
    if (rssi < -85 || rssi === 0) return false;
    return name.toUpperCase().startsWith('HM');
  },

  async connectDevice(e: WechatMiniprogram.Touch) {
    const dataset = (e.currentTarget as any).dataset;
    const deviceId = dataset.deviceId;
    const deviceType = dataset.type;

    try {
      await this.bleManager.createBLEConnection(deviceId);
      wx.showToast({
        title: '连接成功',
        icon: 'success'
      });

      const services = await this.bleManager.getBLEDeviceServices(deviceId);
      console.log('Device services:', services);

      if (deviceType === 'scale') {
        console.log('称重设备已连接');
      } else if (deviceType === 'printer') {
        console.log('打印机已连接');
        this.setData({ printerConnected: true });
        const targetService = services.find((s: WechatMiniprogram.BLEService) => 
          s.uuid.toUpperCase().includes('FFF0')
        );
        if (!targetService) {
          throw new Error('未找到打印机服务');
        }
        const characteristics = await this.bleManager.getBLEDeviceCharacteristics(
          deviceId, 
          targetService.uuid
        );
        console.log('打印机特征值:', characteristics);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      wx.showToast({
        title: '连接失败',
        icon: 'error'
      });
    }
  }
});
