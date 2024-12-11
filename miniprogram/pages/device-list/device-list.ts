Page({
  data: {
    devices: [] as WechatMiniprogram.BluetoothDeviceInfo[],
    isSearching: false
  },

  onLoad() {
    this.startBluetoothDeviceSearch()
  },

  onUnload() {
    this.cleanupBluetooth()
  },

  // 清理蓝牙状态
  async cleanupBluetooth() {
    try {
      // 无论当前状态如何，都尝试关闭蓝牙适配器
      try {
        await wx.stopBluetoothDevicesDiscovery()
        await wx.closeBluetoothAdapter()
        console.log('蓝牙适配器已关闭')
      } catch (closeError) {
        console.log('关闭蓝牙适配器失败，可能已经关闭:', closeError)
      }

      this.setData({ 
        isSearching: false,
        devices: []
      })

      // 等待一小段时间确保蓝牙完全关闭
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.log('清理蓝牙状态失败:', error)
    }
  },

  // 开始搜索蓝牙设备
  async startBluetoothDeviceSearch() {
    try {
      // 1. 先清理之前的蓝牙状态
      await this.cleanupBluetooth()
      
      // 2. 初始化蓝牙模块
      try {
        await wx.openBluetoothAdapter()
        console.log('蓝牙初始化成功')
      } catch (error: any) {
        if (error.errMsg && error.errMsg.includes('already opened')) {
          console.log('蓝牙已经打开，继续搜索')
        } else {
          throw error
        }
      }

      // 3. 开始搜索
      this.setData({ 
        isSearching: true,
        devices: []  // 清空设备列表
      })

      // 4. 监听蓝牙设备发现事件
      wx.onBluetoothDeviceFound((res) => {
        // 更新设备列表，去重
        const existingDevices = this.data.devices
        const updatedDevices = [...existingDevices]
        
        res.devices.forEach(newDevice => {
          // 只处理 LEAP 开头的设备
          if (newDevice.name && newDevice.name.startsWith('LEAP')) {
            // 打印设备信息
            console.log('发现称重设备:', {
              name: newDevice.name,
              deviceId: newDevice.deviceId,
              RSSI: newDevice.RSSI
            })

            const existingIndex = existingDevices.findIndex(
              device => device.deviceId === newDevice.deviceId
            )
            if (existingIndex === -1) {
              updatedDevices.push(newDevice)
            }
          }
        })

        if (updatedDevices.length !== existingDevices.length) {
          this.setData({ devices: updatedDevices })
        }
      })

      // 5. 开始搜索
      await wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false,
        powerLevel: 'high'  // 使用高功率模式
      })
      console.log('开始搜索蓝牙设备')

    } catch (error) {
      console.error('蓝牙搜索失败:', error)
      wx.showToast({
        title: '蓝牙搜索失败',
        icon: 'error'
      })
    }
  },

  // 选择设备
  onDeviceSelect(e: any) {
    const device = e.currentTarget.dataset.device
    console.log('选择设备:', device)
    
    // 跳转到称重控制页面
    wx.navigateTo({
      url: `/pages/weight-control/weight-control?deviceId=${device.deviceId}&name=${device.name}`
    })
  }
})
