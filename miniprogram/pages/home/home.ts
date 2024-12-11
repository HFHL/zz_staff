Component({
  data: {
    devices: [] as WechatMiniprogram.BluetoothDeviceInfo[],
    isSearching: false,
    isBluetoothInitialized: false
  },

  lifetimes: {
    attached() {
      // 页面加载时检查是否登录
      const phone = wx.getStorageSync('userPhone')
      if (!phone) {
        // 如果没有登录，跳转到登录页
        wx.redirectTo({
          url: '/pages/index/index'
        })
      }
    },

    detached() {
      // 页面卸载时清理蓝牙
      this.cleanupBluetooth()
    }
  },

  methods: {
    onWeighTap() {
      wx.navigateTo({
        url: '/pages/weighing/weighing'
      });
    },

    // 清理蓝牙状态
    async cleanupBluetooth() {
      try {
        if (this.data.isBluetoothInitialized) {
          await wx.closeBluetoothAdapter()
          console.log('蓝牙适配器已关闭')
          this.setData({ 
            isSearching: false,
            devices: [],
            isBluetoothInitialized: false
          })
        }
      } catch (error) {
        console.log('清理蓝牙状态失败:', error)
      }
    }
  }
})