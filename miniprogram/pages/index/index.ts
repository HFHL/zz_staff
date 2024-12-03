// index.ts
// 获取应用实例
const app = getApp<IAppOption>()
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Component({
  data: {
    phone: '',
    loading: false
  },

  methods: {
    // 手机号输入处理
    onPhoneInput(e: any) {
      this.setData({
        phone: e.detail.value
      })
    },

    // 验证手机号格式
    validatePhone(phone: string): boolean {
      const phoneReg = /^1[3-9]\d{9}$/
      return phoneReg.test(phone)
    },

    // 处理登录
    async handleLogin() {
      const { phone } = this.data
      
      // 验证手机号
      if (!this.validatePhone(phone)) {
        wx.showToast({
          title: '请输入正确的手机号',
          icon: 'error'
        })
        return
      }

      try {
        this.setData({ loading: true })
        
        // TODO: 这里可以添加实际的登录接口调用
        // 模拟登录过程
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // 保存登录状态
        wx.setStorageSync('userPhone', phone)
        
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        })

        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/home/home'
          })
        }, 1500)

      } catch (error) {
        wx.showToast({
          title: '登录失败',
          icon: 'error'
        })
      } finally {
        this.setData({ loading: false })
      }
    }
  }
})
