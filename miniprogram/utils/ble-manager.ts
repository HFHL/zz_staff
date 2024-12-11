interface BLEDevice {
  deviceId: string;
  name?: string;
  RSSI?: number;
  advertisData?: ArrayBuffer;
  advertisServiceUUIDs?: string[];
  localName?: string;
  serviceData?: object;
}

interface BLEService {
  uuid: string;
  isPrimary: boolean;
}

interface BLECharacteristic {
  uuid: string;
  properties: {
    read: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
  };
}

export class BLEManager {
  private isInitialized: boolean;

  constructor() {
    this.isInitialized = false;
  }

  async createBLEConnection(deviceId: string): Promise<boolean> {
    try {
      await wx.createBLEConnection({
        deviceId: deviceId
      });
      return true;
    } catch (error) {
      console.error('创建连接失败:', error);
      throw error;
    }
  }

  async closeBLEConnection(deviceId: string): Promise<boolean> {
    try {
      await wx.closeBLEConnection({
        deviceId: deviceId
      });
      return true;
    } catch (error) {
      console.error('关闭连接失败:', error);
      throw error;
    }
  }

  async getBLEDeviceServices(deviceId: string): Promise<BLEService[]> {
    try {
      const res = await wx.getBLEDeviceServices({
        deviceId: deviceId
      });
      return res.services;
    } catch (error) {
      console.error('获取服务失败:', error);
      throw error;
    }
  }

  async getBLEDeviceCharacteristics(deviceId: string, serviceId: string): Promise<BLECharacteristic[]> {
    try {
      const res = await wx.getBLEDeviceCharacteristics({
        deviceId: deviceId,
        serviceId: serviceId
      });
      return res.characteristics;
    } catch (error) {
      console.error('获取特征值失败:', error);
      throw error;
    }
  }

  async notifyBLECharacteristicValueChange(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    state: boolean
  ): Promise<boolean> {
    try {
      await wx.notifyBLECharacteristicValueChange({
        deviceId: deviceId,
        serviceId: serviceId,
        characteristicId: characteristicId,
        state: state
      });
      return true;
    } catch (error) {
      console.error('启用通知失败:', error);
      throw error;
    }
  }

  async writeBLECharacteristicValue(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    value: ArrayBuffer
  ): Promise<boolean> {
    try {
      await wx.writeBLECharacteristicValue({
        deviceId: deviceId,
        serviceId: serviceId,
        characteristicId: characteristicId,
        value: value
      });
      return true;
    } catch (error) {
      console.error('写入数据失败:', error);
      throw error;
    }
  }
}
